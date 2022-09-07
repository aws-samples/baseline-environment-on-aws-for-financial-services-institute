import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_elasticloadbalancingv2 as elbv2 } from 'aws-cdk-lib';
import { BuildContainerStack } from './bleafsi-build-container-stack';
import { ECRStack } from './bleafsi-ecr-stack';
import { DbAuroraPgGlobalPrimaryStack } from './bleafsi-db-aurora-pg-global-primary-stack';
import { DbDynamoDbGlobalStack } from './bleafsi-db-dynamoDb-global-stack';
import { VpcStack } from '../shared/bleafsi-vpc-stack';
import { WafStack } from '../shared/bleafsi-waf-stack';
import { KeyAppStack } from '../shared/bleafsi-key-app-stack';
import { MonitorAlarmStack } from '../shared/bleafsi-monitor-alarm-stack';
import { PrimaryContainerAppSampleStack } from './bleafsi-primary-container-app-sample-stack';
import { PrivateHostedZoneStack } from './bleafsi-private-hosted-zone-stack';
import { CrossRegionSsmParamName } from '../shared/bleafsi-constants';
import { CoreBankingContextProps } from '../shared/bleafsi-types';

export class CoreBankingPrimaryStack extends cdk.Stack {
  public readonly PrimaryDB: DbAuroraPgGlobalPrimaryStack;
  public readonly vpc: ec2.Vpc;
  public readonly alb: elbv2.ApplicationLoadBalancer;
  public readonly dynamoDb: DbDynamoDbGlobalStack;

  constructor(scope: Construct, id: string, props: CoreBankingContextProps) {
    super(scope, id, props);

    const { pjPrefix, notifyEmail, primary, secondary, envName, dbUser } = props;

    // Topic for monitoring guest system
    const monitorPrimaryAlarm = new MonitorAlarmStack(this, `${pjPrefix}-MonitorAlarm`, { notifyEmail });

    // CMK for Primary Apps
    const primaryAppKey = new KeyAppStack(this, `${pjPrefix}-AppKey`);

    // Networking
    const primaryVpc = new VpcStack(this, `${pjPrefix}-Vpc`, {
      regionEnv: primary,
      oppositeRegionEnv: secondary,
    });
    primaryVpc.addTgwIdToSsmParam(CrossRegionSsmParamName.TGW_PRIMARY_ID, primary.region, envName);
    this.vpc = primaryVpc.myVpc;

    // WebACL for ALB
    const waf = new WafStack(this, `${pjPrefix}-Waf`, {
      scope: 'REGIONAL',
    });

    // Container Repository
    const ecr = new ECRStack(this, `${pjPrefix}-ECR`, {
      // TODO: will get "repositoryName" from parameters
      repositoryName: 'apprepo',
      alarmTopic: monitorPrimaryAlarm.alarmTopic,
      secondaryRegion: secondary.region,
    });

    // Build Container Image
    const build_container = new BuildContainerStack(this, `${pjPrefix}-ContainerImage`, {
      ecrRepository: ecr.repository,
    });

    // Sample Application Stack (LoadBalancer + Fargate)
    const ecsApp = new PrimaryContainerAppSampleStack(this, `${pjPrefix}-ECSApp`, {
      envName,
      myVpc: primaryVpc.myVpc,
      webAcl: waf.webAcl,
      repository: ecr.repository,
      imageTag: build_container.imageTag,
      appKey: primaryAppKey.kmsKey,
      primary,
    });
    ecsApp.addDependency(build_container);
    this.alb = ecsApp.appAlb;

    // Route 53 Private Hosted Zone
    const privateHostedZoneStack = new PrivateHostedZoneStack(this, `${pjPrefix}-PrivateHostedZone`, {
      myVpc: primaryVpc.myVpc,
      alb: this.alb,
      primary,
      envName,
    });
    privateHostedZoneStack.addDependency(ecsApp);

    // DynamoDB for transaction management
    this.dynamoDb = new DbDynamoDbGlobalStack(this, `${pjPrefix}-transaction-DBDynamoDb`, {
      primary,
      secondary,
    });
    this.dynamoDb.addDependency(primaryAppKey);

    // Aurora Global DB
    this.PrimaryDB = new DbAuroraPgGlobalPrimaryStack(this, `${pjPrefix}-DBAuroraPg`, {
      myVpc: primaryVpc.myVpc,
      dbName: 'mydbname',
      dbUser,
      dbAllocatedStorage: 25,
      vpcSubnets: primaryVpc.myVpc.selectSubnets({
        subnetGroupName: 'Protected',
      }),
      appServerSecurityGroup: ecsApp.appServerSecurityGroup,
      appKey: primaryAppKey.kmsKey,
      alarmTopic: monitorPrimaryAlarm.alarmTopic,
      secondaryRegion: secondary.region,
    });
  }
}
