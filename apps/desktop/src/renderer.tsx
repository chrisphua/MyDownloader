import React from "react";
import ReactDOM from "react-dom/client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { App } from "./App";
import "./index.css";

const persister = createSyncStoragePersister({ storage: window.localStorage });

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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 }}
    >
      <App />
    </PersistQueryClientProvider>
  </React.StrictMode>,
);
