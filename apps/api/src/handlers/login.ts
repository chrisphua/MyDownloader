import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { ok, parseJsonBody, ValidationError, withErrorHandling } from "../lib/http.js";
import { env } from "../lib/env.js";
import { userRepository } from "../repository/userRepository.js";

function validateInput(body: unknown): { email: string; password: string } {
  if (!body || typeof body !== "object") throw new ValidationError("Request body must be an object");
  const { email, password } = body as Record<string, unknown>;
  if (typeof email !== "string" || !email.trim()) throw new ValidationError("Email is required");
  if (typeof password !== "string" || !password) throw new ValidationError("Password is required");
  return { email: email.trim(), password };
}

export const handler = withErrorHandling(
  async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    const { email, password } = validateInput(parseJsonBody(event));

    const user = await userRepository.findByEmail(email);
    // Always run bcrypt compare to prevent timing attacks even when user not found.
    const valid = user
      ? await bcrypt.compare(password, user.passwordHash)
      : await bcrypt.compare(password, "$2b$12$invalidhashpadding000000000000000000000000000000000000000");
    if (!user || !valid) throw new ValidationError("Invalid email or password");

    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const token = await new SignJWT({ sub: user.userId, email: user.email })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(secret);

    return ok({ token, userId: user.userId });
  },
);
