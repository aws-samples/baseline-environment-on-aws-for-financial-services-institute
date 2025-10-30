import { Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as nag_suppressions from '../nag-suppressions';

export type BucketEncryption =
  | s3.BucketEncryption.S3_MANAGED
  | s3.BucketEncryption.KMS
  | s3.BucketEncryption.KMS_MANAGED;

export interface PrivateBucketProps {
  readonly encryption: BucketEncryption;
  readonly encryptionKey?: kms.IKey;
  readonly eventBridgeEnabled?: boolean;
  readonly intelligentTieringConfigurations?: s3.IntelligentTieringConfiguration[];
  readonly inventories?: s3.Inventory[];
  readonly lifecycleRules?: s3.LifecycleRule[];
  readonly metrics?: s3.BucketMetrics[];
  readonly notificationsHandlerRole?: iam.IRole;
  readonly transferAcceleration?: boolean;
  readonly serverAccessLogsBucket?: s3.IBucket;
  readonly serverAccessLogsPrefix?: string;
  readonly objectOwnership?: s3.ObjectOwnership;
}

export class PrivateBucket extends s3.Bucket {
  constructor(scope: Construct, id: string, props: PrivateBucketProps) {
    super(scope, id, {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      objectOwnership: props.objectOwnership ?? s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      versioned: true,
      encryption: props.encryption,
      encryptionKey: props.encryptionKey,
      bucketKeyEnabled: props.encryption != s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      publicReadAccess: false,

      // delegated members
      eventBridgeEnabled: props.eventBridgeEnabled,
      intelligentTieringConfigurations: props.intelligentTieringConfigurations,
      inventories: props.inventories,
      lifecycleRules: props.lifecycleRules,
      metrics: props.metrics,
      notificationsHandlerRole: props.notificationsHandlerRole,
      transferAcceleration: props.transferAcceleration,
    });

    if (props.serverAccessLogsBucket) {
      // Intentionally unset props.serverAccessLogsBucket & serverAccessLogsPrefix of L2 construct
      // to use a bucket policy for log delivery instead of ACLs.
      this.cfnBucket.loggingConfiguration = {
        destinationBucketName: props.serverAccessLogsBucket.bucketName,
        logFilePrefix: props.serverAccessLogsPrefix,
      };

      const account = Stack.of(this).account;
      props.serverAccessLogsBucket.addToResourcePolicy(
        new iam.PolicyStatement({
          principals: [new iam.ServicePrincipal('logging.s3.amazonaws.com')],
          actions: ['s3:PutObject'],
          resources: [props.serverAccessLogsBucket.arnForObjects(`${props.serverAccessLogsPrefix}*`)],
          conditions: {
            ArnLike: {
              'aws:SourceArn': this.bucketArn,
            },
            StringEquals: {
              'aws:SourceAccount': account,
            },
          },
        }),
      );
    } else if (props.serverAccessLogsPrefix) {
      // See also: https://aws.amazon.com/jp/premiumsupport/knowledge-center/s3-server-access-logs-same-bucket/
      throw new Error('Do not use the same bucket for access logs');
    }

    nag_suppressions.addNagSuppressionsToBucket(this);
  }

  private get cfnBucket(): s3.CfnBucket {
    return this.node.defaultChild as s3.CfnBucket;
  }
}
