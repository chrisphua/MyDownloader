/** DELETE /todos/{id} — delete one of the authenticated user's todos. */
import { getUserId, noContent, notFound, pathParam, withErrorHandling } from "../lib/http.js";
import { todoRepository } from "../repository/todoRepository.js";

export const handler = withErrorHandling(async (event) => {
  const userId = getUserId(event);
  const id = pathParam(event, "id");
  const removed = await todoRepository.delete(userId, id);
  if (!removed) return notFound(`Todo ${id} not found`);
  return noContent();
});
