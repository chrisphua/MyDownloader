/**
 * Shared form for creating and editing todos.
 *
 * Kept dumb on purpose: takes initial values + an `onSubmit`. The screens
 * own the data lifecycle (create vs update mutation, navigation on success).
 */
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export interface TodoFormValues {
  title: string;
  description?: string;
  done?: boolean;
}

interface Props {
  initial?: TodoFormValues;
  submitLabel: string;
  submitting?: boolean;
  onSubmit: (values: TodoFormValues) => void;
}

export function TodoForm({
  initial,
  submitLabel,
  submitting,
  onSubmit,
}: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Title is required");
      return;
    }
    if (trimmed.length > 200) {
      setError("Title must be 200 characters or fewer");
      return;
    }
    setError(null);
    onSubmit({
      title: trimmed,
      description: description.trim() ? description.trim() : undefined,
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
