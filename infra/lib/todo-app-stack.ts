import * as path from "node:path";
import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
} from "aws-cdk-lib";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import { HttpJwtAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";

const API_DIR = path.resolve(__dirname, "../../apps/api/src");
const WEB_BUILD_DIR = path.resolve(__dirname, "../../apps/mobile/dist");

export class TodoAppStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    /* ---------------------------------------------------------------- */
    /* Cognito User Pool                                                */
    /* ---------------------------------------------------------------- */
    const userPool = new cognito.UserPool(this, "TodoUserPool", {
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireUppercase: false,
        requireDigits: true,
        requireSymbols: false,
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const userPoolClient = new cognito.UserPoolClient(this, "TodoUserPoolClient", {
      userPool,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
    });

    const jwtAuthorizer = new HttpJwtAuthorizer(
      "CognitoAuthorizer",
      `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}`,
      { jwtAudience: [userPoolClient.userPoolClientId] },
    );

    /* ---------------------------------------------------------------- */
    /* DynamoDB                                                         */
    /* ---------------------------------------------------------------- */
    const todosTable = new dynamodb.Table(this, "TodosTable", {
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // GSI so we can query all todos belonging to a user efficiently.
    todosTable.addGlobalSecondaryIndex({
      indexName: "userId-index",
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "createdAt", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    /* ---------------------------------------------------------------- */
    /* Lambda functions (one per handler)                               */
    /* ---------------------------------------------------------------- */
    const sharedFnProps: Omit<import("aws-cdk-lib/aws-lambda-nodejs").NodejsFunctionProps, "entry"> = {
      runtime: Runtime.NODEJS_20_X,
      memorySize: 512,
      timeout: Duration.seconds(10),
      environment: {
        TODOS_TABLE_NAME: todosTable.tableName,
        TODOS_USER_INDEX: "userId-index",
      },
      bundling: {
        externalModules: [],
        minify: true,
        sourceMap: true,
      },
    };

    const listFn = new NodejsFunction(this, "ListTodosFn", {
      ...sharedFnProps,
      entry: path.join(API_DIR, "handlers/listTodos.ts"),
    });
    const getFn = new NodejsFunction(this, "GetTodoFn", {
      ...sharedFnProps,
      entry: path.join(API_DIR, "handlers/getTodo.ts"),
    });
    const createFn = new NodejsFunction(this, "CreateTodoFn", {
      ...sharedFnProps,
      entry: path.join(API_DIR, "handlers/createTodo.ts"),
    });
    const updateFn = new NodejsFunction(this, "UpdateTodoFn", {
      ...sharedFnProps,
      entry: path.join(API_DIR, "handlers/updateTodo.ts"),
    });
    const deleteFn = new NodejsFunction(this, "DeleteTodoFn", {
      ...sharedFnProps,
      entry: path.join(API_DIR, "handlers/deleteTodo.ts"),
    });

    todosTable.grantReadData(listFn);
    todosTable.grantReadData(getFn);
    todosTable.grantWriteData(createFn);
    todosTable.grantReadWriteData(updateFn);
    todosTable.grantWriteData(deleteFn);

    /* ---------------------------------------------------------------- */
    /* HTTP API                                                         */
    /* ---------------------------------------------------------------- */
    const httpApi = new apigwv2.HttpApi(this, "TodoHttpApi", {
      corsPreflight: {
        allowOrigins: ["*"],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PUT,
          apigwv2.CorsHttpMethod.DELETE,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ["Content-Type", "Authorization"],
      },
    });

    const routes: Array<{
      path: string;
      method: apigwv2.HttpMethod;
      fn: NodejsFunction;
      name: string;
    }> = [
      { path: "/todos", method: apigwv2.HttpMethod.GET, fn: listFn, name: "List" },
      { path: "/todos", method: apigwv2.HttpMethod.POST, fn: createFn, name: "Create" },
      { path: "/todos/{id}", method: apigwv2.HttpMethod.GET, fn: getFn, name: "Get" },
      { path: "/todos/{id}", method: apigwv2.HttpMethod.PUT, fn: updateFn, name: "Update" },
      { path: "/todos/{id}", method: apigwv2.HttpMethod.DELETE, fn: deleteFn, name: "Delete" },
    ];

    for (const route of routes) {
      httpApi.addRoutes({
        path: route.path,
        methods: [route.method],
        integration: new integrations.HttpLambdaIntegration(
          `${route.name}Integration`,
          route.fn,
        ),
        authorizer: jwtAuthorizer,
      });
    }

    /* ---------------------------------------------------------------- */
    /* Web hosting (S3 + CloudFront)                                    */
    /* ---------------------------------------------------------------- */
    const webBucket = new s3.Bucket(this, "WebBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const distribution = new cloudfront.Distribution(this, "WebDistribution", {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(webBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: "index.html",
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: "/index.html" },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: "/index.html" },
      ],
    });

    new s3deploy.BucketDeployment(this, "WebDeployment", {
      sources: [s3deploy.Source.asset(WEB_BUILD_DIR)],
      destinationBucket: webBucket,
      distribution,
      distributionPaths: ["/*"],
    });

    /* ---------------------------------------------------------------- */
    /* Outputs                                                          */
    /* ---------------------------------------------------------------- */
    new CfnOutput(this, "ApiUrl", {
      value: httpApi.apiEndpoint,
      description: "Base URL of the HTTP API (no trailing slash)",
    });
    new CfnOutput(this, "WebUrl", {
      value: `https://${distribution.distributionDomainName}`,
      description: "Public URL of the web app",
    });
    new CfnOutput(this, "WebBucketName", {
      value: webBucket.bucketName,
      description: "S3 bucket holding the web build",
    });
    new CfnOutput(this, "TodosTableName", {
      value: todosTable.tableName,
      description: "DynamoDB table name",
    });
    new CfnOutput(this, "UserPoolId", {
      value: userPool.userPoolId,
      description: "Cognito User Pool ID — set as EXPO_PUBLIC_USER_POOL_ID / VITE_USER_POOL_ID",
    });
    new CfnOutput(this, "UserPoolClientId", {
      value: userPoolClient.userPoolClientId,
      description: "Cognito App Client ID — set as EXPO_PUBLIC_USER_POOL_CLIENT_ID / VITE_USER_POOL_CLIENT_ID",
    });
  }
}
