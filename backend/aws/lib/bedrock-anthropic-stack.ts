import * as path from "path";
import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

export interface BedrockAnthropicStackProps extends cdk.StackProps {
  /** Bedrock model id or inference profile id for Anthropic Claude */
  modelId?: string;
}

/**
 * Deploys a Node.js Lambda with Function URL (RESPONSE_STREAM) that calls
 * Anthropic Claude on Amazon Bedrock and streams tokens back to the client.
 *
 * The main Python app still uses the Anthropic SDK directly for now;
 * wire BEDROCK_LAMBDA_URL later when ready to switch.
 */
export class BedrockAnthropicStack extends cdk.Stack {
  public readonly functionUrl: string;

  constructor(scope: Construct, id: string, props: BedrockAnthropicStackProps = {}) {
    super(scope, id, props);

    const region = cdk.Stack.of(this).region;
    const account = cdk.Stack.of(this).account;

    // Default: Claude Sonnet 4 on Bedrock (US inference profile).
    // Override at deploy: -c modelId=anthropic.claude-3-5-sonnet-20241022-v2:0
    const modelId =
      props.modelId ??
      (this.node.tryGetContext("modelId") as string | undefined) ??
      "us.anthropic.claude-sonnet-4-6";

    const lambdaDir = path.join(__dirname, "..", "lambda");

    const fn = new lambda.Function(this, "BedrockAnthropicStreamFn", {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "index.handler",
      // Run `npm install` inside backend/aws/lambda before `cdk deploy`
      code: lambda.Code.fromAsset(lambdaDir, {
        exclude: ["*.md", ".gitignore"],
      }),
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      architecture: lambda.Architecture.X86_64,
      environment: {
        BEDROCK_MODEL_ID: modelId,
        BEDROCK_REGION: region,
      },
      description: "Streams Anthropic Claude responses from Amazon Bedrock",
    });

    // Permission to invoke Anthropic foundation models + inference profiles on Bedrock
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        sid: "BedrockInvokeAnthropic",
        effect: iam.Effect.ALLOW,
        actions: [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
          "bedrock:Converse",
          "bedrock:ConverseStream",
        ],
        resources: [
          `arn:aws:bedrock:${region}::foundation-model/anthropic.*`,
          `arn:aws:bedrock:*::foundation-model/anthropic.*`,
          `arn:aws:bedrock:${region}:${account}:inference-profile/*`,
          `arn:aws:bedrock:${region}:${account}:application-inference-profile/*`,
        ],
      }),
    );

    const url = fn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      invokeMode: lambda.InvokeMode.RESPONSE_STREAM,
      cors: {
        allowedOrigins: ["*"],
        allowedMethods: [lambda.HttpMethod.POST],
        allowedHeaders: ["*"],
        maxAge: cdk.Duration.hours(1),
      },
    });

    this.functionUrl = url.url;

    new cdk.CfnOutput(this, "BedrockAnthropicFunctionUrl", {
      value: url.url,
      description:
        "POST streaming Lambda Function URL for Bedrock Anthropic (wire into app later)",
      exportName: "ProcurementBedrockAnthropicFunctionUrl",
    });

    new cdk.CfnOutput(this, "BedrockModelId", {
      value: modelId,
      description: "Bedrock Anthropic model / inference profile id",
    });

    new cdk.CfnOutput(this, "LambdaFunctionName", {
      value: fn.functionName,
    });
  }
}
