import AsyncStorage from "@react-native-async-storage/async-storage";
import { env } from "@/config/env";

const TOKEN_KEY = "auth_token";
let memToken: string | null = null;

export async function initAuth(): Promise<void> {
  memToken = await AsyncStorage.getItem(TOKEN_KEY);
}

export function hasStoredToken(): boolean {
  return memToken !== null;
}

export async function getAccessToken(): Promise<string> {
  if (!memToken) throw new Error("Not authenticated");
  return memToken;
}

export async function signIn(email: string, password: string): Promise<void> {
  const res = await fetch(`${env.API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json() as { token?: string; message?: string };
  if (!res.ok) throw new Error(data.message ?? "Sign-in failed");
  memToken = data.token!;
  await AsyncStorage.setItem(TOKEN_KEY, memToken);
}

export async function signUp(email: string, password: string): Promise<void> {
  const res = await fetch(`${env.API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json() as { token?: string; message?: string };
  if (!res.ok) throw new Error(data.message ?? "Sign-up failed");
  memToken = data.token!;
  await AsyncStorage.setItem(TOKEN_KEY, memToken);
}

export async function signOut(): Promise<void> {
  memToken = null;
  await AsyncStorage.removeItem(TOKEN_KEY);
}
