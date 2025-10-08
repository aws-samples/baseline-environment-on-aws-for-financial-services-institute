import { CfnOutput, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { PrivateBucket } from '../../constructs/s3-private-bucket';
import { NodejsBuild } from 'deploy-time-build';
import * as path from 'path';
import { NagSuppressions } from 'cdk-nag';
import { S3OriginDistribution } from '../../constructs/cloudfront';
import * as connect_l2 from '../../constructs-l2/connect';
import {
  getPackageJsonIncludePatterns,
  getHierarchicalIncludePatterns,
  getAllIncludePatterns,
} from '../../constructs/glob-patterns';

export interface WebCallSampleProps {
  /**
   * WAF Web ACL ID to associate with the distribution
   */
  webAclId?: string;

  connectInstance: connect_l2.Instance;
  connectWidgetId?: string;
  connectSnippetId?: string;
}

export class WebCallSample extends Construct {
  readonly frontendUrl: string;
  readonly distribution: S3OriginDistribution;

  constructor(scope: Construct, id: string, props: WebCallSampleProps) {
    super(scope, id);

    // Create access log bucket
    const accessLogBucket = new PrivateBucket(this, 'AccessLogBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
    });

    // Create asset bucket for static files
    const assetBucket = new Bucket(this, 'AssetBucket', {
      encryption: BucketEncryption.S3_MANAGED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      serverAccessLogsBucket: accessLogBucket,
      serverAccessLogsPrefix: 'access-log/bucket/',
    });

    // Create CloudFront distribution using our wrapper
    this.distribution = new S3OriginDistribution(this, 'WebDistribution', {
      originBucket: assetBucket,
      comment: 'Mock Bank Site Web App',
      webAclId: props.webAclId,
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/',
        },
      ],
      logBucket: accessLogBucket,
      logFilePrefix: 'access-log/cloudfront/',
    });

    // Build and deploy React app
    const projectRoot = path.resolve(__dirname, '../../../../../');
    const mockSitePath = 'usecases/guest-customer-channel-sample/lib/samples/web-call-sample/mock-bank-site';
    const mockSiteDistPath = mockSitePath + '/dist';

    const reactBuild = new NodejsBuild(this, 'ReactBuild', {
      assets: [
        {
          path: projectRoot,
          exclude: [
            '*',
            '.*',
            ...getHierarchicalIncludePatterns(mockSitePath),
            ...getAllIncludePatterns(mockSitePath),
            mockSiteDistPath,
            ...getPackageJsonIncludePatterns(projectRoot),
          ],
          commands: ['npm ci'],
        },
      ],
      buildCommands: ['npm run build -w mock-bank-site'],
      buildEnvironment: {
        VITE_REGION: Stack.of(this).region,
        VITE_CONNECT_FQDN: props.connectInstance.instanceDomain ?? '',
        VITE_CONNECT_WIDGET_ID: props.connectWidgetId ?? '',
        VITE_CONNECT_SNIPPET_ID: props.connectSnippetId ?? '',
      },
      destinationBucket: assetBucket,
      distribution: this.distribution.distribution,
      outputSourceDirectory: mockSiteDistPath,
    });

    // Add suppressions for React build
    NagSuppressions.addResourceSuppressions(
      reactBuild,
      [
        { id: 'AwsSolutions-IAM5', reason: 'NodejsBuild uses wildcard permission' },
        { id: 'AwsSolutions-CB4', reason: 'NodejsBuild uses CodeBuild without AWS KMS key' },
      ],
      true,
    );

    // Output the frontend URL
    this.frontendUrl = `https://${this.distribution.distribution.distributionDomainName}`;
    new CfnOutput(this, 'FrontendUrl', { value: this.frontendUrl });
  }
}
