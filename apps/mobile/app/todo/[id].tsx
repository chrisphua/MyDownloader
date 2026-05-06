/** Edit-an-existing-todo screen. */
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { TodoForm } from "@/components/TodoForm";
import { useTodo, useUpdateTodo } from "@/hooks/useTodos";

export default function EditTodoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const todoQuery = useTodo(id ?? "");
  const update = useUpdateTodo(id ?? "");

  if (todoQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }
  if (todoQuery.error || !todoQuery.data) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>
          {todoQuery.error?.message ?? "Todo not found"}
        </Text>
      </View>
    );
  }

  return (
    <TodoForm
      initial={{
        title: todoQuery.data.title,
        description: todoQuery.data.description,
      }}
      submitLabel="Save"
      submitting={update.isPending}
      onSubmit={(values) => {
        update.mutate(values, {
          onSuccess: () => router.back(),
          onError: (err) => Alert.alert("Couldn't save todo", err.message),
        });
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  error: { color: "#c33", textAlign: "center" },
});
