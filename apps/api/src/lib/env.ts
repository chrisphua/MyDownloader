/**
 * Centralized access to required environment variables.
 *
 * Lambda environment variables are populated by CDK at deploy time
 * (see infra/lib/api-stack.ts). Reading them through this module gives us
 * one place to fail fast with a clear error if something is missing.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  /** DynamoDB table name for todos. */
  get TODOS_TABLE_NAME(): string {
    return required("TODOS_TABLE_NAME");
  },
  /** Name of the userId GSI on the todos table. */
  get TODOS_USER_INDEX(): string {
    return required("TODOS_USER_INDEX");
  },
  /** AWS region (Lambda sets this automatically). */
  get AWS_REGION(): string {
    return required("AWS_REGION");
  },
};
