import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateTodoInput, Todo, UpdateTodoInput } from "@todo-app/types";
import { api } from "@/api/client";

const keys = {
  all: ["todos"] as const,
  detail: (id: string) => ["todos", id] as const,
};

export function useTodos() {
  return useQuery<Todo[]>({ queryKey: keys.all, queryFn: api.listTodos });
}

export function useCreateTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTodoInput) => api.createTodo(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useUpdateTodo(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTodoInput) => api.updateTodo(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all });
      qc.invalidateQueries({ queryKey: keys.detail(id) });
    },
  });
}

export function useDeleteTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteTodo(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}
