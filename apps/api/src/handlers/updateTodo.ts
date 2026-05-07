/** PUT /todos/{id} — partial update of an authenticated user's todo. */
import { validateUpdateTodoInput } from "@todo-app/types";
import {
  ValidationError,
  getUserId,
  notFound,
  ok,
  parseJsonBody,
  pathParam,
  withErrorHandling,
} from "../lib/http.js";
import { todoRepository } from "../repository/todoRepository.js";

export const handler = withErrorHandling(async (event) => {
  const userId = getUserId(event);
  const id = pathParam(event, "id");
  const raw = parseJsonBody(event);
  let input;
  try {
    input = validateUpdateTodoInput(raw);
  } catch (err) {
    throw new ValidationError(err instanceof Error ? err.message : "Invalid request body");
  }
  const updated = await todoRepository.update(userId, id, input);
  if (!updated) return notFound(`Todo ${id} not found`);
  return ok(updated);
});
