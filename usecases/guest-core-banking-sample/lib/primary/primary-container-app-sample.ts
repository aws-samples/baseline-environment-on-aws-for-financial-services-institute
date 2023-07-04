import { Construct } from 'constructs';
import { aws_wafv2 as wafv2 } from 'aws-cdk-lib';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_elasticloadbalancingv2 as elbv2 } from 'aws-cdk-lib';
import { aws_kms as kms } from 'aws-cdk-lib';
import { aws_ecr as ecr } from 'aws-cdk-lib';
import { CrossRegionSsmParam } from '../shared/cross-region-ssm-param';
import { CrossRegionSsmParamName } from '../shared/constants';
import { ContainerAppSampleBase } from '../shared/container-app-sample-base';
import { RegionEnv } from 'bin/parameter';

/*
 * サンプルコンテナアプリケーションの作成（Primary Region）
 */

export interface PrimaryContainerAppSampleProps {
  envName: string;
  myVpc: ec2.Vpc;
  webAcl: wafv2.CfnWebACL;
  appKey: kms.IKey;
  imageTag: string;
  repository: ecr.IRepository;
  primary: RegionEnv;
}

export class PrimaryContainerAppSample extends Construct {
  public readonly appAlb: elbv2.ApplicationLoadBalancer;
  public readonly appServerSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: PrimaryContainerAppSampleProps) {
    super(scope, id);

    const { envName, myVpc, webAcl, appKey, imageTag, repository, primary } = props;

    // container app sample
    const containerappSampleBase = new ContainerAppSampleBase(this, `containerAppSampleBase`, {
      myVpc,
      webAcl,
      appKey,
      imageTag,
      repository,
    });
    this.appAlb = containerappSampleBase.appAlb;
    this.appServerSecurityGroup = containerappSampleBase.appServerSecurityGroup;

    // SSM Parameter to put Image Tag and ECR Repository Name
    const crossRegionSsmParam = new CrossRegionSsmParam(this, 'crossRegionSsmParam', {
      baseRegion: primary.region,
      envName,
    });
    crossRegionSsmParam.put(CrossRegionSsmParamName.ECR_APP_IMAGE_TAG, imageTag);
    crossRegionSsmParam.put(CrossRegionSsmParamName.ECR_APP_REPOSITORY_NAME, repository.repositoryName);
    crossRegionSsmParam.node.addDependency(containerappSampleBase);
  }
}
