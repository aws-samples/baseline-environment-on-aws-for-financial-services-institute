import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_apigateway as apigw } from 'aws-cdk-lib';
import { Cognito } from './cognito';
import { ApiGw } from './api-gw';
import { StackParameter } from 'bin/parameter';
import { CloudFront } from './cloudfront';
import { WafV2ApiGW } from './waf-apigw';

/**
 * OpenAPI basic ワークロード サンプルアプリケーションを作成するStack
 */
export class SampleOpenApiStack extends cdk.Stack {
  public readonly sample_api: apigw.RestApi;

  constructor(scope: Construct, id: string, props: StackParameter) {
    super(scope, id, props);

    //Cognito UserPooL作成
    const cognito = new Cognito(this, 'Cognito Pool');

    //API Gateway作成
    const apiGw = new ApiGw(this, 'ApiGateway', cognito, props);

    //Waf v2 for API Gateway作成
    const wafv2 = new WafV2ApiGW(this, 'WafForApiGW', apiGw.sampleApi.restApiId);
    //デプロイ時の依存関係を設定
    wafv2.webAclApigw.node.addDependency(apiGw.sampleApi);

    //CloudFront distribution作成
    new CloudFront(this, 'CloudFront', props);
  }
}
