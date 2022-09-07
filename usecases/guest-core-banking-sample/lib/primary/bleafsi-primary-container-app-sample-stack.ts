import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_wafv2 as wafv2 } from 'aws-cdk-lib';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_elasticloadbalancingv2 as elbv2 } from 'aws-cdk-lib';
import { aws_kms as kms } from 'aws-cdk-lib';
import { aws_ecr as ecr } from 'aws-cdk-lib';
import { CrossRegionSsmParam } from '../shared/bleafsi-cross-region-ssm-param-stack';
import { CrossRegionSsmParamName } from '../shared/bleafsi-constants';
import { ContainerAppSampleBaseStack } from '../shared/bleafsi-container-app-sample-base-stack';
import { RegionEnv } from '../shared/bleafsi-types';

export interface PrimaryContainerAppSampleProps extends cdk.NestedStackProps {
  envName: string;
  myVpc: ec2.Vpc;
  webAcl: wafv2.CfnWebACL;
  appKey: kms.IKey;
  imageTag: string;
  repository: ecr.IRepository;
  primary: RegionEnv;
}

export class PrimaryContainerAppSampleStack extends cdk.NestedStack {
  public readonly appAlb: elbv2.ApplicationLoadBalancer;
  public readonly appServerSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: PrimaryContainerAppSampleProps) {
    super(scope, id, props);

    const { envName, myVpc, webAcl, appKey, imageTag, repository, primary } = props;

    const containerappSampleBase = new ContainerAppSampleBaseStack(this, `containerAppSampleBase`, {
      myVpc,
      webAcl,
      appKey,
      imageTag,
      repository,
    });
    this.appAlb = containerappSampleBase.appAlb;
    this.appServerSecurityGroup = containerappSampleBase.appServerSecurityGroup;

    const crossRegionSsmParam = new CrossRegionSsmParam(this, 'crossRegionSsmParam', {
      baseRegion: primary.region,
      envName,
    });
    crossRegionSsmParam.put(CrossRegionSsmParamName.ECR_APP_IMAGE_TAG, imageTag);
    crossRegionSsmParam.put(CrossRegionSsmParamName.ECR_APP_REPOSITORY_NAME, repository.repositoryName);
    crossRegionSsmParam.addDependency(containerappSampleBase);
  }
}
