#!/usr/bin/env node
/**
 * CDK app entry point.
 *
 * Why one stack: this app is small enough that splitting infrastructure
 * across multiple stacks adds friction without buying anything. When the
 * project grows, peel off (e.g.) a `WebHostingStack` separately.
 */
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { TodoAppStack } from "../lib/todo-app-stack";

const app = new cdk.App();

new TodoAppStack(app, "TodoAppStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  description: "Todo app: DynamoDB + Lambda + HTTP API + S3/CloudFront web host",
});
