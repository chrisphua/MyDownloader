/**
 * All DynamoDB access for the Todo entity lives here.
 *
 * Handlers must NOT call DynamoDB directly — they go through this module.
 * If you ever need to swap DynamoDB for Postgres or memory storage (e.g.
 * for tests), this is the single file to replace.
 *
 * Table schema (see infra/lib/api-stack.ts for the CDK definition):
 *   PK: id (string, UUID)
 *   No sort key, no GSIs — simple single-item lookups by id.
 *
 * For larger apps you'd shift to single-table design with composite keys,
 * but for a CRUD this size simplicity wins.
 */
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { v4 as uuid } from "uuid";

import type {
  CreateTodoInput,
  Todo,
  UpdateTodoInput,
} from "@todo-app/types";
import { ddb } from "../lib/ddb.js";
import { env } from "../lib/env.js";

export const todoRepository = {
  async list(): Promise<Todo[]> {
    // NOTE: Scan is fine for a small table. If this app grew to thousands
    // of todos per user, we'd add a GSI on something like (ownerId, createdAt)
    // and Query that instead.
    const result = await ddb.send(
      new ScanCommand({ TableName: env.TODOS_TABLE_NAME }),
    );
    const items = (result.Items ?? []) as Todo[];
    // Newest first.
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getById(id: string): Promise<Todo | undefined> {
    const result = await ddb.send(
      new GetCommand({
        TableName: env.TODOS_TABLE_NAME,
        Key: { id },
      }),
    );
    return result.Item as Todo | undefined;
  },

  async create(input: CreateTodoInput): Promise<Todo> {
    const now = new Date().toISOString();
    const todo: Todo = {
      id: uuid(),
      title: input.title,
      description: input.description,
      done: input.done ?? false,
      createdAt: now,
      updatedAt: now,
    };
    await ddb.send(
      new PutCommand({
        TableName: env.TODOS_TABLE_NAME,
        Item: todo,
        // Defensive — ensures we never overwrite a colliding id.
        ConditionExpression: "attribute_not_exists(id)",
      }),
    );
    return todo;
  },

  async update(id: string, input: UpdateTodoInput): Promise<Todo | undefined> {
    // Build a dynamic SET expression so we only touch the fields the client
    // actually provided. This is friendlier than read-modify-write and
    // avoids losing data on concurrent edits.
    const setParts: string[] = [];
    const names: Record<string, string> = {};
    const values: Record<string, unknown> = {};

    if (input.title !== undefined) {
      setParts.push("#title = :title");
      names["#title"] = "title";
      values[":title"] = input.title;
    }
    if (input.description !== undefined) {
      setParts.push("#description = :description");
      names["#description"] = "description";
      values[":description"] = input.description;
    }
    if (input.done !== undefined) {
      setParts.push("#done = :done");
      names["#done"] = "done";
      values[":done"] = input.done;
    }

    // Always bump updatedAt.
    setParts.push("#updatedAt = :updatedAt");
    names["#updatedAt"] = "updatedAt";
    values[":updatedAt"] = new Date().toISOString();

    try {
      const result = await ddb.send(
        new UpdateCommand({
          TableName: env.TODOS_TABLE_NAME,
          Key: { id },
          UpdateExpression: `SET ${setParts.join(", ")}`,
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
          // Fail if the row doesn't exist, so callers can return 404.
          ConditionExpression: "attribute_exists(id)",
          ReturnValues: "ALL_NEW",
        }),
      );
      return result.Attributes as Todo | undefined;
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        err.name === "ConditionalCheckFailedException"
      ) {
        return undefined;
      }
      throw err;
    }
  },

  async delete(id: string): Promise<boolean> {
    try {
      await ddb.send(
        new DeleteCommand({
          TableName: env.TODOS_TABLE_NAME,
          Key: { id },
          ConditionExpression: "attribute_exists(id)",
        }),
      );
      return true;
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        err.name === "ConditionalCheckFailedException"
      ) {
        return false;
      }
      throw err;
    }
  },
};
