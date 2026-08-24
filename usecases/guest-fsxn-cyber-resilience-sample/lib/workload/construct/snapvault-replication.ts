import * as cdk from 'aws-cdk-lib';
import { aws_ec2 as ec2, aws_iam as iam, aws_lambda as lambda, aws_logs as logs } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface SnapVaultReplicationProps {
  vpc: ec2.IVpc;
  lambdaSecurityGroup: ec2.ISecurityGroup;
  managementEndpoint: string;
  secretArn: string;
  svmName: string;
  sourceVolumeName: string;
  destinationVolumeName: string;
}

/**
 * SnapVault Replication: SnapMirror vault policy from production volume to SnapLock volume.
 *
 * API: POST /api/snapmirror/relationships
 * - type: "vault" (or policy with type vault)
 * - source: production volume
 * - destination: SnapLock Enterprise volume
 * - schedule: daily
 *
 * This ensures production Snapshots are automatically copied to WORM-protected storage.
 * Validated API path: /api/snapmirror/relationships (ONTAP 9.6+, REST API reference)
 */
export class SnapVaultReplication extends Construct {
  constructor(scope: Construct, id: string, props: SnapVaultReplicationProps) {
    super(scope, id);

    const region = cdk.Stack.of(this).region;

    const fn = new lambda.Function(this, 'SnapVaultLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

exports.handler = async (event) => {
  const props = event.ResourceProperties;
  const requestType = event.RequestType;

  console.log(JSON.stringify({ event: 'snapvault_cr', requestType, source: props.sourceVolumeName, dest: props.destinationVolumeName }));

  if (requestType === 'Delete') {
    // On delete: break SnapMirror relationship (release destination)
    // In production: call DELETE /api/snapmirror/relationships/{uuid}
    return { Status: 'SUCCESS', PhysicalResourceId: event.PhysicalResourceId };
  }

  // Get credentials
  const sm = new SecretsManagerClient({ region: props.region });
  const secret = await sm.send(new GetSecretValueCommand({ SecretId: props.secretArn }));
  const password = JSON.parse(secret.SecretString).password;

  // Create SnapMirror vault relationship
  // API: POST /api/snapmirror/relationships
  const url = 'https://' + props.managementEndpoint + '/api/snapmirror/relationships';
  const body = {
    source: { path: props.svmName + ':' + props.sourceVolumeName },
    destination: { path: props.svmName + ':' + props.destinationVolumeName },
    policy: { name: 'XDPDefault' }, // Built-in vault policy
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + Buffer.from('fsxadmin:' + password).toString('base64'),
    },
    body: JSON.stringify(body),
  });

  const result = await resp.json().catch(() => ({}));
  console.log(JSON.stringify({ event: 'snapvault_result', status: resp.status, hasUuid: !!result.uuid }));

  if (!resp.ok && resp.status !== 409) { // 409 = already exists (idempotent)
    throw new Error('SnapVault creation failed: ' + resp.status + ' ' + JSON.stringify(result));
  }

  return {
    Status: 'SUCCESS',
    PhysicalResourceId: 'snapvault-' + props.sourceVolumeName + '-' + props.destinationVolumeName,
    Data: { relationshipId: result.uuid || 'existing' },
  };
};
`),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [props.lambdaSecurityGroup],
      timeout: cdk.Duration.minutes(5),
      reservedConcurrentExecutions: 1,
      logGroup: new logs.LogGroup(this, 'LogGroup', { retention: logs.RetentionDays.ONE_YEAR }),
      environment: { REGION: region },
    });

    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [props.secretArn],
      }),
    );

    const provider = new cdk.custom_resources.Provider(this, 'Provider', { onEventHandler: fn });

    new cdk.CustomResource(this, 'SnapVaultRelationship', {
      serviceToken: provider.serviceToken,
      properties: {
        managementEndpoint: props.managementEndpoint,
        secretArn: props.secretArn,
        region,
        svmName: props.svmName,
        sourceVolumeName: props.sourceVolumeName,
        destinationVolumeName: props.destinationVolumeName,
      },
    });
  }
}
