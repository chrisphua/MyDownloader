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
  get TODOS_TABLE_NAME(): string { return required("TODOS_TABLE_NAME"); },
  get TODOS_USER_INDEX(): string { return required("TODOS_USER_INDEX"); },
  get USERS_TABLE_NAME(): string { return required("USERS_TABLE_NAME"); },
  get USERS_EMAIL_INDEX(): string { return required("USERS_EMAIL_INDEX"); },
  get JWT_SECRET(): string { return required("JWT_SECRET"); },
  get AWS_REGION(): string { return required("AWS_REGION"); },
};
