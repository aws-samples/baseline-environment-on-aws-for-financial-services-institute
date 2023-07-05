import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { IamSample } from './iam-sample';
import { SecurityAutoRemediation } from './security-auto-remediation';
import { SecurityAlarm } from './security-alarm';
import { SessionManagerLog } from './session-manager-log';
import { CloudTrail } from './cloudtrail-trail';
import { StackParameter } from '../bin/parameter';
//import { CloudTrailDataEvent } from './cloudtrail-dataevent';

const OSAKA_REGION = 'ap-northeast-3';

/*
 * Control Tower ゲストアカウント用のガバナンスベース構築 Stack
 */
export class BaseCTStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: StackParameter) {
    super(scope, id, props);

    // 1 ゲストアカウントでのCloudTrail証跡の作成
    // Control Tower ランディングゾーン v3.0 からゲストアカウントに CloudWatch ロググループを作成しないように変更されました。
    // また以前の環境からランディングゾーンをv3.0にアップデートした時に CloudTrail の組織レベルのログ記録設定が無効化されていると ゲストアカウント上のロググループを削除します。
    // BLEA for FSI では引き続きゲストアカウント上でのアラーム通知機能を有効にしているため、ゲストアカウント上に CloudWatch ロググループが作成されていない場合は、
    // アラームを通知するために CloudWatch ロググループ をゲストアカウント上に作成します。

    // 下記の条件に当てはまる場合は、block1 のコードのコメントを外し、block2 のコードはコメントアウトして下さい。
    // v3.0より以前のバージョンで Control Tower がゲストアカウント上に作成した CloudWatch ロググループを使用して、新規にロググループを作成しません。
    // [条件]
    //  - Control Tower ランディングゾーンのバージョンを v3.0 にアップデートして、
    //    Control Tower ランディングゾーン設定の AWS CloudTrail 設定で、「組織レベルのログ記録」が 有効になっている

    // ----- block1 ----
    //const cloudTrailLogGroupName = 'aws-controltower/CloudTrailLogs'; //Created by ControlTower for each account
    // ----------------

    // 下記の条件のいずれかに当てはまる場合は、下記の block2 のコードを使用して下さい。
    // - Control Tower ランディングゾーンを v3.0以降から使用している（以前のバージョンからアップデートしていない）
    // - Control Tower ランディングゾーンを v3.0以前から使用している（以前のバージョンからアップデートしている）、
    //   ただし、ランディングゾーン設定の AWS CloudTrail 設定で、「組織レベルのログ記録」を無効化している

    // ----- block2 ----
    const cloudTrail = new CloudTrail(this, `CloudTrail`, props.env);
    const cloudTrailLogGroupName = cloudTrail.cloudTrailLogGroup.logGroupName;
    // -----------------

    //2 CloudWatchメトリクスフィルターによるアラーム、EventBridgeルールを使用したセキュリティアラートの定義
    new SecurityAlarm(this, `SecurityAlarm`, {
      notifyEmail: props.securityNotifyEmail,
      cloudTrailLogGroupName: cloudTrailLogGroupName,
    });

    //3 自動修復設定を持つ Config ルールを設定
    if (props.env?.region != OSAKA_REGION) {
      //2023/4/26 大阪リージョンでは SSM document AWSConfigRemediation-RemoveVPCDefaultSecurityGroupRules がないためデプロイしない
      new SecurityAutoRemediation(this, `SecurityAutoRemediation`);
    }

    //4 SSM セッションマネージャーの監査ログ取得用 S3バケット作成
    const smanagerLog = new SessionManagerLog(this, `SessionManagerLog`);

    //5 管理作業用にIAMポリシー/ロールとIAMグループのサンプルを作成
    new IamSample(this, `IamSample`);

    //6 (オプション) CloudTrail S3データイベントの有効化
    /*new CloudTrailDataEvent(this, `CloudTrail-DataEvent`, {
      cloudTrailBucketName: props.cloudTrailBucketName,
      targetBuckets: props.targetBuckets,
      controlTowerKMSKeyArn: props.controlTowerKMSKeyArn,
    });*/

    //CFn output
    new cdk.CfnOutput(this, 'SSM Session Manager Log Bucket', {
      value: smanagerLog.bucket.bucketName,
      description: 'Bucket for SSM Session Manager Log Bucket',
    });
  }
}
