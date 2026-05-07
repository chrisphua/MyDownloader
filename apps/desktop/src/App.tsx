import { useEffect, useState } from "react";
import type { Todo } from "@todo-app/types";
import { useCreateTodo, useDeleteTodo, useIsOnline, useTodos, useUpdateTodo } from "@/hooks/useTodos";
import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser, signOut } from "@/lib/auth";

type Filter = "all" | "active" | "done";

const PRIORITY_COLOR: Record<string, string> = { low: "#888", medium: "#f5a623", high: "#c33" };

export function App() {
  const [isSignedIn, setIsSignedIn] = useState(() => !!getCurrentUser());

  useEffect(() => {
    setIsSignedIn(!!getCurrentUser());
  }, []);

  if (!isSignedIn) {
    return <AuthForm onSignedIn={() => setIsSignedIn(true)} />;
  }

  return <TodoApp onSignOut={() => { signOut(); setIsSignedIn(false); }} />;
}

function TodoApp({ onSignOut }: { onSignOut: () => void }) {
  const isOnline = useIsOnline();
  const { data: todos, isLoading, error, refetch } = useTodos();
  const createTodo = useCreateTodo();
  const deleteTodo = useDeleteTodo();
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState<"low" | "medium" | "high" | "">("");
  const [newDueDate, setNewDueDate] = useState("");
  const [formError, setFormError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = (todos ?? []).filter((todo) => {
    const matchesSearch = !search || todo.title.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || (filter === "done" ? todo.done : !todo.done);
    return matchesSearch && matchesFilter;
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) { setFormError("Title is required"); return; }
    setFormError("");
    createTodo.mutate(
      {
        title,
        description: newDesc.trim() || undefined,
        priority: newPriority || undefined,
        dueDate: newDueDate.trim() || undefined,
      },
      {
        onSuccess: () => {
          setNewTitle("");
          setNewDesc("");
          setNewPriority("");
          setNewDueDate("");
        },
      },
    );
  }

  if (isLoading && !todos) return <div className="center"><div className="spinner" /></div>;
  if (error && !todos) return (
    <div className="center">
      <p className="error">{error.message}</p>
      <button onClick={() => refetch()}>Retry</button>
    </div>
  );

  return (
    <div className="layout">
      <header className="titlebar">
        <h1>Todos</h1>
        <button className="btn-signout" onClick={onSignOut}>Sign out</button>
      </header>
      {!isOnline && (
        <div className="offline-banner">Offline — changes will sync when connected</div>
      )}

      <form className="new-form" onSubmit={handleCreate}>
        <div className="new-form-fields">
          <input
            className="input"
            placeholder="New todo…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <input
            className="input"
            placeholder="Description (optional)"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />
          <input
            className="input input--date"
            placeholder="Due date (YYYY-MM-DD)"
            value={newDueDate}
            onChange={(e) => setNewDueDate(e.target.value)}
          />
          <div className="priority-select">
            {(["", "low", "medium", "high"] as const).map((p) => (
              <button
                key={p}
                type="button"
                className={`priority-btn${newPriority === p ? " priority-btn--active" : ""}${p ? ` priority-btn--${p}` : ""}`}
                onClick={() => setNewPriority(p)}
              >
                {p || "None"}
              </button>
            ))}
          </div>
        </div>
        {formError && <p className="field-error">{formError}</p>}
        <button type="submit" className="btn-primary" disabled={createTodo.isPending}>
          {createTodo.isPending ? "Adding…" : "Add"}
        </button>
      </form>

      <div className="search-filter">
        <input
          className="input search-input"
          placeholder="Search todos…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="filter-row">
          {(["all", "active", "done"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              className={`filter-btn${filter === f ? " filter-btn--active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <main className="list">
        {filtered.length === 0 && (
          <p className="empty">
            {todos?.length === 0 ? "No todos yet. Add one above." : "No todos match your search."}
          </p>
        )}
        {filtered.map((todo) => (
          <TodoRow key={todo.id} todo={todo} onDelete={() => deleteTodo.mutate(todo.id)} />
        ))}
      </main>
    </div>
  );
}

function TodoRow({ todo, onDelete }: { todo: Todo; onDelete: () => void }) {
  const update = useUpdateTodo(todo.id);
  const overdue = todo.dueDate && !todo.done && todo.dueDate < new Date().toISOString().slice(0, 10);

  return (
    <div className={`todo-row ${todo.done ? "done" : ""}`}>
      <button
        className={`checkbox ${todo.done ? "checked" : ""}`}
        onClick={() => update.mutate({ done: !todo.done })}
        aria-label={todo.done ? "Mark incomplete" : "Mark complete"}
      >
        {todo.done && "✓"}
      </button>
      <div className="todo-text">
        <span className="todo-title">{todo.title}</span>
        {todo.description && <span className="todo-desc">{todo.description}</span>}
        <div className="todo-meta">
          {todo.priority && (
            <span className="todo-badge" style={{ color: PRIORITY_COLOR[todo.priority] }}>
              {todo.priority}
            </span>
          )}
          {todo.dueDate && (
            <span className="todo-badge" style={{ color: overdue ? "#cc3333" : "#6e6e73" }}>
              Due {todo.dueDate}
            </span>
          )}
        </div>
      </div>
      <button className="btn-delete" onClick={onDelete} aria-label="Delete">
        ✕
      </button>
    </div>
  );
}
