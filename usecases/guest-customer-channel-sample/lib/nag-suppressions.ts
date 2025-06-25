import { NagSuppressions } from 'cdk-nag';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { Stack } from 'aws-cdk-lib';
import { Node } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as appsync from 'aws-cdk-lib/aws-appsync';

export function addNagSuppressionsToProvider(provider: Provider) {
  NagSuppressions.addResourceSuppressions(
    provider,
    [
      { id: 'AwsSolutions-L1', reason: 'Non-latest nodejs function is used inside Provider' },
      { id: 'AwsSolutions-IAM4', reason: 'AWSLambdaBasicExecutionRole is used inside Provider' },
      { id: 'AwsSolutions-IAM5', reason: 'Wildcard policy is used inside Provider' },
      { id: 'AwsSolutions-SF1', reason: 'This is just a sample application. No default output all logs' },
      { id: 'AwsSolutions-SF2', reason: 'This is just a sample application. No X-Ray' },
    ],
    true,
  );
}

export function addNagSuppressionsToBucket(bucket: s3.Bucket) {
  NagSuppressions.addResourceSuppressions(bucket, [{ id: 'AwsSolutions-S1', reason: 'CloudTrail record S3 accesses' }]);
}

export function addNagSuppressionsToLambda(func: lambda.Function) {
  if (func.role) {
    NagSuppressions.addResourceSuppressions(func.role, [
      { id: 'AwsSolutions-IAM4', reason: 'AWSLambdaBasicExecutionRole is used' },
    ]);
  }
}

export function addNagSuppressionsToLogRetention(stack: Stack) {
  stack.node.children
    .filter((construct) => {
      const constructPath = construct.node.path.split(Node.PATH_SEP);
      const id = constructPath[constructPath.length - 1];
      return id.startsWith('LogRetention');
    })
    .forEach((construct) => {
      NagSuppressions.addResourceSuppressions(
        construct,
        [
          { id: 'AwsSolutions-IAM4', reason: 'LogRetention uses AWSLambdaBasicExecutionRole' },
          { id: 'AwsSolutions-IAM5', reason: 'LogRetention uses wildcard policy' },
        ],
        true,
      );
    });
}
export function addNagSuppressionsToNodejsBuild(stack: Stack) {
  stack.node.children
    .filter((construct) => {
      const constructPath = construct.node.path.split(Node.PATH_SEP);
      const id = constructPath[constructPath.length - 1];
      return id.startsWith('NodejsBuildCustomResourceHandler');
    })
    .forEach((construct) => {
      NagSuppressions.addResourceSuppressions(
        construct,
        [
          { id: 'AwsSolutions-L1', reason: 'NodejsBuildCustomResourceHandler uses non-latest lambda runtime' },
          { id: 'AwsSolutions-IAM4', reason: 'NodejsBuildCustomResourceHandler uses AWSLambdaBasicExecutionRole' },
        ],
        true,
      );
    });

  stack.node.children
    .filter((construct) => {
      const constructPath = construct.node.path.split(Node.PATH_SEP);
      const id = constructPath[constructPath.length - 1];
      return id.startsWith('Custom::CDKBucketDeployment');
    })
    .forEach((construct) => {
      NagSuppressions.addResourceSuppressions(
        construct,
        [
          { id: 'AwsSolutions-L1', reason: 'Custom::CDKBucketDeployment uses non-latest lambda runtime' },
          { id: 'AwsSolutions-IAM4', reason: 'NodejsBuildCustomResourceHandler uses AWSLambdaBasicExecutionRole' },
          { id: 'AwsSolutions-IAM5', reason: 'Custom::CDKBucketDeployment uses wildcard permissions' },
        ],
        true,
      );
    });
}

export function addNagSuppressionsToRestApi(api: apigateway.RestApi) {
  NagSuppressions.addResourceSuppressions(
    api,
    [{ id: 'AwsSolutions-IAM4', reason: 'API Gateway uses AmazonAPIGatewayPushToCloudWatchLogs' }],
    true,
  );
  NagSuppressions.addResourceSuppressions(
    api,
    [{ id: 'AwsSolutions-APIG2', reason: 'This API Gateway is a sample implementation. No schema' }],
    true,
  );
}

export function addNagSuppressionsToApiMethod(method: apigateway.Method) {
  NagSuppressions.addResourceSuppressions(
    method,
    [{ id: 'AwsSolutions-COG4', reason: 'IAM authorizer is intentionally used' }],
    true,
  );
}

export function addNagSuppressionsToGraphqlApi(api: appsync.GraphqlApi) {
  NagSuppressions.addResourceSuppressions(
    api,
    [{ id: 'AwsSolutions-IAM4', reason: 'AppSync uses AWSAppSyncPushToCloudWatchLogs' }],
    true,
  );
}
