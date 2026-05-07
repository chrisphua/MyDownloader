/**
 * Helpers for building API Gateway v2 (HTTP API) responses and parsing input.
 *
 * Keeping all HTTP shape logic here means handlers stay focused on business
 * logic — they just `return ok(data)` or `return badRequest(message)`.
 */
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import type { ApiError } from "@todo-app/types";

const CORS_HEADERS = {
  // The web build of the Expo app is hosted on a different origin, so we
  // need permissive CORS. Tighten this for production by replacing "*" with
  // your CloudFront domain.
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
} as const;

const JSON_HEADERS = {
  "Content-Type": "application/json",
  ...CORS_HEADERS,
} as const;

export function ok<T>(body: T): APIGatewayProxyResultV2 {
  return {
    statusCode: 200,
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  };
}

export function created<T>(body: T): APIGatewayProxyResultV2 {
  return {
    statusCode: 201,
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  };
}

export function noContent(): APIGatewayProxyResultV2 {
  return {
    statusCode: 204,
    headers: CORS_HEADERS,
    body: "",
  };
}

export function badRequest(message: string): APIGatewayProxyResultV2 {
  return errorResponse(400, "BadRequest", message);
}

export function notFound(message = "Resource not found"): APIGatewayProxyResultV2 {
  return errorResponse(404, "NotFound", message);
}

export function serverError(message = "Internal server error"): APIGatewayProxyResultV2 {
  return errorResponse(500, "InternalError", message);
}

function errorResponse(
  statusCode: number,
  error: string,
  message: string,
): APIGatewayProxyResultV2 {
  const body: ApiError = { error, message };
  return {
    statusCode,
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  };
}

/**
 * Parse a JSON body into `unknown`. Throws `ValidationError` on missing or
 * invalid JSON so `withErrorHandling` converts it to a 400.
 */
export function parseJsonBody(event: APIGatewayProxyEventV2): unknown {
  if (!event.body) {
    throw new ValidationError("Request body is required");
  }
  try {
    return JSON.parse(event.body);
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }
}

/**
 * Pull a required path parameter, throwing `ValidationError` if absent so
 * the caller turns it into a 400 (not a 500).
 */
export function pathParam(event: APIGatewayProxyEventV2, name: string): string {
  const value = event.pathParameters?.[name];
  if (!value) {
    throw new ValidationError(`Missing path parameter: ${name}`);
  }
  return value;
}

/**
 * Wrap a handler so unexpected throws turn into clean 500s and logged errors,
 * and validation throws (Error subclasses with a message) become 400s.
 *
 * Handlers can throw `Error` for client mistakes (caught as 400) or any
 * other exception for server faults (caught as 500). For 404 they should
 * return `notFound()` directly.
 */
export function withErrorHandling(
  handler: (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyResultV2>,
) {
  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    try {
      return await handler(event);
    } catch (err) {
      if (err instanceof ValidationError) {
        return badRequest(err.message);
      }
      console.error("Unhandled error in handler:", err);
      return serverError();
    }
  };
}

/**
 * Extract the authenticated user's Cognito `sub` from the JWT authorizer
 * context. Throws `ValidationError` (→ 400) if the claim is missing, which
 * only happens if a route is misconfigured to skip the authorizer.
 */
export function getUserId(event: APIGatewayProxyEventV2): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sub = (event.requestContext as any).authorizer?.jwt?.claims?.sub as string | undefined;
  if (!sub) throw new ValidationError("Missing user identity — is the JWT authorizer attached?");
  return sub;
}

/** Throw this for 4xx client errors. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
