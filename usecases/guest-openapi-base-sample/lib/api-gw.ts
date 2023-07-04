import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_apigateway as apigw } from 'aws-cdk-lib';
import { Cognito } from './cognito';
import { aws_logs as logs } from 'aws-cdk-lib';
import { aws_certificatemanager as acm } from 'aws-cdk-lib';
import { StackParameter } from 'bin/parameter';

/**
 * API Gatewayの作成
 */
export class ApiGw extends Construct {
  readonly sampleApi: apigw.RestApi;

  constructor(scope: Construct, id: string, cognito: Cognito, props: StackParameter) {
    super(scope, id);

    // Create Cognito Authorizer
    const cognitoAuthorizer = new apigw.CognitoUserPoolsAuthorizer(this, 'cognitoAuthorizer', {
      authorizerName: 'CognitoAuthorizer',
      cognitoUserPools: [cognito.userPool],
    });

    //Create API access log Group
    const restApiLogAccessLogGroup = new logs.LogGroup(this, 'RestApiLogAccessLogGroup', {
      retention: 365,
    });

    // Defines an API Gateway REST API resource backed by our "hello" function.
    const sampleApi = new apigw.RestApi(this, 'sample-api', {
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
    sampleApi.root
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
        new apigw.LambdaIntegration(cognito.lambdaFunc, {
          // Set Lambda function
          proxy: true,
        }),
        {
          authorizer: cognitoAuthorizer,
        },
      );
    this.sampleApi = sampleApi;

    const domainName = new apigw.DomainName(this, 'OpenApiCustomDomain', {
      // Set Certificate to Custom Domain
      certificate: acm.Certificate.fromCertificateArn(this, 'Certificate', props?.certIdarnApigw),
      // Set Custome Domain Name
      domainName: props.customdomainName,
      // REGIONAL Type
      endpointType: apigw.EndpointType.REGIONAL,
    });
    domainName.addBasePathMapping(sampleApi, {});
  }
}
