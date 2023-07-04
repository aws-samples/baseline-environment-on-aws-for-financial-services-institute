import { NagSuppressions } from 'cdk-nag';
import { RemoteParameters } from 'cdk-remote-stack';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { Stack } from 'aws-cdk-lib';
import { Node } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';

export function addNagSuppressionsToRemoteParameters(rp: RemoteParameters) {
  NagSuppressions.addResourceSuppressions(
    rp,
    [
      { id: 'AwsSolutions-L1', reason: 'Non-latest nodejs function is used inside RemoteParameters' },
      { id: 'AwsSolutions-IAM4', reason: 'AWSLambdaBasicExecutionRole is used inside RemoteParameters' },
      { id: 'AwsSolutions-IAM5', reason: 'Wildcard policy is used inside RemoteParameters' },
    ],
    true,
  );
}

export function addNagSuppressionsToProvider(provider: Provider) {
  NagSuppressions.addResourceSuppressions(
    provider,
    [
      { id: 'AwsSolutions-L1', reason: 'Non-latest nodejs function is used inside Provider' },
      { id: 'AwsSolutions-IAM4', reason: 'AWSLambdaBasicExecutionRole is used inside Provider' },
      { id: 'AwsSolutions-IAM5', reason: 'Wildcard policy is used inside Provider' },
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
