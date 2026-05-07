import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { Priority } from "@todo-app/types";

export interface TodoFormValues {
  title: string;
  description?: string;
  done?: boolean;
  priority?: Priority;
  dueDate?: string;
}

interface Props {
  initial?: TodoFormValues;
  submitLabel: string;
  submitting?: boolean;
  onSubmit: (values: TodoFormValues) => void;
}

const PRIORITIES: Priority[] = ["low", "medium", "high"];
const PRIORITY_COLOR: Record<Priority, string> = { low: "#888", medium: "#f5a623", high: "#c33" };
const DUE_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function TodoForm({ initial, submitLabel, submitting, onSubmit }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [priority, setPriority] = useState<Priority | undefined>(initial?.priority);
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    const trimmed = title.trim();
    if (!trimmed) { setError("Title is required"); return; }
    if (trimmed.length > 200) { setError("Title must be 200 characters or fewer"); return; }
    if (dueDate && !DUE_DATE_RE.test(dueDate)) {
      setError("Due date must be YYYY-MM-DD");
      return;
    }
    setError(null);
    onSubmit({
      title: trimmed,
      description: description.trim() || undefined,
      priority,
      dueDate: dueDate.trim() || undefined,
    });
  }

  return (
    <View style={styles.form}>
      <Text style={styles.label}>Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="What needs doing?"
        autoFocus
        maxLength={200}
      />

      <Text style={styles.label}>Description (optional)</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={description}
        onChangeText={setDescription}
        placeholder="Notes, links, context..."
        multiline
      />

      <Text style={styles.label}>Priority</Text>
      <View style={styles.priorityRow}>
        <Pressable
          style={[styles.priorityBtn, !priority && styles.priorityBtnSelected]}
          onPress={() => setPriority(undefined)}
        >
          <Text style={[styles.priorityBtnText, !priority && styles.priorityBtnTextSelected]}>
            None
          </Text>
        </Pressable>
        {PRIORITIES.map((p) => (
          <Pressable
            key={p}
            style={[styles.priorityBtn, priority === p && { borderColor: PRIORITY_COLOR[p], backgroundColor: PRIORITY_COLOR[p] + "18" }]}
            onPress={() => setPriority(p)}
          >
            <Text style={[styles.priorityBtnText, { color: PRIORITY_COLOR[p] }, priority === p && { fontWeight: "700" }]}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Due date (optional)</Text>
      <TextInput
        style={styles.input}
        value={dueDate}
        onChangeText={setDueDate}
        placeholder="YYYY-MM-DD"
        keyboardType="numeric"
        maxLength={10}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.submit, submitting && styles.submitDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>{submitLabel}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { padding: 16, gap: 8 },
  label: { fontWeight: "600", marginTop: 8, color: "#444" },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  multiline: { minHeight: 80, textAlignVertical: "top" },
  priorityRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  priorityBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#ddd",
  },
  priorityBtnSelected: { borderColor: "#2a7", backgroundColor: "#2a718" },
  priorityBtnText: { fontSize: 13, color: "#888", fontWeight: "500" },
  priorityBtnTextSelected: { color: "#2a7", fontWeight: "700" },
  submit: {
    marginTop: 16,
    backgroundColor: "#2a7",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  error: { color: "#c33" },
});
