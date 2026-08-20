#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { BedrockAnthropicStack } from "../lib/bedrock-anthropic-stack";

const app = new cdk.App();

new BedrockAnthropicStack(app, "ProcurementBedrockAnthropicStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? process.env.AWS_REGION ?? "us-east-1",
  },
  description:
    "Lambda Function URL that streams Anthropic Claude responses via Amazon Bedrock",
});
