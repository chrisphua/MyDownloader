/**
 * All DynamoDB access for the Todo entity lives here.
 *
 * Table schema:
 *   PK: id (string, UUID)
 *   GSI "userId-index": userId (PK) + createdAt (SK)
 *
 * Every method takes a userId so todos are scoped per-user.
 */
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { v4 as uuid } from "uuid";

import type { CreateTodoInput, Todo, UpdateTodoInput } from "@todo-app/types";
import { ddb } from "../lib/ddb.js";
import { env } from "../lib/env.js";

type StoredTodo = Todo & { userId: string };

function strip(item: StoredTodo): Todo {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { userId: _uid, ...rest } = item;
  return rest;
}

export const todoRepository = {
  async list(userId: string): Promise<Todo[]> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: env.TODOS_TABLE_NAME,
        IndexName: env.TODOS_USER_INDEX,
        KeyConditionExpression: "#userId = :userId",
        ExpressionAttributeNames: { "#userId": "userId" },
        ExpressionAttributeValues: { ":userId": userId },
        ScanIndexForward: false, // newest first via createdAt SK desc
      }),
    );
    return (result.Items ?? []).map((i) => strip(i as StoredTodo));
  },

  async getById(userId: string, id: string): Promise<Todo | undefined> {
    const result = await ddb.send(
      new GetCommand({ TableName: env.TODOS_TABLE_NAME, Key: { id } }),
    );
    const item = result.Item as StoredTodo | undefined;
    if (!item || item.userId !== userId) return undefined;
    return strip(item);
  },

  async create(userId: string, input: CreateTodoInput): Promise<Todo> {
    const now = new Date().toISOString();
    const item: StoredTodo = {
      id: uuid(),
      userId,
      title: input.title,
      description: input.description,
      done: input.done ?? false,
      priority: input.priority,
      startDate: input.startDate,
      dueDate: input.dueDate,
      createdAt: now,
      updatedAt: now,
    };
    await ddb.send(
      new PutCommand({
        TableName: env.TODOS_TABLE_NAME,
        Item: item,
        ConditionExpression: "attribute_not_exists(id)",
      }),
    );
    return strip(item);
  },

  async update(userId: string, id: string, input: UpdateTodoInput): Promise<Todo | undefined> {
    const setParts: string[] = [];
    const names: Record<string, string> = { "#userId": "userId" };
    const values: Record<string, unknown> = { ":userId": userId };

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
    if (input.priority !== undefined) {
      setParts.push("#priority = :priority");
      names["#priority"] = "priority";
      values[":priority"] = input.priority;
    }
    if (input.startDate !== undefined) {
      setParts.push("#startDate = :startDate");
      names["#startDate"] = "startDate";
      values[":startDate"] = input.startDate;
    }
    if (input.dueDate !== undefined) {
      setParts.push("#dueDate = :dueDate");
      names["#dueDate"] = "dueDate";
      values[":dueDate"] = input.dueDate;
    }

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
          ConditionExpression: "attribute_exists(id) AND #userId = :userId",
          ReturnValues: "ALL_NEW",
        }),
      );
      const item = result.Attributes as StoredTodo | undefined;
      return item ? strip(item) : undefined;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "ConditionalCheckFailedException") {
        return undefined;
      }
      throw err;
    }
  },

  async delete(userId: string, id: string): Promise<boolean> {
    try {
      await ddb.send(
        new DeleteCommand({
          TableName: env.TODOS_TABLE_NAME,
          Key: { id },
          ConditionExpression: "attribute_exists(id) AND #userId = :userId",
          ExpressionAttributeNames: { "#userId": "userId" },
          ExpressionAttributeValues: { ":userId": userId },
        }),
      );
      return true;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "ConditionalCheckFailedException") {
        return false;
      }
      throw err;
    }
  },
};
