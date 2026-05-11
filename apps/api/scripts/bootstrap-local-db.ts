/**
 * Idempotently create local DynamoDB tables.
 *
 * Run after `docker compose up -d`:
 *   npm run db:bootstrap
 *
 * Re-running is a no-op (skips tables that already exist).
 */
import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  ResourceNotFoundException,
} from "@aws-sdk/client-dynamodb";

const endpoint = process.env.DYNAMODB_ENDPOINT ?? "http://localhost:8000";
const todosTableName = process.env.TODOS_TABLE_NAME ?? "todos-local";
const usersTableName = process.env.USERS_TABLE_NAME ?? "users-local";

const client = new DynamoDBClient({
  endpoint,
  region: "local",
  credentials: { accessKeyId: "local", secretAccessKey: "local" },
});

async function tableExists(name: string): Promise<boolean> {
  try {
    await client.send(new DescribeTableCommand({ TableName: name }));
    return true;
  } catch (err: unknown) {
    if (err instanceof ResourceNotFoundException) return false;
    throw err;
  }
}

async function main() {
  // Todos table
  if (await tableExists(todosTableName)) {
    console.log(`Table "${todosTableName}" already exists. Skipping.`);
  } else {
    await client.send(
      new CreateTableCommand({
        TableName: todosTableName,
        AttributeDefinitions: [
          { AttributeName: "id", AttributeType: "S" },
          { AttributeName: "userId", AttributeType: "S" },
          { AttributeName: "createdAt", AttributeType: "S" },
        ],
        KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
        GlobalSecondaryIndexes: [
          {
            IndexName: "userId-index",
            KeySchema: [
              { AttributeName: "userId", KeyType: "HASH" },
              { AttributeName: "createdAt", KeyType: "RANGE" },
            ],
            Projection: { ProjectionType: "ALL" },
          },
        ],
        BillingMode: "PAY_PER_REQUEST",
      }),
    );
    console.log(`Created table "${todosTableName}"`);
  }

  // Users table
  if (await tableExists(usersTableName)) {
    console.log(`Table "${usersTableName}" already exists. Skipping.`);
  } else {
    await client.send(
      new CreateTableCommand({
        TableName: usersTableName,
        AttributeDefinitions: [
          { AttributeName: "userId", AttributeType: "S" },
          { AttributeName: "email", AttributeType: "S" },
        ],
        KeySchema: [{ AttributeName: "userId", KeyType: "HASH" }],
        GlobalSecondaryIndexes: [
          {
            IndexName: "email-index",
            KeySchema: [{ AttributeName: "email", KeyType: "HASH" }],
            Projection: { ProjectionType: "ALL" },
          },
        ],
        BillingMode: "PAY_PER_REQUEST",
      }),
    );
    console.log(`Created table "${usersTableName}"`);
  }
}

main().catch((err) => {
  console.error("Failed to bootstrap local DB:", err);
  process.exit(1);
});
