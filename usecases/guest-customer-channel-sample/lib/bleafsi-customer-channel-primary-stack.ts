import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lex from 'aws-cdk-lib/aws-lex';
import * as cr_connect from './bleafsi-cr-connect';
import { CustomerChannelTertiaryStack } from './bleafsi-customer-channel-tertiary-stack';
import { CustomerChannelConnectInstance } from './bleafsi-customer-channel-connect-instance';
import { ConnectInstanceConfig } from './bleafsi-customer-channel-config';
import { PrivateBucket } from './bleafsi-s3-private-bucket';
import { BucketReplication } from './bleafsi-s3-replication';
import { RemoteParameters } from 'cdk-remote-stack';
import * as nag_suppressions from './bleafsi-nag-suppressions';
import { NagSuppressions } from 'cdk-nag';

export interface CustomerChannelPrimaryStackProps extends StackProps {
  readonly connectInstance: ConnectInstanceConfig;
  readonly tertiaryStack?: CustomerChannelTertiaryStack;
}

export class CustomerChannelPrimaryStack extends Stack {
  constructor(scope: Construct, id: string, props: CustomerChannelPrimaryStackProps) {
    super(scope, id, props);

    const recordingKey = new kms.Key(this, 'RecordingKey', {
      enableKeyRotation: true,
    });
    const accessLogsBucket = new PrivateBucket(this, 'AccessLogsBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
    });
    const recordingBucket = new PrivateBucket(this, 'RecordingBucket', {
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: recordingKey,
      serverAccessLogsBucket: accessLogsBucket,
      serverAccessLogsPrefix: 'access-logs/primary/',
    });

    const connectInstance = new CustomerChannelConnectInstance(this, 'ConnectInstance', {
      connectInstance: props.connectInstance,
      recordingBucket,
      recordingKey,
      recordingPrefix: 'primary',
      localRecordingKey: recordingKey,
    });

    if (props.tertiaryStack) {
      this.createRecordingBackups(props.tertiaryStack, recordingBucket, recordingKey);
      this.addDependency(props.tertiaryStack);
    }

    this.createContactFlows(connectInstance);

    nag_suppressions.addNagSuppressionsToLogRetention(this);
  }

  private createRecordingBackups(
    tertiaryStack: CustomerChannelTertiaryStack,
    recordingBucket: s3.Bucket,
    recordingKey: kms.Key,
  ) {
    const tertiaryStackOutputs = new RemoteParameters(this, 'TertiaryStackOutputs', {
      path: tertiaryStack.parameterPath,
      region: tertiaryStack.region,
      alwaysUpdate: false, // Stop refreshing the resource for snapshot testing
    });
    nag_suppressions.addNagSuppressionsToRemoteParameters(tertiaryStackOutputs);

    const backupBucket = s3.Bucket.fromBucketArn(
      this,
      'BackupBucket',
      tertiaryStackOutputs.get(tertiaryStack.backupBucketArnParameterName),
    );
    const backupKey = kms.Key.fromKeyArn(
      this,
      'BackupKey',
      tertiaryStackOutputs.get(tertiaryStack.backupKeyArnParameterName),
    );

    const recordingReplication = new BucketReplication(this, 'RecordingReplication', {
      sourceBucket: recordingBucket,
      sourceKey: recordingKey,
    });
    recordingReplication.addReplicationRule({
      destinationBucket: backupBucket,
      destinationKey: backupKey,
    });
  }

  private createContactFlows(connectInstance: CustomerChannelConnectInstance) {
    const botRole = new iam.Role(this, 'CustomerIdentificationBotRole', {
      assumedBy: new iam.ServicePrincipal('lexv2.amazonaws.com'),
    });
    botRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['polly:SynthesizeSpeech'],
        resources: ['*'],
      }),
    );
    NagSuppressions.addResourceSuppressions(
      botRole,
      [{ id: 'AwsSolutions-IAM5', reason: 'Wildcard is required to use polly' }],
      true,
    );

    const bot = new lex.CfnBot(this, 'CustomerIdentificationBot', {
      dataPrivacy: { ChildDirected: false },
      idleSessionTtlInSeconds: 300,
      name: 'CustomerIdentificationBot',
      roleArn: botRole.roleArn,
      botLocales: [
        {
          localeId: 'ja_JP',
          nluConfidenceThreshold: 0.4,
          intents: [
            {
              name: 'FallbackIntent',
              parentIntentSignature: 'AMAZON.FallbackIntent',
            },
            {
              name: 'CustomerIdentificationIntent',
              sampleUtterances: [
                {
                  utterance: '担当者と話したいです',
                },
              ],
              slots: [
                {
                  name: 'CustomerNumber',
                  slotTypeName: 'AMAZON.Number',
                  valueElicitationSetting: {
                    slotConstraint: 'Required',
                    promptSpecification: {
                      maxRetries: 4,
                      messageGroupsList: [
                        {
                          message: {
                            ssmlMessage: {
                              value:
                                '<speak><prosody rate="120%">\nご本人様確認のため、\nお客様番号をゆっくり、\nはっきりとおっしゃってください。\n</prosody></speak>',
                            },
                          },
                        },
                      ],
                    },
                  },
                },
                {
                  name: 'BirthDate',
                  slotTypeName: 'AMAZON.Date',
                  valueElicitationSetting: {
                    slotConstraint: 'Required',
                    promptSpecification: {
                      maxRetries: 4,
                      messageGroupsList: [
                        {
                          message: {
                            ssmlMessage: {
                              value:
                                '<speak><prosody rate="120%"><phoneme alphabet="x-amazon-pron-kana" ph="ゴケーヤ\'クシャサマノ">ご契約者様の</phoneme><phoneme alphabet="x-amazon-pron-kana" ph="セーネンガ\'ッピ">生年月日</phoneme>をおっしゃってください。</prosody></speak>',
                            },
                          },
                        },
                      ],
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    });
    bot.node.addDependency(botRole);

    const botVersion = new lex.CfnBotVersion(this, 'CustomerIdentificationBotVersion', {
      botId: bot.attrId,
      botVersionLocaleSpecification: [
        {
          localeId: 'ja_JP',
          botVersionLocaleDetails: {
            sourceBotVersion: 'DRAFT',
          },
        },
      ],
    });

    const botAlias = new lex.CfnBotAlias(this, 'CustomerIdentificationBotAlias', {
      botAliasName: 'CustomerIdentificationBotAlias',
      botId: bot.attrId,
      botVersion: botVersion.attrBotVersion,
    });

    const botAssociation = new cr_connect.LexBotAssociation(this, 'CustomerIdentificationBotAssociation', {
      instanceId: connectInstance.instance.instanceId,
      lexV2Bot: {
        aliasArn: botAlias.attrArn,
      },
    });
    botAssociation.node.addDependency(connectInstance, bot);
  }
}
