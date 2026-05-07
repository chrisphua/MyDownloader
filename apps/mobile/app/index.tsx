/**
 * List screen — the home of the app.
 *
 * Shows all todos newest-first, lets you toggle done, delete, and navigate
 * to the edit screen. Tap the FAB to create a new one.
 */
import { Link, useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Todo } from "@todo-app/types";

import {
  useDeleteTodo,
  useIsOnline,
  useTodos,
  useUpdateTodo,
} from "@/hooks/useTodos";

export default function ListScreen() {
  const router = useRouter();
  const isOnline = useIsOnline();
  const { data, isLoading, isRefetching, refetch, error } = useTodos();

  if (isLoading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Couldn't load todos: {error.message}</Text>
        <Pressable style={styles.retry} onPress={() => refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.flex} edges={["bottom"]}>
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>Offline — changes will sync when connected</Text>
        </View>
      )}
      <FlatList
        data={data ?? []}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No todos yet. Tap + to add the first one.
          </Text>
        }
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        renderItem={({ item }) => (
          <TodoRow todo={item} onPress={() => router.push(`/todo/${item.id}`)} />
        )}
      />
      <Link href="/todo/new" asChild>
        <Pressable style={styles.fab} accessibilityLabel="New todo">
          <Text style={styles.fabIcon}>+</Text>
        </Pressable>
      </Link>
    </SafeAreaView>
  );
}

function TodoRow({ todo, onPress }: { todo: Todo; onPress: () => void }) {
  const update = useUpdateTodo(todo.id);
  const remove = useDeleteTodo();

  return (
    <Pressable onPress={onPress} style={styles.row}>
      <Pressable
        hitSlop={10}
        onPress={() => update.mutate({ done: !todo.done })}
        style={[styles.checkbox, todo.done && styles.checkboxDone]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: todo.done }}
      >
        {todo.done ? <Text style={styles.checkmark}>✓</Text> : null}
      </Pressable>
      <View style={styles.rowText}>
        <Text style={[styles.title, todo.done && styles.titleDone]}>
          {todo.title}
        </Text>
        {todo.description ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {todo.description}
          </Text>
        ) : null}
      </View>
      <Pressable
        hitSlop={10}
        onPress={() => remove.mutate(todo.id)}
        accessibilityLabel="Delete todo"
      >
        <Text style={styles.delete}>✕</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 12,
  },
  list: { padding: 16, paddingBottom: 96 },
  sep: { height: 12 },
  empty: { textAlign: "center", color: "#666", marginTop: 64 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f6f6f8",
    padding: 12,
    borderRadius: 10,
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#888",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxDone: {
    borderColor: "#2a7",
    backgroundColor: "#2a7",
  },
  checkmark: { color: "#fff", fontWeight: "700" },
  rowText: { flex: 1 },
  title: { fontSize: 16, color: "#222" },
  titleDone: { color: "#888", textDecorationLine: "line-through" },
  subtitle: { color: "#666", marginTop: 2 },
  delete: { color: "#c33", fontSize: 18, paddingHorizontal: 4 },

  fab: {
    position: "absolute",
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#2a7",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  fabIcon: { color: "#fff", fontSize: 28, fontWeight: "300", lineHeight: 30 },

  offlineBanner: {
    backgroundColor: "#f5a623",
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  offlineText: { color: "#fff", fontSize: 13, textAlign: "center" },
  error: { color: "#c33", textAlign: "center" },
  retry: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: "#eee",
  },
  retryText: { color: "#222" },
});
