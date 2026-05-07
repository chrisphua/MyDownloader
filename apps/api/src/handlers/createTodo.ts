/** POST /todos — create a new todo for the authenticated user. */
import { validateCreateTodoInput } from "@todo-app/types";
import {
  ValidationError,
  created,
  getUserId,
  parseJsonBody,
  withErrorHandling,
} from "../lib/http.js";
import { todoRepository } from "../repository/todoRepository.js";

export const handler = withErrorHandling(async (event) => {
  const userId = getUserId(event);
  const raw = parseJsonBody(event);
  let input;
  try {
    input = validateCreateTodoInput(raw);
  } catch (err) {
    throw new ValidationError(err instanceof Error ? err.message : "Invalid request body");
  }
  const todo = await todoRepository.create(userId, input);
  return created(todo);
});
