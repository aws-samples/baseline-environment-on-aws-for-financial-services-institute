import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_wafv2 as wafv2 } from 'aws-cdk-lib';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_kms as kms } from 'aws-cdk-lib';
import { aws_ecr as ecr } from 'aws-cdk-lib';
import { CrossRegionSsmParam } from '../shared/bleafsi-cross-region-ssm-param-stack';
import { CrossRegionSsmParamName } from '../shared/bleafsi-constants';
import { RegionEnv } from '../shared/bleafsi-types';
import { ContainerAppSampleBaseStack } from '../shared/bleafsi-container-app-sample-base-stack';

export interface SecondaryContainerAppSampleProps extends cdk.NestedStackProps {
  envName: string;
  myVpc: ec2.Vpc;
  webAcl: wafv2.CfnWebACL;
  appKey: kms.IKey;
  primary: RegionEnv;
}

export class SecondaryContainerAppSampleStack extends cdk.NestedStack {
  public readonly appServerSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: SecondaryContainerAppSampleProps) {
    super(scope, id, props);

    const { envName, myVpc, webAcl, appKey, primary } = props;

    const crossRegionSsmParam = new CrossRegionSsmParam(this, 'crossRegionSsmParam', {
      baseRegion: primary.region,
      envName,
    });
    const imageTag = crossRegionSsmParam.get(CrossRegionSsmParamName.ECR_APP_IMAGE_TAG);
    const repositoryName = crossRegionSsmParam.get(CrossRegionSsmParamName.ECR_APP_REPOSITORY_NAME);

    const repository = ecr.Repository.fromRepositoryName(this, 'ecrRepository', repositoryName);

    const containerappSampleBase = new ContainerAppSampleBaseStack(this, `containerAppSampleBase`, {
      myVpc,
      webAcl,
      appKey,
      imageTag,
      repository,
    });
    this.appServerSecurityGroup = containerappSampleBase.appServerSecurityGroup;
    containerappSampleBase.addDependency(crossRegionSsmParam);
  }
}
