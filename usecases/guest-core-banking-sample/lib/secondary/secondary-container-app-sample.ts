import { Construct } from 'constructs';
import { aws_wafv2 as wafv2 } from 'aws-cdk-lib';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_kms as kms } from 'aws-cdk-lib';
import { aws_ecr as ecr } from 'aws-cdk-lib';
import { CrossRegionSsmParam } from '../shared/cross-region-ssm-param';
import { CrossRegionSsmParamName } from '../shared/constants';
import { RegionEnv } from 'bin/parameter';
import { ContainerAppSampleBase } from '../shared/container-app-sample-base';

/*
 * サンプルコンテナアプリケーションの作成（Secondary Region）
 */

export interface SecondaryContainerAppSampleProps {
  envName: string;
  myVpc: ec2.Vpc;
  webAcl: wafv2.CfnWebACL;
  appKey: kms.IKey;
  primary: RegionEnv;
}

export class SecondaryContainerAppSample extends Construct {
  public readonly appServerSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: SecondaryContainerAppSampleProps) {
    super(scope, id);

    const { envName, myVpc, webAcl, appKey, primary } = props;

    // SSM Parameter to get ECR Image Tag and Repository Name
    const crossRegionSsmParam = new CrossRegionSsmParam(this, 'crossRegionSsmParam', {
      baseRegion: primary.region,
      envName,
    });
    const imageTag = crossRegionSsmParam.get(CrossRegionSsmParamName.ECR_APP_IMAGE_TAG);
    const repositoryName = crossRegionSsmParam.get(CrossRegionSsmParamName.ECR_APP_REPOSITORY_NAME);

    const repository = ecr.Repository.fromRepositoryName(this, 'ecrRepository', repositoryName);

    // container app sample
    const containerappSampleBase = new ContainerAppSampleBase(this, `containerAppSampleBase`, {
      myVpc,
      webAcl,
      appKey,
      imageTag,
      repository,
    });
    this.appServerSecurityGroup = containerappSampleBase.appServerSecurityGroup;
    containerappSampleBase.node.addDependency(crossRegionSsmParam);
  }
}
