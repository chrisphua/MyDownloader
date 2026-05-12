/**
 * Shared types for the Todo app.
 *
 * This is the single source of truth for the Todo domain model. Both the
 * backend (apps/api) and the frontend (apps/mobile) import from this package
 * so they cannot drift on field names, types, or shapes.
 */

export type Priority = "low" | "medium" | "high";

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
  /** Optional urgency level. */
  priority?: Priority;
  /** Optional start date in YYYY-MM-DD format. */
  startDate?: string;
  /** Optional due date in YYYY-MM-DD format. */
  dueDate?: string;
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
  priority?: Priority;
  startDate?: string;
  dueDate?: string;
}

/** Payload for `PUT /todos/{id}`. All fields optional — partial updates. */
export interface UpdateTodoInput {
  title?: string;
  description?: string;
  done?: boolean;
  priority?: Priority;
  startDate?: string;
  dueDate?: string;
}

/** Standard error envelope returned by the API on 4xx/5xx. */
export interface ApiError {
  error: string;
  message: string;
}

/* -------------------------------------------------------------------------- */
/* Validation helpers                                                         */
/* -------------------------------------------------------------------------- */

const VALID_PRIORITIES: Priority[] = ["low", "medium", "high"];
const DUE_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
  if (body.priority !== undefined && !VALID_PRIORITIES.includes(body.priority as Priority)) {
    throw new Error("`priority` must be 'low', 'medium', or 'high' when provided");
  }
  if (body.startDate !== undefined) {
    if (typeof body.startDate !== "string" || !DUE_DATE_RE.test(body.startDate)) {
      throw new Error("`startDate` must be a date string in YYYY-MM-DD format when provided");
    }
  }
  if (body.dueDate !== undefined) {
    if (typeof body.dueDate !== "string" || !DUE_DATE_RE.test(body.dueDate)) {
      throw new Error("`dueDate` must be a date string in YYYY-MM-DD format when provided");
    }
  }

  return {
    title: body.title.trim(),
    description: body.description as string | undefined,
    done: body.done as boolean | undefined,
    priority: body.priority as Priority | undefined,
    startDate: body.startDate as string | undefined,
    dueDate: body.dueDate as string | undefined,
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
  if (body.priority !== undefined) {
    if (!VALID_PRIORITIES.includes(body.priority as Priority)) {
      throw new Error("`priority` must be 'low', 'medium', or 'high' when provided");
    }
    out.priority = body.priority as Priority;
  }
  if (body.startDate !== undefined) {
    if (typeof body.startDate !== "string" || !DUE_DATE_RE.test(body.startDate)) {
      throw new Error("`startDate` must be a date string in YYYY-MM-DD format when provided");
    }
    out.startDate = body.startDate;
  }
  if (body.dueDate !== undefined) {
    if (typeof body.dueDate !== "string" || !DUE_DATE_RE.test(body.dueDate)) {
      throw new Error("`dueDate` must be a date string in YYYY-MM-DD format when provided");
    }
    out.dueDate = body.dueDate;
  }

  if (Object.keys(out).length === 0) {
    throw new Error("At least one field must be provided");
  }
  return out;
}
