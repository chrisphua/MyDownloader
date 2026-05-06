/** "Create todo" screen — presented as a modal on iOS. */
import { useRouter } from "expo-router";
import { Alert } from "react-native";
import { TodoForm } from "@/components/TodoForm";
import { useCreateTodo } from "@/hooks/useTodos";

export default function NewTodoScreen() {
  const router = useRouter();
  const create = useCreateTodo();

  return (
    <TodoForm
      submitLabel="Create"
      submitting={create.isPending}
      onSubmit={(values) => {
        create.mutate(values, {
          onSuccess: () => router.back(),
          onError: (err) =>
            Alert.alert("Couldn't create todo", err.message),
        });
      }}
    />
  );
}
