/**
 * Idempotently create the local Todos table in DynamoDB Local.
 *
 * Run after `docker compose up -d`:
 *   npm run db:bootstrap
 *
 * Re-running is a no-op (skips if the table already exists).
 */
import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  ResourceNotFoundException,
} from "@aws-sdk/client-dynamodb";

const endpoint = process.env.DYNAMODB_ENDPOINT ?? "http://localhost:8000";
const tableName = process.env.TODOS_TABLE_NAME ?? "todos-local";

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
  if (await tableExists(tableName)) {
    console.log(`Table "${tableName}" already exists at ${endpoint}. Skipping.`);
    return;
  }

  await client.send(
    new CreateTableCommand({
      TableName: tableName,
      AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
      KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
      BillingMode: "PAY_PER_REQUEST",
    }),
  );
  console.log(`Created table "${tableName}" at ${endpoint}`);
}

main().catch((err) => {
  console.error("Failed to bootstrap local DB:", err);
  process.exit(1);
});
