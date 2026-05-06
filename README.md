# Todo App

A simple, full-stack CRUD todo application demonstrating a clean,
maintainable architecture across mobile (iOS/Android), web, and a
serverless AWS backend.

## Architecture at a glance

```
┌─────────────────────────────┐         ┌──────────────────────────┐
│  Expo App (apps/mobile)     │  HTTPS  │  API Gateway (HTTP API)  │
│  - iOS, Android, Web        │ ──────► │                          │
│  - One TypeScript codebase  │         └────────────┬─────────────┘
└─────────────────────────────┘                      │
                                                     ▼
                                         ┌──────────────────────┐
                                         │  Lambda functions    │
                                         │  (apps/api)          │
                                         │  - list / get        │
                                         │  - create / update   │
                                         │  - delete            │
                                         └──────────┬───────────┘
                                                    │
                                                    ▼
                                         ┌──────────────────────┐
                                         │  DynamoDB            │
                                         │  Table: Todos        │
                                         └──────────────────────┘
```

A shared `packages/types` workspace holds the canonical `Todo` type so the
frontend and backend cannot drift on field names or shapes.

## Repo layout

```
todo-app/
├── apps/
│   ├── api/             Lambda handlers (one file per endpoint)
│   │   ├── src/handlers/
│   │   ├── src/repository/      DDB access, swap-to-replace
│   │   ├── src/lib/             http helpers, env, ddb client
│   │   ├── src/dev-server.ts    Express shim for local dev
│   │   └── scripts/             db bootstrap for DynamoDB Local
│   └── mobile/          Expo (React Native) app
│       ├── app/                 expo-router screens
│       └── src/                 hooks, components, api client
├── packages/
│   └── types/           Shared TypeScript types and DTOs
├── infra/               AWS CDK app
├── docker-compose.yml   DynamoDB Local for offline dev
└── .github/workflows/   CI/CD pipeline
```

## Prerequisites

- Node.js 20+ (`nvm use 20` if you have nvm)
- Docker (for DynamoDB Local during local dev)
- AWS CLI configured (only needed when you want to deploy)
- iOS Simulator (Xcode) and/or Android Emulator (Android Studio) for mobile

## The full local dev loop (offline, no AWS account needed)

From the repo root:

```bash
# 1. Install everything
npm install
npm run build --workspace @todo-app/types

# 2. Start DynamoDB Local in Docker
docker compose up -d

# 3. Configure the API and seed the table
cp apps/api/.env.example apps/api/.env
npm run db:bootstrap --workspace @todo-app/api

# 4. Run the API on http://localhost:3000
PATH="/usr/local/opt/node@22/bin:$PATH" npm run dev --workspace @todo-app/api -- --clear
```

In a second terminal:

```bash
# 5. Configure the mobile app
cp apps/mobile/.env.example apps/mobile/.env

# 6. Run the Expo dev server
PATH="/usr/local/opt/node@20/bin:$PATH" npm run start --workspace @todo-app/mobile -- --clear
```

In Expo's menu, press:

- `i` — open iOS Simulator
- `a` — open Android Emulator
- `w` — open in your browser at `http://localhost:8081`

Or scan the printed QR code with **Expo Go** on a physical phone (same Wi-Fi).

> **Phone on real device note:** `localhost` from your phone's perspective is
> *the phone itself*, not your laptop. Replace `localhost` in
> `apps/mobile/.env` with your laptop's LAN IP (e.g. `http://192.168.1.42:3000`)
> when running on a physical device.

## Running tests

```bash
npm test --workspaces --if-present
```

This runs:

- **31** validation edge-case tests (`@todo-app/types`)
- **26** repository tests with mocked DynamoDB (`@todo-app/api`)
- **25** handler tests covering 200/201/204/400/404/500 paths (`@todo-app/api`)
- **6** CDK assertion tests verifying the synthesized CloudFormation (`@todo-app/infra`)

## Deploying to AWS

One-time, on a fresh AWS account/region:

```bash
npx cdk bootstrap --app "npx ts-node --prefer-ts-exts infra/bin/todo-app.ts"
```

Then any time:

```bash
# Build the web bundle (CDK uploads it to S3)
EXPO_PUBLIC_API_URL=<temporarily anything> \
  npm run build:web --workspace @todo-app/mobile

# Deploy the stack
npm run deploy --workspace @todo-app/infra
```

CDK prints these outputs:

- `ApiUrl`        — base URL of your HTTP API
- `WebUrl`        — public CloudFront URL
- `WebBucketName` — S3 bucket holding the web build
- `TodosTableName`

For the first deploy, repeat the build with `EXPO_PUBLIC_API_URL` pointing at
the real `ApiUrl` and `cdk deploy` again so the web bundle hits the right API.

## CI/CD

`.github/workflows/ci.yml` runs on every push and PR:

1. **Test job**: install, build types, typecheck all workspaces, run tests.
2. **Deploy job** (main branch only): build web bundle, assume an AWS role
   via OIDC, run `cdk deploy`.

Required GitHub secrets:

- `AWS_ROLE_TO_ASSUME` — IAM role ARN with deploy permissions
- `AWS_REGION`         — e.g. `us-east-1`

Required GitHub variable:

- `EXPO_PUBLIC_API_URL` — set after the first deploy

## How to extend it (for the next developer)

- **Adding a field to Todo** → edit `packages/types/src/index.ts`. TypeScript
  flags every place that needs to change.
- **Adding a new endpoint** → drop a handler in `apps/api/src/handlers/`,
  register it in `infra/lib/todo-app-stack.ts`. Add a test in
  `apps/api/src/handlers/handlers.test.ts`.
- **Changing the database** → all DDB access lives in
  `apps/api/src/repository/todoRepository.ts`. Swap that one file.
- **Frontend data fetching** → `apps/mobile/src/hooks/useTodos.ts` is the
  React Query layer. Screens never call `fetch` directly.

## Cost expectations

A quiet Todo app on this stack typically costs **under $1/month**:

- DynamoDB: PAY_PER_REQUEST, scales to zero
- Lambda + API Gateway: free tier covers ~1M requests/month
- S3 + CloudFront: pennies for static hosting

Don't put Lambda in a VPC unless you need to — a NAT Gateway is ~$32/month
sitting idle.

## Tearing it all down

```bash
npm run destroy --workspace @todo-app/infra
```

The DynamoDB table is configured with `RemovalPolicy.DESTROY` for this demo
— change it to `RETAIN` in `infra/lib/todo-app-stack.ts` before going to prod.
