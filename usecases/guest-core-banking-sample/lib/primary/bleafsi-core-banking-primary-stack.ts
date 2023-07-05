import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_elasticloadbalancingv2 as elbv2 } from 'aws-cdk-lib';
import { BuildContainer } from './build-container';
import { ECR } from './ecr';
import { DbAuroraPgGlobalPrimary } from './db-aurora-pg-global-primary';
import { DbDynamoDbGlobal } from './db-dynamoDb-global';
import { Vpc } from '../shared/vpc';
import { Waf } from '../shared/waf';
import { KeyApp } from '../shared/key-app';
import { MonitorAlarm } from '../shared/monitor-alarm';
import { PrimaryContainerAppSample } from './primary-container-app-sample';
import { PrivateHostedZone } from './private-hosted-zone';
import { CrossRegionSsmParamName } from '../shared/constants';
import { StackParameter, SampleEcsAppParameter, SampleMultiRegionAppParameter } from '../../bin/parameter';
import { NlbOnlyForTest } from './nlb-only-for-test';
//マルチリージョン 勘定系サンプルアプリ
import { SampleMultiRegionApp } from '../shared/sample-multi-region-app/app';
import { SampleAppClient } from '../shared/sample-multi-region-app/app-client';
/*
 * BLEA-FSI Core Banking Sample application stack(Primaly Region)
 */

export class CoreBankingPrimaryStack extends cdk.Stack {
  public readonly PrimaryDB: DbAuroraPgGlobalPrimary;
  public readonly tgwRouteTableId: string;
  public readonly alb: elbv2.ApplicationLoadBalancer;
  public readonly dynamoDb: DbDynamoDbGlobal;
  public readonly hostedZone: PrivateHostedZone;

  constructor(scope: Construct, id: string, props: StackParameter) {
    super(scope, id, props);

    const { notifyEmail, primary, secondary, envName, dbUser, hostedZoneName } = props;

    // Topic for monitoring guest system
    const monitorPrimaryAlarm = new MonitorAlarm(this, `MonitorAlarm`, { notifyEmail });

    // CMK for Primary Apps
    const primaryAppKey = new KeyApp(this, `AppKey`);

    // Networking
    const primaryVpc = new Vpc(this, `Vpc`, {
      regionEnv: primary,
      oppositeRegionCidrs: [secondary.vpcCidr],
    });
    primaryVpc.addTgwIdToSsmParam(CrossRegionSsmParamName.TGW_PRIMARY_ID, primary.region, envName);

    // WebACL for ALB
    const waf = new Waf(this, `Waf`, {
      scope: 'REGIONAL',
    });

    //ECSサンプルアプリのデプロイ
    let ecsApp;
    if (SampleEcsAppParameter.deploy == true) {
      // Container Repository
      const ecr = new ECR(this, `ECR`, {
        repositoryName: 'apprepo',
        alarmTopic: monitorPrimaryAlarm.alarmTopic,
        secondaryRegion: secondary.region,
      });

      // Build Container Image
      const build_container = new BuildContainer(this, `ContainerImage`, {
        ecrRepository: ecr.repository,
      });

      // Sample Application Stack (LoadBalancer + Fargate)
      ecsApp = new PrimaryContainerAppSample(this, `ECSApp`, {
        envName,
        myVpc: primaryVpc.myVpc,
        webAcl: waf.webAcl,
        repository: ecr.repository,
        imageTag: build_container.imageTag,
        appKey: primaryAppKey.kmsKey,
        primary,
      });
      ecsApp.node.addDependency(build_container);
      this.alb = ecsApp.appAlb;

      // NLB only for test
      if (SampleEcsAppParameter.createTestResource) {
        const nlb = new NlbOnlyForTest(this, `Nlb`, {
          myVpc: primaryVpc.myVpc,
          targetAlb: this.alb,
        });
        nlb.node.addDependency(ecsApp);
      }
    }

    // Route 53 Private Hosted Zone
    const privateHostedZoneConstruct = new PrivateHostedZone(this, `PrivateHostedZone`, {
      myVpc: primaryVpc.myVpc,
      alb: this.alb,
      primary,
      envName,
      zoneName: hostedZoneName,
    });
    this.hostedZone = privateHostedZoneConstruct;
    if (ecsApp != null) {
      //private hosted zone にECSアプリへの依存関係を設定
      privateHostedZoneConstruct.node.addDependency(ecsApp);
    }

    // DynamoDB for transaction management
    this.dynamoDb = new DbDynamoDbGlobal(this, `transaction-DBDynamoDb`, {
      primary,
      secondary,
    });
    this.dynamoDb.node.addDependency(primaryAppKey);

    // Aurora Global DB
    this.PrimaryDB = new DbAuroraPgGlobalPrimary(this, `DBAuroraPg`, {
      myVpc: primaryVpc.myVpc,
      dbName: 'mydbname',
      dbUser,
      dbAllocatedStorage: 25,
      vpcSubnets: primaryVpc.myVpc.selectSubnets({
        subnetGroupName: 'Protected',
      }),
      appServerSecurityGroup: ecsApp?.appServerSecurityGroup,
      appKey: primaryAppKey.kmsKey,
      alarmTopic: monitorPrimaryAlarm.alarmTopic,
      secondaryRegion: secondary.region,
    });

    this.tgwRouteTableId = primaryVpc.getTgwRouteTableId(this);

    //マルチリージョン 勘定系サンプルアプリのデプロイ
    if (SampleMultiRegionAppParameter.deploy == true) {
      new SampleMultiRegionApp(this, 'SampleMultiRegionApp', {
        mainDynamoDbTableName: this.dynamoDb.tableName,
        balanceDatabase: this.PrimaryDB,
        countDatabase: this.PrimaryDB,
        vpc: primaryVpc.myVpc,
        hostedZone: this.hostedZone.privateHostedZone,
      });

      new SampleAppClient(this, 'SampleAppClient', {
        vpcCidr: SampleMultiRegionAppParameter.appClientVpcCidr,
        parentVpc: primaryVpc.myVpc,
        transitGateway: primaryVpc.tgw,
        hostedZone: this.hostedZone.privateHostedZone,
        secondaryVpcCidr: secondary.vpcCidr,
      });
    }
  }
}
