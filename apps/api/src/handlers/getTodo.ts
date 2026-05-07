/** GET /todos/{id} — fetch one of the authenticated user's todos. */
import { getUserId, notFound, ok, pathParam, withErrorHandling } from "../lib/http.js";
import { todoRepository } from "../repository/todoRepository.js";

export const handler = withErrorHandling(async (event) => {
  const userId = getUserId(event);
  const id = pathParam(event, "id");
  const todo = await todoRepository.getById(userId, id);
  if (!todo) return notFound(`Todo ${id} not found`);
  return ok(todo);
});
