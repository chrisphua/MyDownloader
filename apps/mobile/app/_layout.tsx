/**
 * Root layout — wraps every screen.
 *
 * Two responsibilities:
 *   1. Provide the React Query client to the whole app.
 *   2. Render the expo-router stack (each screen lives in app/*.tsx).
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Refetch on focus is great on web, less ideal on phones — keep
            // it on by default and override per-query when needed.
            staleTime: 5_000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: "#f8f8fa" },
            headerTitleStyle: { fontWeight: "600" },
          }}
        >
          <Stack.Screen name="index" options={{ title: "Todos" }} />
          <Stack.Screen
            name="todo/new"
            options={{ title: "New todo", presentation: "modal" }}
          />
          <Stack.Screen name="todo/[id]" options={{ title: "Edit todo" }} />
        </Stack>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
