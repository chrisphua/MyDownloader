import * as path from "node:path";
import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
} from "aws-cdk-lib";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import {
  HttpLambdaAuthorizer,
  HttpLambdaResponseType,
} from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
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

    // Pass via CDK context at deploy time: cdk deploy -c jwtSecret=<value>
    // Bootstrap and synth work without it; only the deployed Lambda needs the real value.
    const jwtSecret = (this.node.tryGetContext("jwtSecret") as string | undefined) ?? "";

    /* ---------------------------------------------------------------- */
    /* DynamoDB                                                         */
    /* ---------------------------------------------------------------- */
    const todosTable = new dynamodb.Table(this, "TodosTable", {
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    todosTable.addGlobalSecondaryIndex({
      indexName: "userId-index",
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "createdAt", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const usersTable = new dynamodb.Table(this, "UsersTable", {
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    usersTable.addGlobalSecondaryIndex({
      indexName: "email-index",
      partitionKey: { name: "email", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    /* ---------------------------------------------------------------- */
    /* Lambda functions                                                 */
    /* ---------------------------------------------------------------- */
    const bundling = { externalModules: [] as string[], minify: true, sourceMap: true };

    const sharedEnv = {
      TODOS_TABLE_NAME: todosTable.tableName,
      TODOS_USER_INDEX: "userId-index",
    };

    const authEnv = {
      USERS_TABLE_NAME: usersTable.tableName,
      USERS_EMAIL_INDEX: "email-index",
      JWT_SECRET: jwtSecret,
    };

    const fnDefaults = {
      runtime: Runtime.NODEJS_20_X,
      memorySize: 512,
      timeout: Duration.seconds(10),
      bundling,
    };

    const listFn = new NodejsFunction(this, "ListTodosFn", { ...fnDefaults, entry: path.join(API_DIR, "handlers/listTodos.ts"), environment: sharedEnv });
    const getFn = new NodejsFunction(this, "GetTodoFn", { ...fnDefaults, entry: path.join(API_DIR, "handlers/getTodo.ts"), environment: sharedEnv });
    const createFn = new NodejsFunction(this, "CreateTodoFn", { ...fnDefaults, entry: path.join(API_DIR, "handlers/createTodo.ts"), environment: sharedEnv });
    const updateFn = new NodejsFunction(this, "UpdateTodoFn", { ...fnDefaults, entry: path.join(API_DIR, "handlers/updateTodo.ts"), environment: sharedEnv });
    const deleteFn = new NodejsFunction(this, "DeleteTodoFn", { ...fnDefaults, entry: path.join(API_DIR, "handlers/deleteTodo.ts"), environment: sharedEnv });

    todosTable.grantReadData(listFn);
    todosTable.grantReadData(getFn);
    todosTable.grantWriteData(createFn);
    todosTable.grantReadWriteData(updateFn);
    todosTable.grantWriteData(deleteFn);

    const registerFn = new NodejsFunction(this, "RegisterFn", { ...fnDefaults, entry: path.join(API_DIR, "handlers/register.ts"), environment: authEnv });
    const loginFn = new NodejsFunction(this, "LoginFn", { ...fnDefaults, entry: path.join(API_DIR, "handlers/login.ts"), environment: authEnv });
    const authorizerFn = new NodejsFunction(this, "AuthorizerFn", {
      ...fnDefaults,
      memorySize: 256,
      timeout: Duration.seconds(5),
      entry: path.join(API_DIR, "handlers/authorizer.ts"),
      environment: { JWT_SECRET: jwtSecret },
    });

    usersTable.grantReadWriteData(registerFn);
    usersTable.grantReadData(loginFn);

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

    const jwtAuthorizer = new HttpLambdaAuthorizer("JwtAuthorizer", authorizerFn, {
      responseTypes: [HttpLambdaResponseType.SIMPLE],
      identitySource: ["$request.header.Authorization"],
      resultsCacheTtl: Duration.minutes(5),
    });

    // Public auth routes — no authorizer
    httpApi.addRoutes({ path: "/auth/register", methods: [apigwv2.HttpMethod.POST], integration: new integrations.HttpLambdaIntegration("RegisterIntegration", registerFn) });
    httpApi.addRoutes({ path: "/auth/login", methods: [apigwv2.HttpMethod.POST], integration: new integrations.HttpLambdaIntegration("LoginIntegration", loginFn) });

    // Protected todo routes
    const todoRoutes: Array<{ path: string; method: apigwv2.HttpMethod; fn: NodejsFunction; name: string }> = [
      { path: "/todos", method: apigwv2.HttpMethod.GET, fn: listFn, name: "List" },
      { path: "/todos", method: apigwv2.HttpMethod.POST, fn: createFn, name: "Create" },
      { path: "/todos/{id}", method: apigwv2.HttpMethod.GET, fn: getFn, name: "Get" },
      { path: "/todos/{id}", method: apigwv2.HttpMethod.PUT, fn: updateFn, name: "Update" },
      { path: "/todos/{id}", method: apigwv2.HttpMethod.DELETE, fn: deleteFn, name: "Delete" },
    ];

    for (const route of todoRoutes) {
      httpApi.addRoutes({
        path: route.path,
        methods: [route.method],
        integration: new integrations.HttpLambdaIntegration(`${route.name}Integration`, route.fn),
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
    new CfnOutput(this, "ApiUrl", { value: httpApi.apiEndpoint, description: "Base URL of the HTTP API" });
    new CfnOutput(this, "WebUrl", { value: `https://${distribution.distributionDomainName}`, description: "Public URL of the web app" });
    new CfnOutput(this, "WebBucketName", { value: webBucket.bucketName });
    new CfnOutput(this, "TodosTableName", { value: todosTable.tableName });
    new CfnOutput(this, "UsersTableName", { value: usersTable.tableName });
  }
}
