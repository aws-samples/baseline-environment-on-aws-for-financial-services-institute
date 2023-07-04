import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { PjPrefix, StackParameter } from '../../bin/parameter';
import { Vpc } from '../shared/vpc';
import * as keycloak from '../shared/keycloak';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';

/*
 * BLEA-FSI OpenAPI Fapi Sample application stack class
 */
export class OpenApiFapiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: StackParameter) {
    super(scope, id, props);

    // OpenAPI Fapi Primary VPC
    const primaryVpc = new Vpc(this, `Vpc`, props.primaryRegion.vpcCidr);

    // create L3 Construct for Keycloak
    new keycloak.Keycloak(this, 'Keycloak', {
      auroraServerlessV1: false,
      vpc: primaryVpc.vpc,
      publicSubnets: primaryVpc.vpc.selectSubnets({ subnetType: ec2.SubnetType.PUBLIC, onePerAz: true }),
      privateSubnets: primaryVpc.vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, onePerAz: true }),
      databaseSubnets: primaryVpc.vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED, onePerAz: true }),
      nodeCount: 2,
      autoScaleTask: {
        min: 2,
        max: 10,
        targetCpuUtilization: 80,
      },
      keycloakContainerImageName: props.keycloakContainerImageName,
      keycloakVersion: keycloak.KeycloakVersion.of(props.keycloakContainerVersionTag),
    });
  }
}
