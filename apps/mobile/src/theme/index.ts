export const palette = {
  accent: "#2a7",
  danger: "#c33",
  warning: "#f5a623",
} as const;

export const lightColors = {
  bg: "#fff",
  surface: "#f6f6f8",
  surfaceAlt: "#f0f0f2",
  border: "#e0e0e4",
  borderLight: "#ddd",
  header: "#f8f8fa",
  text: "#222",
  textSecondary: "#666",
  textMuted: "#999",
  ...palette,
};

export const darkColors = {
  bg: "#000",
  surface: "#1c1c1e",
  surfaceAlt: "#2c2c2e",
  border: "#3a3a3c",
  borderLight: "#3a3a3c",
  header: "#1c1c1e",
  text: "#fff",
  textSecondary: "#ababab",
  textMuted: "#555",
  ...palette,
};

export type AppColors = typeof lightColors;
