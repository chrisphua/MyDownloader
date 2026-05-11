import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuid } from "uuid";
import { ddb } from "../lib/ddb.js";
import { env } from "../lib/env.js";

export type StoredUser = {
  userId: string;
  email: string;
  passwordHash: string;
  createdAt: string;
};

export const userRepository = {
  async findByEmail(email: string): Promise<StoredUser | undefined> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: env.USERS_TABLE_NAME,
        IndexName: env.USERS_EMAIL_INDEX,
        KeyConditionExpression: "#email = :email",
        ExpressionAttributeNames: { "#email": "email" },
        ExpressionAttributeValues: { ":email": email.toLowerCase() },
        Limit: 1,
      }),
    );
    return result.Items?.[0] as StoredUser | undefined;
  },

  async create(email: string, passwordHash: string): Promise<StoredUser> {
    const user: StoredUser = {
      userId: uuid(),
      email: email.toLowerCase(),
      passwordHash,
      createdAt: new Date().toISOString(),
    };
    await ddb.send(
      new PutCommand({
        TableName: env.USERS_TABLE_NAME,
        Item: user,
        ConditionExpression: "attribute_not_exists(userId)",
      }),
    );
    return user;
  },
};
