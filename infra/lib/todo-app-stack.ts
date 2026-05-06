/**
 * Single CDK stack for the entire app.
 *
 * Resources created:
 *   - DynamoDB table  : Todos (PK: id)
 *   - Lambda functions: 5 NodejsFunctions, one per CRUD endpoint, bundled
 *                       from apps/api with esbuild.
 *   - HTTP API        : API Gateway v2, routes wired to the Lambdas.
 *   - S3 bucket       : holds the Expo web build (apps/mobile/dist).
 *   - CloudFront      : public, HTTPS-fronted CDN over the S3 bucket.
 *
 * Why HTTP API (v2) and not REST API (v1)? Cheaper, lower latency, the v2
 * event shape is friendlier, and we don't need any v1-only features.
 */
import * as path from "node:path";
import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
} from "aws-cdk-lib";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
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

    /* ---------------------------------------------------------------- */
    /* DynamoDB                                                         */
    /* ---------------------------------------------------------------- */
    const todosTable = new dynamodb.Table(this, "TodosTable", {
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      // For a demo we wipe the table on stack destroy. For production set
      // RETAIN so a stack delete cannot wipe customer data.
      removalPolicy: RemovalPolicy.DESTROY,
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

    // Each function only gets the DDB permissions it actually needs.
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
        // Permissive for the demo. In production lock to your CloudFront
        // domain.
        allowOrigins: ["*"],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PUT,
          apigwv2.CorsHttpMethod.DELETE,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ["Content-Type"],
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
        // SPA fallback so client-side routes resolve to index.html.
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: "/index.html" },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: "/index.html" },
      ],
    });

    // Sync the Expo web build folder into the bucket on every deploy.
    // If the folder doesn't exist yet (you haven't run `npm run build:web`),
    // this fails — that's intentional, fix forward by running the build.
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
      description: "DynamoDB table name (set as TODOS_TABLE_NAME for local dev)",
    });
  }
}
