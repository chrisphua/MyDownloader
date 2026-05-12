const TOKEN_KEY = "auth_token";
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export async function getAccessToken(): Promise<string> {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) throw new Error("Not authenticated");
  return token;
}

export async function signIn(email: string, password: string): Promise<void> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json() as { token?: string; message?: string };
  if (!res.ok) throw new Error(data.message ?? "Sign-in failed");
  localStorage.setItem(TOKEN_KEY, data.token!);
}

export async function signUp(email: string, password: string): Promise<void> {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json() as { token?: string; message?: string };
  if (!res.ok) throw new Error(data.message ?? "Sign-up failed");
  localStorage.setItem(TOKEN_KEY, data.token!);
}

export function signOut(): void {
  localStorage.removeItem(TOKEN_KEY);
}
