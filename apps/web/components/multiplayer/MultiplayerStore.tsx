"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useMultiplayerSocket } from "./useMultiplayerSocket";

type MultiplayerStoreValue = ReturnType<typeof useMultiplayerSocket>;

const MultiplayerStoreContext = createContext<MultiplayerStoreValue | null>(null);

type MultiplayerStoreProviderProps = {
  children: ReactNode;
};

export function MultiplayerStoreProvider({
  children,
}: MultiplayerStoreProviderProps) {
  const store = useMultiplayerSocket();

  return (
    <MultiplayerStoreContext.Provider value={store}>
      {children}
    </MultiplayerStoreContext.Provider>
  );
}

export function useMultiplayerStore() {
  const store = useContext(MultiplayerStoreContext);
  if (!store) {
    throw new Error("useMultiplayerStore must be used within MultiplayerStoreProvider");
  }
  return store;
}
