import {
  onlineManager,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import type { CreateTodoInput, Todo, UpdateTodoInput } from "@todo-app/types";
import { api } from "@/api/client";

const keys = {
  all: ["todos"] as const,
  detail: (id: string) => ["todos", id] as const,
};

export function useIsOnline() {
  return useSyncExternalStore(
    onlineManager.subscribe.bind(onlineManager),
    () => onlineManager.isOnline(),
    () => true,
  );
}

export function useTodos() {
  return useQuery<Todo[]>({
    queryKey: keys.all,
    queryFn: api.listTodos,
    networkMode: "offlineFirst",
    refetchInterval: 30_000,
  });
}

export function useTodo(id: string) {
  return useQuery<Todo>({
    queryKey: keys.detail(id),
    queryFn: () => api.getTodo(id),
    enabled: Boolean(id),
    networkMode: "offlineFirst",
  });
}

export function useCreateTodo() {
  const qc = useQueryClient();
  return useMutation({
    networkMode: "offlineFirst",
    mutationFn: (input: CreateTodoInput) => api.createTodo(input),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: keys.all });
      const previous = qc.getQueryData<Todo[]>(keys.all);
      const optimistic: Todo = {
        id: `temp-${Date.now()}`,
        title: input.title,
        description: input.description,
        done: input.done ?? false,
        priority: input.priority,
        dueDate: input.dueDate,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      qc.setQueryData<Todo[]>(keys.all, (old) => [optimistic, ...(old ?? [])]);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      qc.setQueryData(keys.all, ctx?.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useUpdateTodo(id: string) {
  const qc = useQueryClient();
  return useMutation({
    networkMode: "offlineFirst",
    mutationFn: (input: UpdateTodoInput) => api.updateTodo(id, input),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: keys.all });
      await qc.cancelQueries({ queryKey: keys.detail(id) });
      const previousList = qc.getQueryData<Todo[]>(keys.all);
      const previousDetail = qc.getQueryData<Todo>(keys.detail(id));
      const now = new Date().toISOString();
      qc.setQueryData<Todo[]>(keys.all, (old) =>
        old?.map((t) => (t.id === id ? { ...t, ...input, updatedAt: now } : t)) ?? [],
      );
      qc.setQueryData<Todo>(keys.detail(id), (old) =>
        old ? { ...old, ...input, updatedAt: now } : old,
      );
      return { previousList, previousDetail };
    },
    onError: (_err, _vars, ctx) => {
      qc.setQueryData(keys.all, ctx?.previousList);
      qc.setQueryData(keys.detail(id), ctx?.previousDetail);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: keys.all });
      void qc.invalidateQueries({ queryKey: keys.detail(id) });
    },
  });
}

export function useDeleteTodo() {
  const qc = useQueryClient();
  return useMutation({
    networkMode: "offlineFirst",
    mutationFn: (id: string) => api.deleteTodo(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: keys.all });
      const previous = qc.getQueryData<Todo[]>(keys.all);
      qc.setQueryData<Todo[]>(keys.all, (old) => old?.filter((t) => t.id !== id) ?? []);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      qc.setQueryData(keys.all, ctx?.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}
