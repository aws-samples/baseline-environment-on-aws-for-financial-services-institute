import * as cdk from 'aws-cdk-lib';
import * as backup from 'aws-cdk-lib/aws-backup';
import { Construct } from 'constructs';
import { CyberResilienceBackupParameter } from '../../../bin/parameter';

/**
 * DataBunkerAccountStackのプロパティ
 */
export type DataBunkerAccountStackProps = cdk.StackProps;

/**
 * Data Bunkerアカウントのスタック
 */
export class DataBunkerAccountStack extends cdk.Stack {
  /**
   * 作成したLogically air-gapped vaultのARN
   */
  public readonly logicallyAirGappedVaultArn: string;

  constructor(scope: Construct, id: string, props: DataBunkerAccountStackProps) {
    super(scope, id, props);

    // Logically air-gapped vaultの作成
    const vault = new backup.CfnLogicallyAirGappedBackupVault(this, 'LogicallyAirGappedVault', {
      backupVaultName: CyberResilienceBackupParameter.dataBunkerAccount.vaultName,
      // 論理エアギャップボールトのロック設定
      maxRetentionDays: 35, // 最大保持期間（日数）
      minRetentionDays: 7, // 最小保持期間（日数）
    });

    // VaultのARNを設定
    this.logicallyAirGappedVaultArn = `arn:aws:backup:${this.region}:${this.account}:backup-vault:${vault.backupVaultName}`;

    // VaultのARNを出力
    new cdk.CfnOutput(this, 'LogicallyAirGappedVaultArn', {
      value: this.logicallyAirGappedVaultArn,
      description: 'ARN of the Logically air-gapped vault',
    });
  }
}
