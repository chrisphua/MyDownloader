/**
 * Single shared DynamoDB Document Client.
 *
 * Lambda containers are reused across invocations (warm starts), so
 * instantiating the client at module scope means we only pay the connection
 * cost on cold start.
 *
 * For local development against DynamoDB Local (in Docker), set:
 *   DYNAMODB_ENDPOINT=http://localhost:8000
 * The endpoint env var is ignored when running on Lambda (no env var set).
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const localEndpoint = process.env.DYNAMODB_ENDPOINT;

const baseClient = new DynamoDBClient(
  localEndpoint
    ? {
        endpoint: localEndpoint,
        region: process.env.AWS_REGION ?? "local",
        // DynamoDB Local doesn't validate creds, but the SDK requires
        // *something* in this shape.
        credentials: {
          accessKeyId: "local",
          secretAccessKey: "local",
        },
      }
    : {},
);

export const ddb = DynamoDBDocumentClient.from(baseClient, {
  marshallOptions: {
    // Treat empty strings as null rather than rejecting them — friendlier
    // for optional text fields like `description`.
    convertEmptyValues: false,
    removeUndefinedValues: true,
  },
});
