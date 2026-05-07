import { useState } from "react";
import type { Todo } from "@todo-app/types";
import { useCreateTodo, useDeleteTodo, useIsOnline, useTodos, useUpdateTodo } from "@/hooks/useTodos";

export function App() {
  const isOnline = useIsOnline();
  const { data: todos, isLoading, error, refetch } = useTodos();
  const createTodo = useCreateTodo();
  const deleteTodo = useDeleteTodo();
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [formError, setFormError] = useState("");

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) { setFormError("Title is required"); return; }
    setFormError("");
    createTodo.mutate(
      { title, description: newDesc.trim() || undefined },
      { onSuccess: () => { setNewTitle(""); setNewDesc(""); } },
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
        </div>
        {formError && <p className="field-error">{formError}</p>}
        <button type="submit" className="btn-primary" disabled={createTodo.isPending}>
          {createTodo.isPending ? "Adding…" : "Add"}
        </button>
      </form>

      <main className="list">
        {todos?.length === 0 && (
          <p className="empty">No todos yet. Add one above.</p>
        )}
        {todos?.map((todo) => (
          <TodoRow key={todo.id} todo={todo} onDelete={() => deleteTodo.mutate(todo.id)} />
        ))}
      </main>
    </div>
  );
}

function TodoRow({ todo, onDelete }: { todo: Todo; onDelete: () => void }) {
  const update = useUpdateTodo(todo.id);

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
      </div>
      <button className="btn-delete" onClick={onDelete} aria-label="Delete">
        ✕
      </button>
    </div>
  );
}
