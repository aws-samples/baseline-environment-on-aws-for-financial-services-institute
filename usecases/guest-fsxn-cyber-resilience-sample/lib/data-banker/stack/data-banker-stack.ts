import * as cdk from 'aws-cdk-lib';
import { aws_backup as backup, aws_iam as iam, aws_ram as ram } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface DataBankerStackProps extends cdk.StackProps {
  envName: string;
  vaultLockRetentionDays: number;
  restoreAccountId?: string;
}

/**
 * Data Banker Account Stack: Logically Air-gapped Backup Vault.
 *
 * This stack deploys in a separate AWS account to provide isolation
 * from the workload account. Even if the workload account is fully
 * compromised, backups in this vault cannot be deleted.
 *
 * Protection layers:
 * 1. Separate AWS account (requires separate credentials)
 * 2. Vault Lock (min retention cannot be shortened)
 * 3. SCP recommendation (deny backup:DeleteRecoveryPoint)
 * 4. RAM share to Restore Account only (not workload)
 */
export class DataBankerStack extends cdk.Stack {
  public readonly vaultArn: string;

  constructor(scope: Construct, id: string, props: DataBankerStackProps) {
    super(scope, id, props);

    // Logically Air-gapped Backup Vault
    const vault = new backup.BackupVault(this, 'AirGappedVault', {
      backupVaultName: 'fsxn-air-gapped-vault',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lockConfiguration: {
        minRetention: cdk.Duration.days(props.vaultLockRetentionDays),
        maxRetention: cdk.Duration.days(365),
      },
    });
    this.vaultArn = vault.backupVaultArn;

    // Vault access policy: deny delete from all principals except AWS Backup service
    vault.addToAccessPolicy(
      new iam.PolicyStatement({
        sid: 'DenyDeleteRecoveryPoint',
        effect: iam.Effect.DENY,
        principals: [new iam.AnyPrincipal()],
        actions: ['backup:DeleteRecoveryPoint'],
        resources: ['*'],
        conditions: {
          StringNotEquals: {
            'aws:PrincipalServiceName': 'backup.amazonaws.com',
          },
        },
      }),
    );

    // RAM Share to Restore Account (for cross-account restore)
    if (props.restoreAccountId) {
      new ram.CfnResourceShare(this, 'VaultShare', {
        name: 'fsxn-air-gapped-vault-share',
        allowExternalPrincipals: false,
        principals: [props.restoreAccountId],
        resourceArns: [vault.backupVaultArn],
      });
    }

    // Output: Vault ARN for cross-account reference
    new cdk.CfnOutput(this, 'VaultArnOutput', {
      value: vault.backupVaultArn,
      description: 'ARN of the Air-gapped Backup Vault (use in Workload Account parameter)',
      exportName: `${this.stackName}-VaultArn`,
    });

    // SCP Recommendation (documented, not deployed - requires Organizations management account)
    // {
    //   "Effect": "Deny",
    //   "Action": ["backup:DeleteBackupVault", "backup:DeleteRecoveryPoint"],
    //   "Resource": "*",
    //   "Condition": { "StringEquals": { "aws:ResourceTag/Environment": "DataBanker" } }
    // }
  }
}
