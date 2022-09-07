import { ContainerDistributorAppSampleStack } from './bleafsi-container-distributor-app-sample-stack';
import * as cdk from 'aws-cdk-lib';
import { KeyAppStack } from './bleafsi-key-app-stack';
import { Construct } from 'constructs';
import { VpcStack } from './bleafsi-vpc-stack';
import { MarketDataContextProps } from './../lib/bleafsi-market-data-context-props';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_elasticloadbalancingv2 as elbv2 } from 'aws-cdk-lib';
import { ECRStack } from './bleafsi-ecr-stack';
import { BuildContainerStack } from './bleafsi-build-container-stack';
import { WafStack } from './bleafsi-waf-stack';
import { ContainerAppSampleBaseStack } from './bleafsi-container-app-sample-stack';
import { DynamoDbStack } from './bleafsi-dynamodb-stack';
import { MonitorAlarmStack } from './bleafsi-monitor-alarm-stack';

export class GuestMarketDataStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly alb: elbv2.ApplicationLoadBalancer;
  public readonly dynamoDb: DynamoDbStack;

  constructor(scope: Construct, id: string, props: MarketDataContextProps) {
    super(scope, id, props);
    const pjPrefix = props.pjPrefix;

    // CMK
    const appKey = new KeyAppStack(this, `${pjPrefix}-AppKey`);

    // Topic for monitoring guest system
    const monitorAlarm = new MonitorAlarmStack(this, `${pjPrefix}-MonitorAlarm`, {
      notifyEmail: props.notifyEmail,
      appKey: appKey,
    });

    // VPC
    const prodVpc = new VpcStack(this, `${pjPrefix}-Vpc`, props);

    // Container Repository
    const ecr = new ECRStack(this, `${pjPrefix}-ECR`, {
      repositoryName: `${pjPrefix}-repo`,
      alarmTopic: monitorAlarm.alarmTopic,
    });

    // Sample Handler
    // Build Container Image
    const build_handler_container = new BuildContainerStack(this, `${pjPrefix}-Handler-Container-Image`, {
      ecrRepository: ecr.repository,
      appName: 'sample_composer',
      appKey: appKey,
    });

    // Sample Handler Stream
    new cdk.aws_kinesis.Stream(this, 'Handler Stream', {
      encryption: cdk.aws_kinesis.StreamEncryption.KMS,
      encryptionKey: appKey.kmsKey,
    });

    // Sample Application Stack
    const handlerApp = new ContainerAppSampleBaseStack(this, `${pjPrefix}-Handler-App`, {
      myVpc: prodVpc.myVpc,
      appKey: appKey.kmsKey,
      imageTag: build_handler_container.imageTag,
      repository: ecr.repository,
    });
    handlerApp.addDependency(build_handler_container);

    // Sample Composer
    // Build Container Image
    const build_composer_container = new BuildContainerStack(this, `${pjPrefix}-Composer-Container-Image`, {
      ecrRepository: ecr.repository,
      appName: 'sample_composer',
      appKey: appKey,
    });

    // Sample Composer Stream
    new cdk.aws_kinesis.Stream(this, 'Composer Stream', {
      encryption: cdk.aws_kinesis.StreamEncryption.KMS,
      encryptionKey: appKey.kmsKey,
    });

    // Sample Application Stack
    const composerApp = new ContainerAppSampleBaseStack(this, `${pjPrefix}-Composer-App`, {
      myVpc: prodVpc.myVpc,
      appKey: appKey.kmsKey,
      imageTag: build_handler_container.imageTag,
      repository: ecr.repository,
    });
    composerApp.addDependency(build_composer_container);

    // DynamoDB to store composed data
    const dynamoDb = new DynamoDbStack(this, `${pjPrefix}-composed-ddb`, {
      alarmTopic: monitorAlarm.alarmTopic,
      appKey: appKey.kmsKey,
    });
    dynamoDb.addDependency(appKey);
    dynamoDb.addDependency(monitorAlarm);

    // Sample Distributor
    // Build Container Image
    const build_composer_distributor = new BuildContainerStack(this, `${pjPrefix}-Distributor-Container-Image`, {
      ecrRepository: ecr.repository,
      appName: 'sample_handler',
      appKey: appKey,
    });

    // WebACL for ALB
    const waf = new WafStack(this, `${pjPrefix}-Waf`, {
      scope: 'REGIONAL',
    });

    // Sample Application Stack
    const distributorApp = new ContainerDistributorAppSampleStack(this, `${pjPrefix}-Distributor-App`, {
      myVpc: prodVpc.myVpc,
      appKey: appKey.kmsKey,
      imageTag: build_handler_container.imageTag,
      repository: ecr.repository,
      webAcl: waf.webAcl,
    });
    distributorApp.addDependency(build_composer_distributor);
  }
}
