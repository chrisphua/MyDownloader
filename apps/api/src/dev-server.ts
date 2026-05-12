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
import { createReadStream, mkdtempSync, readdirSync, readFileSync } from "fs";
import { rm } from "fs/promises";
import { tmpdir } from "os";
import { resolve, dirname, join } from "path";
import { spawn } from "child_process";
import { EventEmitter } from "events";
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
    } catch { /* ignore malformed JWT */ }
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

// ── YouTube downloader (local dev only) ─────────────────────────────────────

interface YtJob {
  emitter: EventEmitter;
  tmpDir: string;
  format: string;
  filename?: string;
  done: boolean;
  error?: string;
}

const ytJobs = new Map<string, YtJob>();

// Start a download job — returns { jobId } immediately.
app.post("/youtube/start", (req: Request, res: Response) => {
  const { url, format = "mp3", resolution = "" } = req.body as { url?: string; format?: string; resolution?: string };
  if (!url) { res.status(400).json({ message: "Missing url" }); return; }

  const jobId = Math.random().toString(36).slice(2, 10);
  const tmpDir = mkdtempSync(join(tmpdir(), "ytdl-"));
  const emitter = new EventEmitter();
  const job: YtJob = { emitter, tmpDir, format, done: false };
  ytJobs.set(jobId, job);

  const args = [
    "--output", join(tmpDir, "%(title)s.%(ext)s"),
    "--no-playlist", "--newline", "--no-colors",
  ];
  if (format === "mp3") {
    args.push("--extract-audio", "--audio-format", "mp3", "--audio-quality", "0");
  } else {
    const fmtStr = resolution
      ? `bestvideo[height<=${resolution}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${resolution}]`
      : "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best";
    args.push("--format", fmtStr, "--merge-output-format", "mp4");
  }
  args.push(url);

  const proc = spawn("yt-dlp", args);
  const pctRe = /\[download\]\s+([\d.]+)%\s+of\s+[\d.]+\S+\s+at\s+([\d.]+\S+)\s+ETA\s+(\S+)/;
  const postRe = /\[(ExtractAudio|Metadata|EmbedThumbnail|ThumbnailsConvertor|Merger|VideoConvertor)\]/;

  function parseLine(line: string) {
    const m = line.match(pctRe);
    if (m) { emitter.emit("progress", { percent: parseFloat(m[1] ?? "0"), speed: m[2] ?? "", eta: m[3] ?? "" }); return; }
    if (postRe.test(line)) { emitter.emit("progress", { percent: 100, speed: "", eta: "Processing…" }); }
  }

  proc.stdout.on("data", (d: Buffer) => d.toString().split("\n").forEach(parseLine));
  proc.stderr.on("data", (d: Buffer) => d.toString().split("\n").forEach(parseLine));

  proc.on("close", async (code) => {
    if (code !== 0) {
      job.done = true; job.error = "yt-dlp exited with error";
      emitter.emit("error", job.error);
      return;
    }
    const files = readdirSync(tmpDir);
    if (!files.length) {
      job.done = true; job.error = "No output file produced";
      emitter.emit("error", job.error);
      return;
    }
    job.filename = files[0]!;
    job.done = true;
    emitter.emit("done");
  });

  res.json({ jobId });
});

// SSE stream — emits `progress`, `done`, or `error` events.
app.get("/youtube/progress/:jobId", (req: Request, res: Response) => {
  const job = ytJobs.get(req.params["jobId"] ?? "");
  if (!job) { res.status(404).json({ message: "Job not found" }); return; }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (event: string, data: unknown) =>
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  if (job.done) {
    if (job.error) { send("error", { message: job.error }); } else { send("done", {}); }
    res.end();
    return;
  }

  const onProgress = (d: unknown) => send("progress", d);
  const onDone = () => { send("done", {}); res.end(); };
  const onError = (msg: string) => { send("error", { message: msg }); res.end(); };

  job.emitter.on("progress", onProgress);
  job.emitter.once("done", onDone);
  job.emitter.once("error", onError);
  req.on("close", () => {
    job.emitter.off("progress", onProgress);
    job.emitter.off("done", onDone);
    job.emitter.off("error", onError);
  });
});

// Serve the completed file, then clean up.
app.get("/youtube/file/:jobId", async (req: Request, res: Response) => {
  const job = ytJobs.get(req.params["jobId"] ?? "");
  if (!job?.done || !job.filename) { res.status(404).json({ message: "File not ready" }); return; }

  const filePath = join(job.tmpDir, job.filename);
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(job.filename)}`);
  res.setHeader("Content-Type", job.format === "mp3" ? "audio/mpeg" : "video/mp4");
  const stream = createReadStream(filePath);
  stream.pipe(res);
  stream.on("close", async () => {
    ytJobs.delete(req.params["jobId"] ?? "");
    await rm(job.tmpDir, { recursive: true, force: true });
  });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
  console.log(`Swagger UI:  http://localhost:${port}/docs`);
  console.log(`Using DynamoDB table: ${process.env.TODOS_TABLE_NAME}`);
});
