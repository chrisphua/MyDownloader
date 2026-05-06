import type { ApiError, CreateTodoInput, Todo, UpdateTodoInput } from "@todo-app/types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiError | undefined,
    fallback: string,
  ) {
    super(body?.message ?? fallback);
    this.name = "ApiRequestError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const parsed = text ? (JSON.parse(text) as unknown) : undefined;

  if (!res.ok) {
    throw new ApiRequestError(res.status, parsed as ApiError | undefined, `Request failed: ${res.status}`);
  }
  return parsed as T;
}

export const api = {
  listTodos: () => request<Todo[]>("/todos"),
  getTodo: (id: string) => request<Todo>(`/todos/${id}`),
  createTodo: (input: CreateTodoInput) =>
    request<Todo>("/todos", { method: "POST", body: JSON.stringify(input) }),
  updateTodo: (id: string, input: UpdateTodoInput) =>
    request<Todo>(`/todos/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  deleteTodo: (id: string) =>
    request<void>(`/todos/${id}`, { method: "DELETE" }),
};

export { ApiRequestError };
