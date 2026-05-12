/**
 * CDK assertion tests.
 *
 * These don't deploy anything — they synth the stack to a CloudFormation
 * template in memory and assert what's in it. Catches "I refactored CDK
 * and accidentally deleted the DynamoDB table" before it hits prod.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { TodoAppStack } from "../lib/todo-app-stack";

// Replace NodejsFunction with a plain Function so esbuild never runs.
// Tests assert CloudFormation resource shapes, not Lambda bundle content.
vi.mock("aws-cdk-lib/aws-lambda-nodejs", async () => {
  const cdk = await import("aws-cdk-lib");
  const { aws_lambda: lambda } = cdk;
  type Props = ConstructorParameters<typeof lambda.Function>[2] & {
    entry?: string;
  };
  return {
    NodejsFunction: class extends lambda.Function {
      constructor(scope: cdk.Stack, id: string, props: Props) {
        super(scope, id, {
          runtime: props.runtime,
          handler: props.handler ?? "index.handler",
          code: lambda.Code.fromInline("/* stub */"),
          memorySize: props.memorySize,
          timeout: props.timeout,
          environment: props.environment,
        });
      }
    },
  };
});

// CDK's BucketDeployment checks the asset path exists at synth time.
// Create a placeholder so tests pass without a real Expo web build.
const WEB_BUILD_DIR = path.resolve(__dirname, "../../apps/mobile/dist");
let createdPlaceholder = false;

beforeAll(() => {
  if (!fs.existsSync(WEB_BUILD_DIR)) {
    fs.mkdirSync(WEB_BUILD_DIR, { recursive: true });
    fs.writeFileSync(path.join(WEB_BUILD_DIR, "index.html"), "");
    createdPlaceholder = true;
  }
});

afterAll(() => {
  if (createdPlaceholder) {
    fs.rmSync(WEB_BUILD_DIR, { recursive: true, force: true });
  }
});

function synth() {
  const app = new cdk.App({ context: { jwtSecret: "test-secret" } });
  const stack = new TodoAppStack(app, "TestStack");
  return Template.fromStack(stack);
}

describe("TodoAppStack", () => {
  it("creates a DynamoDB table with id as the partition key", () => {
    const t = synth();
    t.hasResourceProperties("AWS::DynamoDB::Table", {
      KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
      AttributeDefinitions: Match.arrayWith([
        { AttributeName: "id", AttributeType: "S" },
      ]),
      BillingMode: "PAY_PER_REQUEST",
    });
  });

  it("creates exactly 8 Lambda functions (5 CRUD + register + login + authorizer)", () => {
    // Plus a couple of CDK-internal ones (BucketDeployment, log retention) —
    // we count by the runtime tag we actually set.
    const t = synth();
    const lambdas = t.findResources("AWS::Lambda::Function");
    const ours = Object.values(lambdas).filter(
      (l) => l.Properties?.Runtime === "nodejs20.x",
    );
    expect(ours.length).toBe(8);
  });

  it("creates an HTTP API with 7 routes (5 CRUD + 2 auth)", () => {
    const t = synth();
    t.resourceCountIs("AWS::ApiGatewayV2::Api", 1);
    t.resourceCountIs("AWS::ApiGatewayV2::Route", 7);
  });

  it("creates an S3 bucket for the web build, encrypted and private", () => {
    const t = synth();
    t.hasResourceProperties("AWS::S3::Bucket", {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });

  it("creates a CloudFront distribution fronting the bucket", () => {
    const t = synth();
    t.resourceCountIs("AWS::CloudFront::Distribution", 1);
  });

  it("exposes ApiUrl and WebUrl as outputs", () => {
    const t = synth();
    const outputs = t.findOutputs("*");
    expect(Object.keys(outputs)).toEqual(
      expect.arrayContaining(["ApiUrl", "WebUrl"]),
    );
  });
});
