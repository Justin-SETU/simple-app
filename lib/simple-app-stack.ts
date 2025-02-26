import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cdk from 'aws-cdk-lib';
import * as lambdanode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import * as custom from "aws-cdk-lib/custom-resources";
import { generateBatch } from "../shared/util";
import { movies, movieCasts } from "../seed/movies"; // Import seed data from movies.ts

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

    // Define Movies DynamoDB Table
    const moviesTable = new dynamodb.Table(this, "MoviesTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "id", type: dynamodb.AttributeType.NUMBER },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "Movies",
    });

    // Define Movie Casts DynamoDB Table
    const movieCastsTable = new dynamodb.Table(this, "MovieCastTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "movieId", type: dynamodb.AttributeType.NUMBER },
      sortKey: { name: "actorName", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "MovieCast",
    });

    // Add Local Secondary Index on Movie Cast Table for Role Name
    movieCastsTable.addLocalSecondaryIndex({
      indexName: "roleIx",
      sortKey: { name: "roleName", type: dynamodb.AttributeType.STRING },
    });

    // Initialize data in DynamoDB Tables using Custom Resource
    new custom.AwsCustomResource(this, "moviesddbInitData", {
      onCreate: {
        service: "DynamoDB",
        action: "batchWriteItem",
        parameters: {
          RequestItems: {
            [moviesTable.tableName]: generateBatch(movies),
            [movieCastsTable.tableName]: generateBatch(movieCasts),  // Added movie cast data
          },
        },
        physicalResourceId: custom.PhysicalResourceId.of("moviesddbInitData"), // Custom ID
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [moviesTable.tableArn, movieCastsTable.tableArn],  // Includes movie cast
      }),
    });

    // Define Lambda function to get Movie by ID
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

    // Create a Function URL for Get Movie by ID Lambda
    const getMovieByIdURL = getMovieByIdFn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE, // No authentication required
      cors: {
        allowedOrigins: ["*"], // Allows requests from any domain
      },
    });
    
    // Output Get Movie by ID Function URL
    new cdk.CfnOutput(this, "Get Movie Function Url", { value: getMovieByIdURL.url });

    // Define Lambda function to get all Movies
    const getAllMoviesFn = new lambdanode.NodejsFunction(
      this,
      "GetAllMoviesFn",
      {
        architecture: lambda.Architecture.ARM_64, // Uses ARM 64-bit architecture
        runtime: lambda.Runtime.NODEJS_22_X, // Uses Node.js 22
        entry: `${__dirname}/../lambdas/getAllMovies.ts`, // Path to the Lambda function
        timeout: cdk.Duration.seconds(10), // Execution time limit
        memorySize: 128, // Allocated memory
        environment: {
          TABLE_NAME: moviesTable.tableName, // Passes table name to Lambda
          REGION: "eu-west-1", // AWS region
        },
      }
    );
    
    // Create a Function URL for Get All Movies Lambda
    const getAllMoviesURL = getAllMoviesFn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE, // No authentication required
      cors: {
        allowedOrigins: ["*"], // Allows requests from any domain
      },
    });

    // Define Lambda function to get Movie Cast Members by Movie ID
    const getMovieCastMembersFn = new lambdanode.NodejsFunction(
      this,
      "GetCastMemberFn",
      {
        architecture: lambda.Architecture.ARM_64, // Uses ARM 64-bit architecture
        runtime: lambda.Runtime.NODEJS_22_X, // Uses Node.js 22
        entry: `${__dirname}/../lambdas/getMovieCastMembers.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          CAST_TABLE_NAME: movieCastsTable.tableName, // Passes movie cast table name to Lambda
          REGION: "eu-west-1", // AWS region
        },
      }
    );

    // Create a Function URL for Get Movie Cast Members Lambda
    const getMovieCastMembersURL = getMovieCastMembersFn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE, // No authentication required
      cors: {
        allowedOrigins: ["*"], // Allows requests from any domain
      },
    });

    // Grant read access to the Movies and Movie Cast Tables
    moviesTable.grantReadData(getAllMoviesFn);
    movieCastsTable.grantReadData(getMovieCastMembersFn);

    // Output Get All Movies Function URL
    new cdk.CfnOutput(this, "GetAllMoviesFunctionUrl", { value: getAllMoviesURL.url });

    // Output Simple Function URL
    new cdk.CfnOutput(this, "SimpleFunctionUrl", { value: simpleFnURL.url });

    // Output Get Movie Cast Members Function URL
    new cdk.CfnOutput(this, "Get Movie Cast Url", { value: getMovieCastMembersURL.url });
  }
}
