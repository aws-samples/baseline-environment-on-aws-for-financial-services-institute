import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { PrivateVpc, PublicVpc, VpcEndpointTypeName } from '../lib/bleafsi-vpc';

/*
 * このサブプロジェクトのlib配下に作成した VPC Construct をテストするためのStack
 */

export class VpcStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    //1 private vpc with vpc endpoints
    const vpc1 = new PrivateVpc(this, 'SampleVpc1', {
      privateSubnetCidr: 22,
      vpcEndpoints: [
        VpcEndpointTypeName.CWLogs,
        VpcEndpointTypeName.DynamoDB,
        VpcEndpointTypeName.ECR,
        VpcEndpointTypeName.ECR_Docker,
        VpcEndpointTypeName.S3_Gateway,
        VpcEndpointTypeName.S3_Interface,
        VpcEndpointTypeName.SecretsManager,
        VpcEndpointTypeName.SSM,
        VpcEndpointTypeName.Glue,
        VpcEndpointTypeName.KMS,
      ],
    });

    //2 private vpc using custom cidr
    const vpc2 = new PrivateVpc(this, 'SampleVpc2', {
      vpcIpAddresses: '10.2.0.0/16',
    });

    // public VPC with vpc endpoints
    const vpc3 = new PublicVpc(this, 'SampleVpc3', {
      privateSubnetCidr: 22,
      publicSubnetCidr: 20,
      vpcIpAddresses: '10.4.0.0/16',
      vpcEndpoints: [VpcEndpointTypeName.S3_Gateway],
    });

    //CFn output
    new cdk.CfnOutput(this, 'Vpc1 Private', {
      value: vpc1.vpc.vpcArn,
    });
    new cdk.CfnOutput(this, 'Vpc2 Private', {
      value: vpc2.vpc.vpcArn,
    });
    new cdk.CfnOutput(this, 'Vpc3 Public', {
      value: vpc3.vpc.vpcArn,
    });
  }
}
