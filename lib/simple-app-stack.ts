import * as cdk from 'aws-cdk-lib';
import * as lambdanode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export class SimpleAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Define the Lambda function with ARM architecture and Node.js 22
    const simpleFn = new lambdanode.NodejsFunction(this, "SimpleFn", {
      architecture: lambda.Architecture.ARM_64,  // Uses ARM for cost-efficiency
      runtime: lambda.Runtime.NODEJS_22_X,       // Node.js 22 runtime
      entry: `${__dirname}/../lambdas/simple.ts`, // Entry point for Lambda
      timeout: cdk.Duration.seconds(10),         // Timeout of 10 seconds
      memorySize: 128,                            // Allocated 128 MB memory
    });

    // Add Function URL (Public Access)
    const simpleFnURL = simpleFn.addFunctionUrl({
      // authType: lambda.FunctionUrlAuthType.NONE, // Public access
      authType: lambda.FunctionUrlAuthType.AWS_IAM, // Protected Access
      cors: {
        allowedOrigins: ["*"], // Allow all origins
      },
    });

    // Output the function URL
    new cdk.CfnOutput(this, "SimpleFunctionUrl", { value: simpleFnURL.url });
  }
}
