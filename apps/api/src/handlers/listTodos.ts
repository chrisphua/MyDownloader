/** GET /todos — returns the authenticated user's todos, newest first. */
import { getUserId, ok, withErrorHandling } from "../lib/http.js";
import { todoRepository } from "../repository/todoRepository.js";

export const handler = withErrorHandling(async (event) => {
  const userId = getUserId(event);
  const todos = await todoRepository.list(userId);
  return ok(todos);
});
