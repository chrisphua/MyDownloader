import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { created, parseJsonBody, ValidationError, withErrorHandling } from "../lib/http.js";
import { env } from "../lib/env.js";
import { userRepository } from "../repository/userRepository.js";

function validateInput(body: unknown): { email: string; password: string } {
  if (!body || typeof body !== "object") throw new ValidationError("Request body must be an object");
  const { email, password } = body as Record<string, unknown>;
  if (typeof email !== "string" || !email.includes("@")) throw new ValidationError("Valid email is required");
  if (typeof password !== "string" || password.length < 8) throw new ValidationError("Password must be at least 8 characters");
  return { email: email.trim(), password };
}

export const handler = withErrorHandling(
  async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    const { email, password } = validateInput(parseJsonBody(event));

    const existing = await userRepository.findByEmail(email);
    if (existing) throw new ValidationError("Email already registered");

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await userRepository.create(email, passwordHash);

    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const token = await new SignJWT({ sub: user.userId, email: user.email })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(secret);

    return created({ token, userId: user.userId });
  },
);
