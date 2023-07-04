import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DistributorApp } from './container-distributor-app';
import { KmsKey } from './constructs/bleafsi-kms-key';
import { PublicVpc, VpcEndpointTypeName } from './constructs/bleafsi-vpc';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_elasticloadbalancingv2 as elbv2 } from 'aws-cdk-lib';
import { Ecr } from './constructs/bleafsi-ecr';
import { ImageBuilder } from './build-container';
import { Waf } from './constructs/bleafsi-waf';
import { BaseApp } from './container-app';
import { DynamoDBClass } from './dynamodb';
import { MonitorAlarm } from './monitor-alarm';
import { PjPrefix, StackParameter } from '../bin/parameter';

/*
 * BLEA-FSI Market Data Sample application stack class
 */
export class GuestMarketDataStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly alb: elbv2.ApplicationLoadBalancer;
  public readonly dynamoDb: DynamoDBClass;

  constructor(scope: Construct, id: string, props: StackParameter) {
    super(scope, id, props);

    // CMK
    const appKey = new KmsKey(this, 'AppKey', {
      description: 'AppKey for market-data App',
    });

    // Topic for monitoring guest system
    const monitorAlarm = new MonitorAlarm(this, `MonitorAlarm`, {
      notifyEmail: props.securityNotifyEmail,
      appKey: appKey.key,
    });

    // VPC
    //const prodVpc = new vpcClass(this, `Vpc`, props);
    const prodVpc = new PublicVpc(this, 'Vpc', {
      vpcIpAddresses: props.vpcCidr,
      flowLogsRetentionDays: 731,
      privateSubnetCidr: 22,
      vpcEndpoints: [
        VpcEndpointTypeName.CWLogs,
        VpcEndpointTypeName.DynamoDB,
        VpcEndpointTypeName.ECR,
        VpcEndpointTypeName.ECR_Docker,
        VpcEndpointTypeName.S3_Gateway,
      ],
    });

    // Container Repository
    const ecr = new Ecr(this, 'ECR', {
      repositoryName: `${PjPrefix.toLowerCase()}-sampleapp-repo`,
      alarmTopic: monitorAlarm.alarmTopic,
    });

    // Sample Handler
    // Build Container Image
    const build_handler_container = new ImageBuilder(this, `Handler-Container-Image`, {
      ecrRepository: ecr.repository,
      appName: 'sample_handler',
      appKey: appKey.key,
      region: props.env?.region,
      account: props.env?.account,
    });

    // Sample Handler Stream
    new cdk.aws_kinesis.Stream(this, 'Handler Stream', {
      encryption: cdk.aws_kinesis.StreamEncryption.KMS,
      encryptionKey: appKey.key,
    });

    // Sample Application Stack
    const handlerApp = new BaseApp(this, `Handler-App`, {
      myVpc: prodVpc.vpc,
      appKey: appKey.key,
      imageTag: build_handler_container.imageTag,
      repository: ecr.repository,
    });
    handlerApp.node.addDependency(build_handler_container);

    // Sample Composer
    // Build Container Image
    const build_composer_container = new ImageBuilder(this, `Composer-Container-Image`, {
      ecrRepository: ecr.repository,
      appName: 'sample_composer',
      appKey: appKey.key,
      region: props.env?.region,
      account: props.env?.account,
    });

    // Sample Composer Stream
    new cdk.aws_kinesis.Stream(this, 'Composer Stream', {
      encryption: cdk.aws_kinesis.StreamEncryption.KMS,
      encryptionKey: appKey.key,
    });

    // Sample Application Stack
    const composerApp = new BaseApp(this, `Composer-App`, {
      myVpc: prodVpc.vpc,
      appKey: appKey.key,
      imageTag: build_handler_container.imageTag,
      repository: ecr.repository,
    });
    composerApp.node.addDependency(build_composer_container);

    // DynamoDB to store composed data
    const dynamoDb = new DynamoDBClass(this, `composed-ddb`, {
      alarmTopic: monitorAlarm.alarmTopic,
      appKey: appKey.key,
    });
    dynamoDb.node.addDependency(appKey);
    dynamoDb.node.addDependency(monitorAlarm);

    // Sample Distributor
    // Build Container Image
    const build_composer_distributor = new ImageBuilder(this, `Distributor-Container-Image`, {
      ecrRepository: ecr.repository,
      appName: 'sample_distributor',
      appKey: appKey.key,
      region: props.env?.region,
      account: props.env?.account,
    });

    // WebACL for ALB
    const waf = new Waf(this, 'Waf', {
      name: `${id}-Waf`,
      description: `${id}-Waf`,
    });

    // Sample Application Stack
    const distributorApp = new DistributorApp(this, `Distributor-App`, {
      myVpc: prodVpc.vpc,
      appKey: appKey.key,
      imageTag: build_handler_container.imageTag,
      repository: ecr.repository,
      webAcl: waf.webAcl,
    });
    distributorApp.node.addDependency(build_composer_distributor);
  }
}
