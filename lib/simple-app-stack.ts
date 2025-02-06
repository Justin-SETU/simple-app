import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cdk from 'aws-cdk-lib';
import * as lambdanode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import * as custom from "aws-cdk-lib/custom-resources";
import { generateBatch } from "../shared/util";
import { movies } from "../seed/movies"; // Import seed data from movies.ts



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

    const moviesTable = new dynamodb.Table(this, "MoviesTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "id", type: dynamodb.AttributeType.NUMBER },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "Movies",
    });

    new custom.AwsCustomResource(this, "moviesddbInitData", {
      onCreate: {
        service: "DynamoDB",
        action: "batchWriteItem",
        parameters: {
          RequestItems: {
            [moviesTable.tableName]: generateBatch(movies),
          },
        },
        physicalResourceId: custom.PhysicalResourceId.of("moviesddbInitData"), //.of(Date.now().toString()),
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [moviesTable.tableArn],
      }),
    });

    const getMovieByIdFn = new lambdanode.NodejsFunction(
      this,
      "GetMovieByIdFn",
      {
        architecture: lambda.Architecture.ARM_64, // Uses ARM 64-bit architecture
        runtime: lambda.Runtime.NODEJS_22_X, // Uses Node.js 22
        entry: `${__dirname}/../lambdas/getMovieById.ts`, // Path to the Lambda function code
        timeout: cdk.Duration.seconds(10), // Execution time limit
        memorySize: 128, // Allocated memory
        environment: {
          TABLE_NAME: moviesTable.tableName, // Passes table name to Lambda
          REGION: 'eu-west-1', // AWS region
        },
      }
    );    

    const getMovieByIdURL = getMovieByIdFn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE, // No authentication required
      cors: {
        allowedOrigins: ["*"], // Allows requests from any domain
      },
    });
    

    moviesTable.grantReadData(getMovieByIdFn)

    new cdk.CfnOutput(this, "Get Movie Function Url", { value: getMovieByIdURL.url });

    // Output the function URL
    new cdk.CfnOutput(this, "SimpleFunctionUrl", { value: simpleFnURL.url });
  }
}
