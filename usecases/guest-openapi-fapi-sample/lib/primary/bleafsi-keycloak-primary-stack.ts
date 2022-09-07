import * as cdk from 'aws-cdk-lib';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as keycloak from '../shared/bleafsi-keycloak';

export interface KeycloakPrimaryProps extends cdk.StackProps {
  myVpc: ec2.Vpc;
  dbName: string;
  dbUser: string;
  keycloakContainerImageName: string;
  keycloakVersion: keycloak.KeycloakVersion;
}

/**
 * Keycloak environment for Primary region.
 */
export class KeycloakPrimaryStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: KeycloakPrimaryProps) {
    super(scope, id, props);

    // create L3 Construct for Keycloak
    new keycloak.Keycloak(this, 'Keycloak', {
      auroraServerlessV1: false,
      vpc: props.myVpc,
      publicSubnets: props.myVpc.selectSubnets({ subnetType: ec2.SubnetType.PUBLIC, onePerAz: true }),
      privateSubnets: props.myVpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_NAT, onePerAz: true }),
      databaseSubnets: props.myVpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED, onePerAz: true }),
      nodeCount: 2,
      autoScaleTask: {
        min: 2,
        max: 10,
        targetCpuUtilization: 80,
      },
      keycloakContainerImageName: props.keycloakContainerImageName,
      keycloakVersion: props.keycloakVersion,
    });
  }
}
