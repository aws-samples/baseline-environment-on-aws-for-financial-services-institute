import { Construct } from 'constructs';
import { IResolvable } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import { NagSuppressions } from 'cdk-nag';

interface BucketReplicationProps {
  readonly sourceBucket: s3.Bucket;
  readonly sourceKey?: kms.Key;
}

interface ReplicationRuleProps {
  readonly destinationBucket: s3.IBucket;
  readonly destinationKey?: kms.IKey;
}

export class BucketReplication extends Construct {
  private sourceBucket: s3.Bucket;
  private sourceKey?: kms.Key;
  private replicationRole: iam.Role;

  constructor(scope: Construct, id: string, props: BucketReplicationProps) {
    super(scope, id);

    this.sourceBucket = props.sourceBucket;
    this.sourceKey = props.sourceKey;

    this.replicationRole = new iam.Role(this, 'ReplicationRole', {
      assumedBy: new iam.ServicePrincipal('s3.amazonaws.com'),
    });
    this.replicationRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetReplicationConfiguration', 's3:ListBucket'],
        resources: [this.sourceBucket.bucketArn],
      }),
    );
    this.replicationRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObjectVersionForReplication', 's3:GetObjectVersionAcl', 's3:GetObjectVersionTagging'],
        resources: [this.sourceBucket.arnForObjects('*')],
      }),
    );
    NagSuppressions.addResourceSuppressions(
      this.replicationRole,
      [{ id: 'AwsSolutions-IAM5', reason: 'Wildcard is used to replicate all of the objects in the source bucket' }],
      true,
    );

    if (this.sourceKey) {
      this.sourceKey.grantDecrypt(this.replicationRole);
      this.sourceKey.grant(this.replicationRole, 'kms:GenerateDataKey');
    }

    const cfnSourceBucket = this.getCfnSourceBucket();
    if (cfnSourceBucket.replicationConfiguration) {
      throw Error(`sourceBucket.replicationConfiguration already assigned for ${id}`);
    }

    cfnSourceBucket.replicationConfiguration = {
      role: this.replicationRole.roleArn,
      rules: [],
    };
  }

  private getCfnSourceBucket() {
    return this.sourceBucket.node.defaultChild as s3.CfnBucket;
  }

  public addReplicationRule(props: ReplicationRuleProps) {
    const cfnSourceBucket = this.getCfnSourceBucket();
    const replicationConfiguration =
      cfnSourceBucket.replicationConfiguration as s3.CfnBucket.ReplicationConfigurationProperty;
    if (!replicationConfiguration) {
      throw Error('sourceBucket.replicationConfiguration is not set');
    }

    const rules = replicationConfiguration.rules as (IResolvable | s3.CfnBucket.ReplicationRuleProperty)[];
    // TODO: cross-account cases, metrics, and storage classes are not supported
    rules.push({
      destination: {
        bucket: props.destinationBucket.bucketArn,
        encryptionConfiguration: props.destinationKey
          ? {
              replicaKmsKeyId: props.destinationKey.keyArn,
            }
          : undefined,
      },
      status: 'Enabled',
      sourceSelectionCriteria: {
        sseKmsEncryptedObjects: {
          status: 'Enabled',
        },
      },
    });

    this.replicationRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:ReplicateObject', 's3:ReplicateDelete', 's3:ReplicateTags'],
        resources: [props.destinationBucket.arnForObjects('*')],
      }),
    );
    if (props.destinationKey) {
      this.replicationRole.addToPolicy(
        new iam.PolicyStatement({
          actions: ['kms:Encrypt', 'kms:GenerateDataKey'],
          resources: [props.destinationKey.keyArn],
          conditions: {
            StringLike: {
              'kms:ViaService': `s3.${this.sourceBucket.stack.region}.amazonaws.com`,
            },
          },
        }),
      );
    }
  }
}
