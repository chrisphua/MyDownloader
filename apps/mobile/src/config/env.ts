import { Platform } from "react-native";

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required env var ${name}. Copy apps/mobile/.env.example to apps/mobile/.env and fill it in.`,
    );
  }
  return value;
}

const rawApiUrl = required("EXPO_PUBLIC_API_URL", process.env.EXPO_PUBLIC_API_URL);

// Android emulators reach the host machine via 10.0.2.2, not localhost
const API_URL =
  Platform.OS === "android" && rawApiUrl.includes("localhost")
    ? rawApiUrl.replace("localhost", "10.0.2.2")
    : rawApiUrl;

export const env = { API_URL };
