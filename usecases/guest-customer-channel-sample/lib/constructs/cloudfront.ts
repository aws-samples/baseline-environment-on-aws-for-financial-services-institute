import { Construct } from 'constructs';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { NagSuppressions } from 'cdk-nag';

export interface DistributionBaseProps {
  certificate?: certificatemanager.ICertificate;
  comment: string;
  defaultRootObject?: string;
  domainNames?: string[];
  enableIpv6?: boolean;
  enabled?: boolean;
  logBucket: s3.IBucket;
  logFilePrefix: string;
  errorResponses?: cloudfront.ErrorResponse[];
  // TODO: Use the interface class instead of IDs
  webAclId?: string;
}

export interface DistributionProps extends DistributionBaseProps {
  defaultBehavior: cloudfront.BehaviorOptions;
  additionalBehaviors?: Record<string, cloudfront.BehaviorOptions>;
}

/**
 * A CloudFront Distribution construct.
 */
export class Distribution extends Construct {
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: DistributionProps) {
    super(scope, id);

    // Create the CloudFront distribution
    this.distribution = new cloudfront.Distribution(this, 'Resource', {
      defaultBehavior: props.defaultBehavior,
      additionalBehaviors: props.additionalBehaviors,
      certificate: props.certificate,
      comment: props.comment,
      defaultRootObject: props.defaultRootObject,
      domainNames: props.domainNames,
      enableIpv6: props.enableIpv6,
      enabled: props.enabled,
      enableLogging: true,
      logBucket: props.logBucket,
      logFilePrefix: props.logFilePrefix,
      logIncludesCookies: true,
      errorResponses: props.errorResponses,
      webAclId: props.webAclId,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
      geoRestriction: cloudfront.GeoRestriction.allowlist('JP'),
    });

    // Add suppressions for CloudFront distribution
    NagSuppressions.addResourceSuppressions(
      this.distribution,
      [
        {
          id: 'AwsSolutions-CFR4',
          reason: 'This example uses default CloudFront certificate for testing.',
        },
      ],
      true,
    );
  }
}

export interface S3OriginDistributionProps extends DistributionBaseProps {
  originBucket: s3.IBucket;
}

/**
 * A CloudFront Distribution with an S3 bucket as the origin
 */
export class S3OriginDistribution extends Distribution {
  constructor(scope: Construct, id: string, props: S3OriginDistributionProps) {
    super(scope, id, {
      ...props,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(props.originBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
    });
  }
}
