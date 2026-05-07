import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { onlineManager, QueryClient, focusManager } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { getCurrentUser, initAuth } from "@/lib/auth";

onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(!!state.isConnected)),
);

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  throttleTime: 1000,
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      retry: 1,
      networkMode: "offlineFirst",
    },
    mutations: {
      networkMode: "offlineFirst",
    },
  },
});

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [authReady, setAuthReady] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) =>
      focusManager.setFocused(state === "active"),
    );
    return () => sub.remove();
  }, []);

  // Populate in-memory token cache from AsyncStorage, then check auth state.
  useEffect(() => {
    initAuth().then(() => {
      setIsSignedIn(!!getCurrentUser());
      setAuthReady(true);
    });
  }, []);

  // Redirect to sign-in if unauthenticated, or to app if already signed in.
  useEffect(() => {
    if (!authReady) return;
    const onAuthScreen =
      segments[0] === "sign-in" ||
      segments[0] === "sign-up" ||
      segments[0] === "confirm";
    if (!isSignedIn && !onAuthScreen) {
      router.replace("/sign-in");
    } else if (isSignedIn && onAuthScreen) {
      router.replace("/");
    }
  }, [authReady, isSignedIn, segments, router]);

  if (!authReady) return null;

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 }}
    >
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
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
          <Stack.Screen name="sign-up" options={{ headerShown: false }} />
          <Stack.Screen name="confirm" options={{ headerShown: false }} />
        </Stack>
      </SafeAreaProvider>
    </PersistQueryClientProvider>
  );
}
