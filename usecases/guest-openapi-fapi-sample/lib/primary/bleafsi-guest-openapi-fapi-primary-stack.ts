import * as cdk from 'aws-cdk-lib';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { VpcStack } from '../shared/bleafsi-vpc-stack';
import { KeycloakVersion } from '../shared/bleafsi-keycloak';

export interface RegionEnv {
  region: string;
  vpcCidr: string;
  tgwAsn: number;
}

export interface OpenApiFapiStackContextProps extends cdk.StackProps {
  pjPrefix: string;
  envKey: string;
  dbUser: string;
  keycloakContainerImageName: string;
  keycloakVersion: KeycloakVersion;
  primary: RegionEnv;
  secondary: RegionEnv;
}

/**
 *
 */
export class OpenApiFapiPrimaryStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;

  /**
   *
   * @param scope
   * @param id
   * @param props
   * @param appContext
   */
  constructor(scope: Construct, id: string, props: cdk.StackProps, appContext: OpenApiFapiStackContextProps) {
    super(scope, id, props);
    const pjPrefix = appContext.pjPrefix;

    // Networking VPC (stack)
    const primaryVpc = new VpcStack(this, `${pjPrefix}-Vpc`, {
      regionEnv: appContext.primary,
      oppositeRegionEnv: appContext.secondary,
      //env: props.env,
    });

    this.vpc = primaryVpc.myVpc;
  }
}
