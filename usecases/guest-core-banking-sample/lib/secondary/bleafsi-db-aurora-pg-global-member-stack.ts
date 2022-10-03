import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_rds as rds } from 'aws-cdk-lib';
import { aws_kms as kms } from 'aws-cdk-lib';
import { aws_logs as logs } from 'aws-cdk-lib';
import { aws_sns as sns } from 'aws-cdk-lib';
import { aws_cloudwatch as cw } from 'aws-cdk-lib';
import { aws_cloudwatch_actions as cw_actions } from 'aws-cdk-lib';

export interface DbAuroraPgGlobalMemberProps extends cdk.NestedStackProps {
  myVpc: ec2.Vpc;
  dbName: string;
  dbUser: string;
  dbAllocatedStorage: number;
  appKey: kms.IKey;
  vpcSubnets: ec2.SubnetSelection;
  appServerSecurityGroup: ec2.SecurityGroup;
  alarmTopic: sns.Topic;
}

export class DbAuroraPgGlobalMemberStack extends cdk.NestedStack {
  constructor(scope: Construct, id: string, props: DbAuroraPgGlobalMemberProps) {
    super(scope, id, props);

    const rdsSecurityGroup = new ec2.SecurityGroup(this, 'SgRds', {
      vpc: props.myVpc,
      allowAllOutbound: false,
    });

    const cluster = new rds.DatabaseCluster(this, 'AuroraCluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_11_9,
      }),
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.R5, ec2.InstanceSize.LARGE),
        vpcSubnets: props.vpcSubnets,
        vpc: props.myVpc,
        enablePerformanceInsights: true,
        performanceInsightEncryptionKey: props.appKey,
        performanceInsightRetention: rds.PerformanceInsightRetention.DEFAULT, // 7 days
        securityGroups: [rdsSecurityGroup],
      },
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
      storageEncrypted: true,
      storageEncryptionKey: props.appKey,
      cloudwatchLogsExports: ['postgresql'],
      cloudwatchLogsRetention: logs.RetentionDays.THREE_MONTHS,
      instanceIdentifierBase: 'instance',
    });

    cluster.connections.allowDefaultPortFrom(props.appServerSecurityGroup);

    // パスワードをローテーションする
    // cluster.addRotationSingleUser();

    const cfnCluster = cluster.node.defaultChild as rds.CfnDBCluster;
    cfnCluster.masterUsername = undefined;
    cfnCluster.masterUserPassword = undefined;
    cfnCluster.globalClusterIdentifier = 'core-banking-global-db';

    // cluster.connections.allowDefaultPortFrom(props.appServerSecurityGroup);

    // ----------------------- Alarms for RDS -----------------------------
    // Aurora Cluster CPU Utilization
    cluster
      .metricCPUUtilization({
        period: cdk.Duration.minutes(1),
        statistic: cw.Statistic.AVERAGE,
      })
      .createAlarm(this, 'AuroraCPUUtil', {
        evaluationPeriods: 3,
        datapointsToAlarm: 3,
        threshold: 90,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        actionsEnabled: true,
      })
      .addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));
    // ----------------------- RDS Event Subscription  -----------------------------
    //   Send critical(see eventCategories) event on all of clusters and instances
    //
    // See: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-rds-eventsubscription.html
    // See: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_Events.html
    //
    // To specify clusters or instances, add "sourceType (sting)" and "sourceIds (list)"
    // sourceType is one of these - db-instance | db-cluster | db-parameter-group | db-security-group | db-snapshot | db-cluster-snapshot
    //
    new rds.CfnEventSubscription(this, 'RdsEventsCluster', {
      snsTopicArn: props.alarmTopic.topicArn,
      enabled: true,
      sourceType: 'db-cluster',
      eventCategories: ['failure', 'failover', 'maintenance'],
    });

    new rds.CfnEventSubscription(this, 'RdsEventsInstances', {
      snsTopicArn: props.alarmTopic.topicArn,
      enabled: true,
      sourceType: 'db-instance',
      eventCategories: [
        'availability',
        'configuration change',
        'deletion',
        'failover',
        'failure',
        'maintenance',
        'notification',
        'recovery',
      ],
    });
  }
}
