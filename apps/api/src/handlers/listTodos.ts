/** GET /todos — returns every todo, newest first. */
import { ok, withErrorHandling } from "../lib/http.js";
import { todoRepository } from "../repository/todoRepository.js";

export const handler = withErrorHandling(async () => {
  const todos = await todoRepository.list();
  return ok(todos);
});
