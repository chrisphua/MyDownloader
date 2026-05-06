/** DELETE /todos/{id} — delete a todo. Idempotent-ish: 404 if not found. */
import {
  noContent,
  notFound,
  pathParam,
  withErrorHandling,
} from "../lib/http.js";
import { todoRepository } from "../repository/todoRepository.js";

export const handler = withErrorHandling(async (event) => {
  const id = pathParam(event, "id");
  const removed = await todoRepository.delete(id);
  if (!removed) return notFound(`Todo ${id} not found`);
  return noContent();
});
