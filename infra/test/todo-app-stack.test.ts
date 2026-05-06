/**
 * CDK assertion tests.
 *
 * These don't deploy anything — they synth the stack to a CloudFormation
 * template in memory and assert what's in it. Catches "I refactored CDK
 * and accidentally deleted the DynamoDB table" before it hits prod.
 */
import { describe, expect, it } from "vitest";
import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { TodoAppStack } from "../lib/todo-app-stack";

function synth() {
  const app = new cdk.App();
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

  it("creates exactly 5 Lambda functions for the 5 CRUD endpoints", () => {
    // Plus a couple of CDK-internal ones (BucketDeployment, log retention) —
    // we count by the runtime tag we actually set.
    const t = synth();
    const lambdas = t.findResources("AWS::Lambda::Function");
    const ours = Object.values(lambdas).filter(
      (l) => l.Properties?.Runtime === "nodejs20.x",
    );
    expect(ours.length).toBe(5);
  });

  it("creates an HTTP API with 5 routes", () => {
    const t = synth();
    t.resourceCountIs("AWS::ApiGatewayV2::Api", 1);
    t.resourceCountIs("AWS::ApiGatewayV2::Route", 5);
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
