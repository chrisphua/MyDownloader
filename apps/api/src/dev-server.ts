/**
 * Local development server.
 *
 * Mounts the same Lambda handlers behind an Express server so you can hit
 * `http://localhost:3000` from Postman, curl, or the mobile app — without
 * needing SAM CLI or AWS credentials configured.
 *
 * Recommended local setup (offline, no AWS account needed):
 *   1. From repo root:    docker compose up -d        # DynamoDB Local on :8000
 *   2. From apps/api:     cp .env.example .env        # one-time
 *   3. From apps/api:     npm run db:bootstrap        # creates the table
 *   4. From apps/api:     npm run dev                 # API on :3000
 *
 * `dotenv/config` is loaded at the top so the .env file is picked up
 * automatically — no shell exports required.
 */
import "dotenv/config";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import express, { type Request, type Response } from "express";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import swaggerUi from "swagger-ui-express";
import { parse } from "yaml";

import { handler as listTodos } from "./handlers/listTodos.js";
import { handler as getTodo } from "./handlers/getTodo.js";
import { handler as createTodo } from "./handlers/createTodo.js";
import { handler as updateTodo } from "./handlers/updateTodo.js";
import { handler as deleteTodo } from "./handlers/deleteTodo.js";
import { handler as register } from "./handlers/register.js";
import { handler as login } from "./handlers/login.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const swaggerSpec = parse(readFileSync(resolve(__dirname, "../openapi.yaml"), "utf-8"));

const app = express();
app.use(express.json());
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Handle CORS preflight for all routes (mirrors the headers in lib/http.ts).
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

function extractSub(authHeader?: string): string {
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const payload = authHeader.slice(7).split(".")[1] ?? "";
      const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as Record<string, unknown>;
      if (typeof claims.sub === "string") return claims.sub;
    } catch (_) { /* ignore malformed JWT */ }
  }
  return process.env.DEV_USER_ID ?? "local-dev-user";
}

/**
 * Adapter: turn an Express request into the API Gateway v2 event shape that
 * our handlers expect, then translate the handler's response back to Express.
 * This is intentionally minimal — it's a dev tool, not production.
 */
function adapt(
  fn: (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyResultV2>,
) {
  return async (req: Request, res: Response) => {
    const event = {
      version: "2.0",
      routeKey: `${req.method} ${req.path}`,
      rawPath: req.path,
      rawQueryString: "",
      headers: req.headers as Record<string, string>,
      requestContext: {
        authorizer: { jwt: { claims: { sub: extractSub(req.headers.authorization) } } },
      } as unknown as APIGatewayProxyEventV2["requestContext"],
      body: req.body ? JSON.stringify(req.body) : undefined,
      pathParameters: req.params,
      isBase64Encoded: false,
    } as unknown as APIGatewayProxyEventV2;

    const result = (await fn(event)) as Exclude<APIGatewayProxyResultV2, string>;
    if (result.headers) {
      for (const [key, value] of Object.entries(result.headers)) {
        res.setHeader(key, String(value));
      }
    }
    res.status(result.statusCode ?? 200);
    res.send(result.body ?? "");
  };
}

// Auth routes — no JWT needed, use a simple adapter without user injection.
app.post("/auth/register", adapt(register));
app.post("/auth/login", adapt(login));

app.get("/todos", adapt(listTodos));
app.get("/todos/:id", adapt(getTodo));
app.post("/todos", adapt(createTodo));
app.put("/todos/:id", adapt(updateTodo));
app.delete("/todos/:id", adapt(deleteTodo));

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
  console.log(`Swagger UI:  http://localhost:${port}/docs`);
  console.log(`Using DynamoDB table: ${process.env.TODOS_TABLE_NAME}`);
});
