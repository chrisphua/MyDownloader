import { useState, useMemo, useRef, useEffect } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import type { Priority } from "@todo-app/types";
import { useTheme } from "@/context/ThemeContext";

export interface TodoFormValues {
  title: string;
  description?: string;
  done?: boolean;
  priority?: Priority;
  startDate?: string;
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

function toDateObj(str: string): Date {
  const d = new Date(str + "T00:00:00");
  return isNaN(d.getTime()) ? new Date() : d;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface DateFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
}

function DateField({ label, value, onChange }: DateFieldProps) {
  const [showPicker, setShowPicker] = useState(false);
  const { colors } = useTheme();
  const webInputRef = useRef<TextInput>(null);

  // react-native-web doesn't forward the `type` prop and resets it on every
  // re-render, so we re-apply it after every render.
  useEffect(() => {
    if (Platform.OS === "web") {
      const node = webInputRef.current as unknown as HTMLInputElement | null;
      if (node) node.type = "date";
    }
  });

  const styles = useMemo(() => StyleSheet.create({
    label: { fontWeight: "600", marginTop: 8, color: colors.textSecondary },
    input: {
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      backgroundColor: colors.bg,
      color: colors.text,
    },
    dateBtn: {
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.bg,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    dateBtnText: { fontSize: 16, color: colors.text },
    dateBtnPlaceholder: { fontSize: 16, color: colors.textMuted },
    dateClear: { fontSize: 14, color: colors.textMuted, paddingLeft: 8 },
    dateConfirm: {
      alignSelf: "flex-end",
      paddingVertical: 6,
      paddingHorizontal: 16,
      marginTop: 4,
      backgroundColor: colors.accent,
      borderRadius: 6,
    },
    dateConfirmText: { color: "#fff", fontWeight: "600" },
  }), [colors]);

  if (Platform.OS === "web") {
    return (
      <View>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          ref={webInputRef}
          style={styles.input}
          value={value}
          onChangeText={onChange}
        />
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.dateBtn} onPress={() => setShowPicker(true)}>
        <Text style={value ? styles.dateBtnText : styles.dateBtnPlaceholder}>
          {value || "Select date"}
        </Text>
        {value ? (
          <Pressable
            hitSlop={8}
            onPress={() => { onChange(""); setShowPicker(false); }}
          >
            <Text style={styles.dateClear}>✕</Text>
          </Pressable>
        ) : null}
      </Pressable>
      {showPicker && (
        <DateTimePicker
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          value={value ? toDateObj(value) : new Date()}
          onChange={(_, date) => {
            if (Platform.OS === "android") setShowPicker(false);
            if (date) onChange(toDateStr(date));
          }}
        />
      )}
      {showPicker && Platform.OS === "ios" && (
        <Pressable style={styles.dateConfirm} onPress={() => setShowPicker(false)}>
          <Text style={styles.dateConfirmText}>Done</Text>
        </Pressable>
      )}
    </View>
  );
}

export function TodoForm({ initial, submitLabel, submitting, onSubmit }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [priority, setPriority] = useState<Priority | undefined>(initial?.priority);
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [error, setError] = useState<string | null>(null);
  const { colors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    flex: { flex: 1 },
    form: { padding: 16, gap: 8, paddingBottom: 40 },
    label: { fontWeight: "600", marginTop: 8, color: colors.textSecondary },
    input: {
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      backgroundColor: colors.bg,
      color: colors.text,
    },
    multiline: { minHeight: 80, textAlignVertical: "top" },
    priorityRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    priorityBtn: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: colors.borderLight,
    },
    priorityBtnSelected: { borderColor: colors.accent, backgroundColor: colors.accent + "18" },
    priorityBtnText: { fontSize: 13, color: colors.textMuted, fontWeight: "500" },
    priorityBtnTextSelected: { color: colors.accent, fontWeight: "700" },
    submit: {
      marginTop: 16,
      backgroundColor: colors.accent,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: "center",
    },
    submitDisabled: { opacity: 0.6 },
    submitText: { color: "#fff", fontWeight: "600", fontSize: 16 },
    error: { color: colors.danger },
  }), [colors]);

  function handleSubmit() {
    const trimmed = title.trim();
    if (!trimmed) { setError("Title is required"); return; }
    if (trimmed.length > 200) { setError("Title must be 200 characters or fewer"); return; }
    setError(null);
    onSubmit({
      title: trimmed,
      description: description.trim() || undefined,
      priority,
      startDate: startDate || undefined,
      dueDate: dueDate || undefined,
    });
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="What needs doing?"
          placeholderTextColor={colors.textMuted}
          autoFocus
          maxLength={200}
        />

        <Text style={styles.label}>Description (optional)</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={description}
          onChangeText={setDescription}
          placeholder="Notes, links, context..."
          placeholderTextColor={colors.textMuted}
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

        <DateField label="Start date (optional)" value={startDate} onChange={setStartDate} />
        <DateField label="Due date (optional)" value={dueDate} onChange={setDueDate} />

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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
