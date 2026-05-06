/** GET /todos/{id} — fetch a single todo by id. */
import { notFound, ok, pathParam, withErrorHandling } from "../lib/http.js";
import { todoRepository } from "../repository/todoRepository.js";

export const handler = withErrorHandling(async (event) => {
  const id = pathParam(event, "id");
  const todo = await todoRepository.getById(id);
  if (!todo) return notFound(`Todo ${id} not found`);
  return ok(todo);
});
