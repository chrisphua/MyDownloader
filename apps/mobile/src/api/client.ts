import type { ApiError, CreateTodoInput, Todo, UpdateTodoInput } from "@todo-app/types";
import { env } from "@/config/env";
import { getAccessToken } from "@/lib/auth";

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
  const token = await getAccessToken();
  const res = await fetch(`${env.API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
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
