# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Security Testing

**Always read `docs/security-testing-spec.md` before writing any test file.**
Every test file must include the relevant sections from that spec:
- Missing auth → 401
- Cross-user access (IDOR) → 404
- Injection payloads safely handled
- `userId` absent from response bodies
- Stack traces absent from error responses
- Unexpected fields ignored (no mass assignment)

## Commands

```bash
# Install all workspace dependencies
npm install

# Build the shared types package (required before running api or mobile)
npm run build:types

# Run all tests across all workspaces
npm test --workspaces --if-present

# Run tests for a single workspace
npm run test --workspace @todo-app/api
npm run test --workspace @todo-app/infra

# Typecheck all workspaces
npm run lint --workspaces --if-present

# Local dev: start DynamoDB Local (port 8000, data persisted in .dynamodb-data/)
docker compose up -d

# Create the local DynamoDB table and seed data (one-time after docker compose up)
npm run db:bootstrap --workspace @todo-app/api

# Run the API locally on http://localhost:3000
npm run dev --workspace @todo-app/api

# Run the Expo dev server (press i/a/w for iOS/Android/web)
npm run start --workspace @todo-app/mobile
```

## Architecture

npm workspaces monorepo with three apps and a shared types package:

```
apps/api      — Lambda handlers (AWS serverless backend)
apps/mobile   — Expo React Native app (iOS, Android, Web)
packages/types — Shared TypeScript types and validation (no runtime deps)
infra/        — AWS CDK stack (single stack, all resources)
```

**Request flow:** Expo app → API Gateway HTTP API (v2) → Lambda (one function per endpoint) → DynamoDB

**Local dev substitute:** Docker DynamoDB Local on :8000 + Express shim (`apps/api/src/dev-server.ts`) on :3000 that translates HTTP into the API Gateway v2 event shape the handlers expect. No AWS credentials needed.

### Key conventions

**API layer (`apps/api`)**
- Handlers never access DynamoDB directly — all DDB calls go through `src/repository/todoRepository.ts`. If you ever need to swap the database, that is the one file to replace.
- All Lambda handlers are wrapped with `withErrorHandling` from `src/lib/http.ts`. Throw `ValidationError` for 400s; return `notFound()` for 404s; any other throw becomes a 500.
- All HTTP response shapes (JSON headers, CORS, status codes) come from helpers in `src/lib/http.ts` (`ok`, `created`, `noContent`, `badRequest`, `notFound`, `serverError`). Handlers return these directly.
- Each Lambda function is granted only the minimum DynamoDB IAM permissions it needs (e.g., `listFn` gets `grantReadData` only).

**Shared types (`packages/types`)**
- Single source of truth for the `Todo` type and `*Input` DTOs. Both the API and the mobile app import from here.
- Must remain dependency-free so it bundles without extra weight in the mobile app.
- `validateCreateTodoInput` / `validateUpdateTodoInput` are intentionally hand-rolled (no schema library) for this reason.

**Mobile layer (`apps/mobile`)**
- Screens never call `fetch` directly. All data fetching and mutations go through React Query hooks in `src/hooks/useTodos.ts`.
- `src/api/client.ts` holds the raw `fetch` wrappers.
- Navigation is file-system-based via expo-router (`app/` directory mirrors URL structure).

**Infrastructure (`infra`)**
- All AWS resources live in a single CDK stack (`infra/lib/todo-app-stack.ts`): DynamoDB table, 5 Lambda functions, HTTP API, S3 bucket, CloudFront distribution.
- Adding a new endpoint: add a handler in `apps/api/src/handlers/`, register it as a `NodejsFunction` + route in `infra/lib/todo-app-stack.ts`, add tests in `apps/api/src/handlers/handlers.test.ts`.
- `RemovalPolicy.DESTROY` is set on DynamoDB for this demo — change to `RETAIN` before production use.

## TypeScript setup

`tsconfig.base.json` at the repo root defines shared compiler options. Each workspace extends it in its own `tsconfig.json`. The API compiles to ESM (`.js` extensions on imports are required even in `.ts` source files).
