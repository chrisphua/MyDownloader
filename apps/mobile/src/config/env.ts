/**
 * Centralized client-side env access.
 *
 * Expo inlines `EXPO_PUBLIC_*` env vars into the bundle at build time. This
 * module fails fast with a clear message if a required value is missing,
 * which is friendlier than `undefined` showing up deep in a fetch call.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required env var ${name}. Copy apps/mobile/.env.example to apps/mobile/.env and fill it in.`,
    );
  }
  return value;
}

export const env = {
  API_URL: required("EXPO_PUBLIC_API_URL", process.env.EXPO_PUBLIC_API_URL),
};
