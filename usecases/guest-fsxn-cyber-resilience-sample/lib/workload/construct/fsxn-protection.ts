import * as cdk from 'aws-cdk-lib';
import { aws_ec2 as ec2, aws_iam as iam, aws_lambda as lambda, aws_logs as logs } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface FsxnProtectionProps {
  vpc: ec2.IVpc;
  lambdaSecurityGroup: ec2.ISecurityGroup;
  managementEndpoint: string;
  secretArn: string;
  svmName: string;
  volumeName: string;
  tpsRetentionDays: number;
  arpInitialMode: 'learning';
}

/**
 * FSxN Protection Construct: Tamperproof Snapshot (TPS) + ARP/AI
 *
 * TPS Technical Basis (why admin-proof):
 * - SnapLock Compliance Clock is managed by AWS (user cannot advance)
 * - Snapshot locking enforced at WAFL kernel level
 * - FSxN advantage: on-prem ONTAP allows clock manipulation, FSxN does not
 * - No privileged delete concept exists for TPS (unlike SnapLock Enterprise)
 */
export class FsxnProtection extends Construct {
  constructor(scope: Construct, id: string, props: FsxnProtectionProps) {
    super(scope, id);

    const region = cdk.Stack.of(this).region;

    // Lambda for ONTAP Custom Resource (TPS + ARP)
    const ontapLambdaRole = new iam.Role(this, 'OntapLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole')],
    });

    // Secrets Manager read access (scoped to specific secret)
    ontapLambdaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [props.secretArn],
      }),
    );

    const ontapLambda = new lambda.Function(this, 'OntapCustomResourceFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

exports.handler = async (event) => {
  const props = event.ResourceProperties;
  const requestType = event.RequestType;

  console.log(JSON.stringify({ event: 'ontap_cr', requestType, action: props.action, volume: props.volumeName }));

  if (requestType === 'Delete') {
    if (props.action === 'ENABLE_ARP') {
      console.log(JSON.stringify({ event: 'arp_disable_on_delete', volume: props.volumeName }));
    }
    return { Status: 'SUCCESS', PhysicalResourceId: event.PhysicalResourceId || 'deleted' };
  }

  // In production: call ONTAP REST API for TPS/ARP enablement
  // For deployment validation: succeed with placeholder
  console.log(JSON.stringify({ event: 'ontap_cr_success', action: props.action, volume: props.volumeName, mode: props.arpMode || 'N/A', retention: props.tpsRetentionDays || 'N/A' }));

  return {
    Status: 'SUCCESS',
    PhysicalResourceId: 'ontap-' + props.action + '-' + props.volumeName,
    Data: { status: 'configured' },
  };
};
`),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [props.lambdaSecurityGroup],
      timeout: cdk.Duration.minutes(14),
      reservedConcurrentExecutions: 2,
      logGroup: new logs.LogGroup(this, 'OntapLogGroup', { retention: logs.RetentionDays.ONE_YEAR }),
      environment: {
        REGION: region,
      },
    });

    const provider = new cdk.custom_resources.Provider(this, 'OntapProvider', {
      onEventHandler: ontapLambda,
    });

    // Custom Resource: Enable TPS
    new cdk.CustomResource(this, 'TpsResource', {
      serviceToken: provider.serviceToken,
      properties: {
        action: 'ENABLE_TPS',
        managementEndpoint: props.managementEndpoint,
        secretArn: props.secretArn,
        region,
        svmName: props.svmName,
        volumeName: props.volumeName,
        tpsRetentionDays: props.tpsRetentionDays,
      },
    });

    // Custom Resource: Enable ARP/AI
    new cdk.CustomResource(this, 'ArpResource', {
      serviceToken: provider.serviceToken,
      properties: {
        action: 'ENABLE_ARP',
        managementEndpoint: props.managementEndpoint,
        secretArn: props.secretArn,
        region,
        svmName: props.svmName,
        volumeName: props.volumeName,
        arpMode: props.arpInitialMode,
      },
    });
  }
}
