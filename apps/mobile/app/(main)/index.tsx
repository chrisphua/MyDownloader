import { Link, useRouter } from "expo-router";
import { useMemo, useState } from "react";
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
import type { Todo } from "@todo-app/types";
import { useTheme } from "@/context/ThemeContext";
import type { AppColors } from "@/theme";

import {
  useDeleteTodo,
  useIsOnline,
  useTodos,
  useUpdateTodo,
} from "@/hooks/useTodos";

type Filter = "all" | "active" | "done";

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: c.bg },
    center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 12 },
    list: { padding: 16, paddingBottom: 96 },
    sep: { height: 12 },
    empty: { textAlign: "center", color: c.textSecondary, marginTop: 32 },

    controls: { marginBottom: 12, gap: 8 },
    searchInput: {
      backgroundColor: c.surfaceAlt,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
      fontSize: 15,
      color: c.text,
    },
    filterRow: { flexDirection: "row", gap: 8 },
    filterBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: c.surfaceAlt },
    filterBtnActive: { backgroundColor: c.accent },
    filterText: { fontSize: 13, color: c.textSecondary, fontWeight: "500" },
    filterTextActive: { color: "#fff" },

    row: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.surface,
      padding: 12,
      borderRadius: 10,
      gap: 12,
    },
    checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: c.textMuted, alignItems: "center", justifyContent: "center" },
    checkboxDone: { borderColor: c.accent, backgroundColor: c.accent },
    checkmark: { color: "#fff", fontWeight: "700" },
    rowText: { flex: 1 },
    title: { fontSize: 16, color: c.text },
    titleDone: { color: c.textMuted, textDecorationLine: "line-through" },
    subtitle: { color: c.textSecondary, marginTop: 2, fontSize: 13 },
    metaRow: { flexDirection: "row", gap: 8, marginTop: 4 },
    metaText: { fontSize: 11, fontWeight: "500", textTransform: "capitalize" },
    delete: { color: c.danger, fontSize: 18, paddingHorizontal: 4 },

    fab: {
      position: "absolute",
      right: 24,
      bottom: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: c.accent,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
    fabIcon: { color: "#fff", fontSize: 28, fontWeight: "300", lineHeight: 30 },
    offlineBanner: { backgroundColor: c.warning, paddingVertical: 6, paddingHorizontal: 16 },
    offlineText: { color: "#fff", fontSize: 13, textAlign: "center" },
    error: { color: c.danger, textAlign: "center" },
    retry: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6, backgroundColor: c.surfaceAlt },
    retryText: { color: c.text },
  });
}

export default function ListScreen() {
  const router = useRouter();
  const isOnline = useIsOnline();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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
              placeholderTextColor={colors.textMuted}
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
          <TodoRow todo={item} onPress={() => router.push(`/todo/${item.id}`)} colors={colors} styles={styles} />
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

type Styles = ReturnType<typeof makeStyles>;

function TodoRow({ todo, onPress, colors, styles }: { todo: Todo; onPress: () => void; colors: AppColors; styles: Styles }) {
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
        <TodoMeta todo={todo} colors={colors} styles={styles} />
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

function TodoMeta({ todo, colors, styles }: { todo: Todo; colors: AppColors; styles: Styles }) {
  const parts: { label: string; color: string }[] = [];

  if (todo.priority) {
    const priorityColors: Record<string, string> = { low: colors.textMuted, medium: colors.warning, high: colors.danger };
    parts.push({ label: todo.priority, color: priorityColors[todo.priority] ?? colors.textMuted });
  }

  if (todo.startDate) {
    parts.push({ label: `Start ${todo.startDate}`, color: colors.textMuted });
  }
  if (todo.dueDate) {
    const overdue = !todo.done && todo.dueDate < new Date().toISOString().slice(0, 10);
    parts.push({ label: `Due ${todo.dueDate}`, color: overdue ? colors.danger : colors.textMuted });
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
