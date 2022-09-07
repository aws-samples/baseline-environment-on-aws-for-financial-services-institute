import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { VpcStack } from '../shared/bleafsi-vpc-stack';
import { DbAuroraPgGlobalMemberStack } from './bleafsi-db-aurora-pg-global-member-stack';
import { WafStack } from '../shared/bleafsi-waf-stack';
import { KeyAppStack } from '../shared/bleafsi-key-app-stack';
import { MonitorAlarmStack } from '../shared/bleafsi-monitor-alarm-stack';
import { SecondaryContainerAppSampleStack } from './bleafsi-secondary-container-app-sample-stack';
import { CrossRegionSsmParamName } from '../shared/bleafsi-constants';
import { AssociateVpcWithZoneStack } from './bleafsi-associate-vpc-with-zone-stack';
import { CoreBankingContextProps } from '../shared/bleafsi-types';

export class CoreBankingSecondaryStack extends cdk.Stack {
  public readonly SecondaryDB: DbAuroraPgGlobalMemberStack;

  constructor(scope: Construct, id: string, props: CoreBankingContextProps) {
    super(scope, id, props);

    const { pjPrefix, notifyEmail, primary, secondary, envName, dbUser } = props;

    // Topic for monitoring guest system
    const monitorSecondaryAlarm = new MonitorAlarmStack(this, `${pjPrefix}-MonitorAlarm`, { notifyEmail });

    // CMK for Primary Apps
    const secondaryAppKey = new KeyAppStack(this, `${pjPrefix}-AppKey`);
    secondaryAppKey.putKeyArnToSsmParam(CrossRegionSsmParamName.KMS_SECONDARY_APP_KEY_ARN, primary.region, envName);

    // Networking
    const secondaryVpc = new VpcStack(this, `${pjPrefix}-Vpc`, {
      regionEnv: secondary,
      oppositeRegionEnv: primary,
    });
    secondaryVpc.createTgwPeeringAttachment(CrossRegionSsmParamName.TGW_PRIMARY_ID, primary.region, envName);

    // Route 53 Private Hosted Zone
    const associateVpcWithHostedZone = new AssociateVpcWithZoneStack(this, `${pjPrefix}-AssociateVpcWithHostedZone`, {
      myVpc: secondaryVpc.myVpc,
      primary,
      envName,
    });
    associateVpcWithHostedZone.addDependency(secondaryVpc);

    // WebACL for ALB
    const waf = new WafStack(this, `${pjPrefix}-Waf`, {
      scope: 'REGIONAL',
    });

    // Sample Application Stack (LoadBalancer + Fargate)
    const ecsApp = new SecondaryContainerAppSampleStack(this, `${pjPrefix}-ECSApp`, {
      envName,
      myVpc: secondaryVpc.myVpc,
      webAcl: waf.webAcl,
      appKey: secondaryAppKey.kmsKey,
      primary,
    });

    // Aurora Global DB
    this.SecondaryDB = new DbAuroraPgGlobalMemberStack(this, `${pjPrefix}-DBAuroraPg`, {
      myVpc: secondaryVpc.myVpc,
      dbName: 'mydbname',
      dbUser,
      dbAllocatedStorage: 25,
      vpcSubnets: secondaryVpc.myVpc.selectSubnets({
        subnetGroupName: 'Protected',
      }),
      appServerSecurityGroup: ecsApp.appServerSecurityGroup,
      appKey: secondaryAppKey.kmsKey,
      alarmTopic: monitorSecondaryAlarm.alarmTopic,
    });
  }
}
