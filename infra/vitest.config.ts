import { defineConfig } from "vitest/config";

// CDK's NodejsFunction bundles handlers with esbuild via child_process.
// That doesn't play well with vitest's default worker-thread pool, so
// run infra tests in forked processes — slightly slower, but reliable.
export default defineConfig({
  test: {
    pool: "forks",
    testTimeout: 30_000,
  },
});
