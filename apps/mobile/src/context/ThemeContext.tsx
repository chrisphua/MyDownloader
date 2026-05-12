import { createContext, useContext, useEffect, useState } from "react";
import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { darkColors, lightColors, type AppColors } from "@/theme";

type ThemeMode = "light" | "dark" | "system";

interface ThemeContextValue {
  dark: boolean;
  colors: AppColors;
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  dark: false,
  colors: lightColors,
  mode: "system",
  setMode: () => {},
});

const STORAGE_KEY = "theme_mode";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const systemDark = Appearance.getColorScheme() === "dark";

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === "light" || saved === "dark" || saved === "system") {
        setModeState(saved);
      }
    });
  }, []);

  function setMode(m: ThemeMode) {
    setModeState(m);
    void AsyncStorage.setItem(STORAGE_KEY, m);
  }

  const dark = mode === "system" ? systemDark : mode === "dark";
  const colors = dark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ dark, colors, mode, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
