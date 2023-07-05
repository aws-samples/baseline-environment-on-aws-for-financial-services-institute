import { IDatabaseCluster } from 'aws-cdk-lib/aws-rds';
import { ISecret } from 'aws-cdk-lib/aws-secretsmanager';

/**
 * デモアプリケーションから Aurora Global Databaseクラスタにアクセスするために利用
 */
export interface IAuroraGlobalCluster {
  readonly secret: ISecret;
  readonly cluster: IDatabaseCluster;
  readonly host: string;
}
