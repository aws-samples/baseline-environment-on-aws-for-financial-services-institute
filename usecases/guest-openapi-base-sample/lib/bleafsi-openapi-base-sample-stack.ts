import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_lambda as lambda } from 'aws-cdk-lib';
import { aws_apigateway as apigw } from 'aws-cdk-lib';
import { aws_cognito as cognito } from 'aws-cdk-lib';
import { aws_certificatemanager as acm } from 'aws-cdk-lib';
import { Duration } from 'aws-cdk-lib';
import { aws_logs as logs } from 'aws-cdk-lib';
import { OpenApiBaseContextProps } from '../lib/shared/bleafsi-types';

export class SampleOpenApiStack extends cdk.Stack {
  public readonly sample_api: apigw.RestApi;

  constructor(scope: Construct, id: string, props: OpenApiBaseContextProps) {
    super(scope, id, props);

    // Create User Pool
    const userPool = new cognito.UserPool(this, 'userPool', {
      userPoolName: 'apiUserPool',
      selfSignUpEnabled: false,
      standardAttributes: {
        email: { required: true, mutable: true },
        phoneNumber: { required: true },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: Duration.days(7),
      },
      signInCaseSensitive: false,
      autoVerify: { email: true },
      signInAliases: { email: true },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        otp: false,
        sms: true,
      },
    });

    // Create User Pool Client
    userPool.addClient('client', {
      userPoolClientName: 'apiUserPoolClient',
      generateSecret: false,
      authFlows: { adminUserPassword: true, userSrp: true, userPassword: true }, //cognitoIdp:adminInitiateAuth APIでユーザートークンを取得可能にする
    });

    const hello = new lambda.Function(this, 'HelloHandler', {
      runtime: lambda.Runtime.NODEJS_16_X,
      code: lambda.Code.fromAsset('lambda'),
      handler: 'hello.handler',
    });

    // Create Cognito Authorizer
    const cognitoAuthorizer = new apigw.CognitoUserPoolsAuthorizer(this, 'cognitoAuthorizer', {
      authorizerName: 'CognitoAuthorizer',
      cognitoUserPools: [userPool],
    });

    //Create API access log Group
    const restApiLogAccessLogGroup = new logs.LogGroup(this, 'RestApiLogAccessLogGroup', {
      logGroupName: `/aws/apigateway/rest-api-access-log`,
      retention: 365,
    });

    // Defines an API Gateway REST API resource backed by our "hello" function.
    const sample_api = new apigw.RestApi(this, 'sample-api', {
      restApiName: 'sample-api',
      deployOptions: {
        //Enable API trace
        dataTraceEnabled: true,
        loggingLevel: apigw.MethodLoggingLevel.INFO,
        //Create CW Log group for API access log
        accessLogDestination: new apigw.LogGroupLogDestination(restApiLogAccessLogGroup),
        accessLogFormat: apigw.AccessLogFormat.clf(),
      },
    });
    sample_api.root
      .addResource('{proxy+}', {
        //  defaultCorsPreflightOptions: {
        //    allowOrigins: apigw.Cors.ALL_ORIGINS,
        //    allowMethods: apigw.Cors.ALL_METHODS,
        //    allowHeaders: apigw.Cors.DEFAULT_HEADERS,
        //    statusCode: 200,
        //  },
      })
      .addMethod(
        'GET',
        new apigw.LambdaIntegration(hello, {
          // Set Lambda function
          proxy: true,
        }),
        {
          authorizer: cognitoAuthorizer,
        },
      );
    this.sample_api = sample_api;

    const domainName = new apigw.DomainName(this, 'OpenApiCustomDomain', {
      // Set Certificate to Custom Domain
      certificate: acm.Certificate.fromCertificateArn(this, 'Certificate', props?.certIdarnApigw),
      // Set Custome Domain Name
      domainName: props.customdomainName,
      // REGIONAL Type
      endpointType: apigw.EndpointType.REGIONAL,
    });
    domainName.addBasePathMapping(sample_api, {});
  }
}
