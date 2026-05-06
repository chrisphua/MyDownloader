/**
 * Shared types for the Todo app.
 *
 * This is the single source of truth for the Todo domain model. Both the
 * backend (apps/api) and the frontend (apps/mobile) import from this package
 * so they cannot drift on field names, types, or shapes.
 *
 * Conventions:
 * - `Todo` is the canonical, server-side shape (what comes back from the API).
 * - `*Input` types describe what the client sends in. They omit
 *   server-managed fields like `id`, `createdAt`, and `updatedAt`.
 * - All timestamps are ISO-8601 strings to keep JSON serialization trivial.
 */

/** A single todo item as returned by the API. */
export interface Todo {
  /** UUID v4, generated on the server at creation time. */
  id: string;
  /** Short human-readable title. Required, 1-200 chars. */
  title: string;
  /** Optional longer description. */
  description?: string;
  /** Whether the todo has been marked done. */
  done: boolean;
  /** ISO-8601 creation timestamp, set by the server. */
  createdAt: string;
  /** ISO-8601 last-updated timestamp, refreshed on every write. */
  updatedAt: string;
}

/** Payload for `POST /todos`. */
export interface CreateTodoInput {
  title: string;
  description?: string;
  done?: boolean;
}

/** Payload for `PUT /todos/{id}`. All fields optional — partial updates. */
export interface UpdateTodoInput {
  title?: string;
  description?: string;
  done?: boolean;
}

/** Standard error envelope returned by the API on 4xx/5xx. */
export interface ApiError {
  error: string;
  message: string;
}

/* -------------------------------------------------------------------------- */
/* Validation helpers                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Lightweight validation for `CreateTodoInput`. We avoid pulling in a schema
 * library here so the shared package stays dependency-free and tiny — both
 * the API and the mobile app can run this without bundling extra weight.
 */
export function validateCreateTodoInput(value: unknown): CreateTodoInput {
  if (typeof value !== "object" || value === null) {
    throw new Error("Body must be a JSON object");
  }
  const body = value as Record<string, unknown>;

  if (typeof body.title !== "string" || body.title.trim().length === 0) {
    throw new Error("`title` is required and must be a non-empty string");
  }
  if (body.title.length > 200) {
    throw new Error("`title` must be 200 characters or fewer");
  }
  if (body.description !== undefined && typeof body.description !== "string") {
    throw new Error("`description` must be a string when provided");
  }
  if (body.done !== undefined && typeof body.done !== "boolean") {
    throw new Error("`done` must be a boolean when provided");
  }

  return {
    title: body.title.trim(),
    description: body.description as string | undefined,
    done: body.done as boolean | undefined,
  };
}

/** Validation for `UpdateTodoInput`. At least one field must be present. */
export function validateUpdateTodoInput(value: unknown): UpdateTodoInput {
  if (typeof value !== "object" || value === null) {
    throw new Error("Body must be a JSON object");
  }
  const body = value as Record<string, unknown>;

  const out: UpdateTodoInput = {};

  if (body.title !== undefined) {
    if (typeof body.title !== "string" || body.title.trim().length === 0) {
      throw new Error("`title` must be a non-empty string when provided");
    }
    if (body.title.length > 200) {
      throw new Error("`title` must be 200 characters or fewer");
    }
    out.title = body.title.trim();
  }
  if (body.description !== undefined) {
    if (typeof body.description !== "string") {
      throw new Error("`description` must be a string when provided");
    }
    out.description = body.description;
  }
  if (body.done !== undefined) {
    if (typeof body.done !== "boolean") {
      throw new Error("`done` must be a boolean when provided");
    }
    out.done = body.done;
  }

  if (Object.keys(out).length === 0) {
    throw new Error("At least one field must be provided");
  }
  return out;
}
