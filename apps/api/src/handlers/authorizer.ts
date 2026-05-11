import { jwtVerify } from "jose";
import { env } from "../lib/env.js";

type AuthorizerEvent = {
  headers?: Record<string, string>;
};

type AuthorizerResponse = {
  isAuthorized: boolean;
  context?: Record<string, string>;
};

export async function handler(event: AuthorizerEvent): Promise<AuthorizerResponse> {
  try {
    const authHeader = event.headers?.authorization ?? event.headers?.Authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
    if (!token) return { isAuthorized: false };

    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);

    if (typeof payload.sub !== "string") return { isAuthorized: false };

    return {
      isAuthorized: true,
      context: {
        sub: payload.sub,
        email: typeof payload.email === "string" ? payload.email : "",
      },
    };
  } catch {
    return { isAuthorized: false };
  }
}
