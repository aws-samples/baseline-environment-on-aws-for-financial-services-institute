import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_cloudfront as cloudfront } from 'aws-cdk-lib';
import { aws_cloudfront_origins as cloudfront_origins } from 'aws-cdk-lib';
import { aws_certificatemanager as acm } from 'aws-cdk-lib';
import { aws_s3 as s3 } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';

import { OpenApiBaseContextProps } from '../lib/shared/bleafsi-types';

export class SampleCfStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: OpenApiBaseContextProps) {
    super(scope, id, props);

    // Create cache policy for APIGW
    const cachePolicyForApiGateway = new cloudfront.CachePolicy(this, 'cachePolicyForApiGateway', {
      cachePolicyName: 'cachePolicyForApiGateway',
      enableAcceptEncodingBrotli: true,
      enableAcceptEncodingGzip: true,
      headerBehavior: cloudfront.CacheHeaderBehavior.allowList('Authorization'),
    });

    // Create S3 bucket for CF log
    const appLogBucket = new s3.Bucket(this, 'AppLogBucket', {
      bucketName: `app-logs-cloudfront`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      accessControl: s3.BucketAccessControl.LOG_DELIVERY_WRITE,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    appLogBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AllowCloudFrontOnly',
        effect: iam.Effect.ALLOW,
        actions: ['s3:*'],
        resources: [`arn:aws:s3:::${appLogBucket.bucketName}`, `arn:aws:s3:::${appLogBucket.bucketName}/*`],
        principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
      }),
    );

    // Create CF distribution
    new cloudfront.Distribution(this, 'OpenApiDistribution', {
      comment: 'OpenAPI-distribution',
      defaultBehavior: {
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
        cachePolicy: cloudfront.CachePolicy.fromCachePolicyId(
          this,
          'CustomCachePolicy',
          cachePolicyForApiGateway.cachePolicyId,
        ),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
        origin: new cloudfront_origins.HttpOrigin(props.customdomainName),
      },
      domainNames: [props.alterdomainName],
      certificate: acm.Certificate.fromCertificateArn(
        // Set certificate to CF domain
        this,
        'Certificate',
        props.certIdarnCf,
      ),
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
      enableLogging: true,
      logBucket: appLogBucket,
      geoRestriction: cloudfront.GeoRestriction.allowlist('US', 'GB', 'JP'),
    });
  }
}
