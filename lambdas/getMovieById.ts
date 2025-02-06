import { Handler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const ddbDocClient = createDDbDocClient();

//Handle incoming http requests
export const handler: Handler = async (event, context) => {
  try {
    console.log("Event: ", JSON.stringify(event)); // Logs the entire event object
    const queryString = event?.queryStringParameters;
    const movieId = queryString ? parseInt(queryString.movieId) : undefined;

    //Validate the Movie ID
    if (!movieId) {
      return {
        statusCode: 404,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ Message: "Missing movie Id" }),
      };
    }

    //Fetch Movie from DynamoDB
    const commandOutput = await ddbDocClient.send(
      new GetCommand({
        TableName: process.env.TABLE_NAME,
        Key: { id: movieId },
      })
    );

    //Logging DynamoDB Response
    console.log('GetCommand response: ', commandOutput) 

    //Handle Invalid Movie IDs
    if (!commandOutput.Item) {
      return {
        statusCode: 404,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ Message: "Invalid movie Id" }),
      };
    }

    //Return the Movie Data
    const body = {
      data: commandOutput.Item,
    };

    // Return Response
    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    };
  } 
  catch (error: any) {
    console.log(JSON.stringify(error));
    return {
      statusCode: 500,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ error }),
    };
  }
};

function createDDbDocClient() {
    const ddbClient = new DynamoDBClient({ region: process.env.REGION });
  
    const marshallOptions = {
      convertEmptyValues: true, // Converts empty strings to NULL
      removeUndefinedValues: true, // Removes undefined values
      convertClassInstanceToMap: true, // Converts class instances into Maps
    };
  
    const unmarshallOptions = {
      wrapNumbers: false, // Prevents numeric values from being wrapped as strings
    };
  
    const translateConfig = { marshallOptions, unmarshallOptions };
  
    return DynamoDBDocumentClient.from(ddbClient, translateConfig);
  }
