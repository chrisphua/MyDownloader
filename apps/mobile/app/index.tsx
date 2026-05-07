import { Link, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { Todo } from "@todo-app/types";

import {
  useDeleteTodo,
  useIsOnline,
  useTodos,
  useUpdateTodo,
} from "@/hooks/useTodos";
import { signOut } from "@/lib/auth";

type Filter = "all" | "active" | "done";

export default function ListScreen() {
  const router = useRouter();
  const navigation = useNavigation();

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => { signOut(); router.replace("/sign-in"); }}
          style={{ marginRight: 16 }}
          hitSlop={10}
        >
          <Text style={{ color: "#2a7", fontWeight: "600" }}>Sign out</Text>
        </Pressable>
      ),
    });
  }, [navigation, router]);
  const isOnline = useIsOnline();
  const { data, isLoading, isRefetching, refetch, error } = useTodos();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = (data ?? []).filter((todo) => {
    const matchesSearch =
      !search || todo.title.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === "all" || (filter === "done" ? todo.done : !todo.done);
    return matchesSearch && matchesFilter;
  });

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
        data={filtered}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListHeaderComponent={
          <View style={styles.controls}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search todos…"
              placeholderTextColor="#aaa"
              value={search}
              onChangeText={setSearch}
              clearButtonMode="while-editing"
            />
            <View style={styles.filterRow}>
              {(["all", "active", "done"] as Filter[]).map((f) => (
                <Pressable
                  key={f}
                  style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
                  onPress={() => setFilter(f)}
                >
                  <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            {data?.length === 0
              ? "No todos yet. Tap + to add the first one."
              : "No todos match your search."}
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
        <TodoMeta todo={todo} />
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

function TodoMeta({ todo }: { todo: Todo }) {
  const parts: { label: string; color: string }[] = [];

  if (todo.priority) {
    const colors: Record<string, string> = { low: "#888", medium: "#f5a623", high: "#c33" };
    parts.push({ label: todo.priority, color: colors[todo.priority] ?? "#888" });
  }

  if (todo.dueDate) {
    const overdue = !todo.done && todo.dueDate < new Date().toISOString().slice(0, 10);
    parts.push({ label: `Due ${todo.dueDate}`, color: overdue ? "#c33" : "#888" });
  }

  if (parts.length === 0) return null;

  return (
    <View style={styles.metaRow}>
      {parts.map((p, i) => (
        <Text key={i} style={[styles.metaText, { color: p.color }]}>
          {p.label}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 12 },
  list: { padding: 16, paddingBottom: 96 },
  sep: { height: 12 },
  empty: { textAlign: "center", color: "#666", marginTop: 32 },

  controls: { marginBottom: 12, gap: 8 },
  searchInput: {
    backgroundColor: "#f0f0f2",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    color: "#222",
  },
  filterRow: { flexDirection: "row", gap: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: "#f0f0f2" },
  filterBtnActive: { backgroundColor: "#2a7" },
  filterText: { fontSize: 13, color: "#555", fontWeight: "500" },
  filterTextActive: { color: "#fff" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f6f6f8",
    padding: 12,
    borderRadius: 10,
    gap: 12,
  },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: "#888", alignItems: "center", justifyContent: "center" },
  checkboxDone: { borderColor: "#2a7", backgroundColor: "#2a7" },
  checkmark: { color: "#fff", fontWeight: "700" },
  rowText: { flex: 1 },
  title: { fontSize: 16, color: "#222" },
  titleDone: { color: "#888", textDecorationLine: "line-through" },
  subtitle: { color: "#666", marginTop: 2, fontSize: 13 },
  metaRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  metaText: { fontSize: 11, fontWeight: "500", textTransform: "capitalize" },
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
  offlineBanner: { backgroundColor: "#f5a623", paddingVertical: 6, paddingHorizontal: 16 },
  offlineText: { color: "#fff", fontSize: 13, textAlign: "center" },
  error: { color: "#c33", textAlign: "center" },
  retry: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6, backgroundColor: "#eee" },
  retryText: { color: "#222" },
});
