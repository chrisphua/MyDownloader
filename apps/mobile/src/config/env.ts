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
  USER_POOL_ID: required("EXPO_PUBLIC_USER_POOL_ID", process.env.EXPO_PUBLIC_USER_POOL_ID),
  USER_POOL_CLIENT_ID: required("EXPO_PUBLIC_USER_POOL_CLIENT_ID", process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID),
};
