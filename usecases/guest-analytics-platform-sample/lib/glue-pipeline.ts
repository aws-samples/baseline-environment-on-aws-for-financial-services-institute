import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as glue_alpha from '@aws-cdk/aws-glue-alpha';
import { aws_iam as iam } from 'aws-cdk-lib';
import { Bucket as bucket } from './constructs/bleafsi-s3-bucket';
import { aws_s3 as s3, RemovalPolicy } from 'aws-cdk-lib';
import { aws_s3_deployment as s3deploy } from 'aws-cdk-lib';
import { Bucket } from './constructs/bleafsi-s3-bucket';
import { KmsKey } from './constructs/bleafsi-kms-key';
import { PjPrefix, StackParameter } from '../bin/parameter';
import { GlueIAMRole } from './glue-iam-role';
import { GlueJob } from './glue-job';
import { EventBridgeSchedule } from './glue-job-schedule';
import { aws_stepfunctions as sfn } from 'aws-cdk-lib';
import { Parallel, StateMachine } from 'aws-cdk-lib/aws-stepfunctions';
import { GlueStartJobRun } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { aws_logs as logs } from 'aws-cdk-lib';
import { CloudWatchAlarm } from './cloudwatch-alarm';
import { IamRole } from './constructs/bleafsi-iam-role';

/*
 * Glue Pipeline stack
 */
export interface GluePipelineProps {
  glueConnections: glue_alpha.Connection[]; //ソースデータに接続するためのGlue Connection
  bucketForOriginData: bucket; //ソースデータを保存するS3バケット
  bucketForRawData: bucket; //生データを保存するS3バケット
  bucketForNormalizedData: bucket; //正規化データを保存するS3バケット
  bucketForAnalyticsData: bucket; //分析用データを保存するS3バケット
  glueDatabaseForOriginData: glue_alpha.Database;
  glueDatabaseForRawData: glue_alpha.Database;
  glueDatabaseForNormalizedData: glue_alpha.Database;
  glueDatabaseForAnalyticsData: glue_alpha.Database;
  kmsForGlueCatalog: KmsKey; //Glue Catalog 暗号化KMSキー
}

/*
 * Glue パイプライン用のジョブを作成
 */
export class GluePipeline extends Construct {
  constructor(scope: Construct, id: string, props: GluePipelineProps, envProps: StackParameter) {
    super(scope, id);

    //Glue Asset バケットを作成
    const bucketForGlueAssest = new Bucket(this, 'BucketForGlueAssest', {
      encryption: s3.BucketEncryption.KMS,
      removalPolicy: RemovalPolicy.DESTROY,
      bucketName: 'glue-job-asset-' + cdk.Stack.of(this).account,
    });

    // パイプラインで使用する Glue job スクリプトをアップロードする
    new s3deploy.BucketDeployment(this, 'ScriptUpload', {
      sources: [s3deploy.Source.asset('lib/resources/scripts/')],
      destinationBucket: bucketForGlueAssest.bucket,
      destinationKeyPrefix: 'scripts',
    });

    //Spark UI log 保存バケット
    const bucketForSparkUILog = new Bucket(this, 'BucketForSparkUILog', {
      bucketName: `sparkui-log-${cdk.Stack.of(this).account}`,
      encryption: s3.BucketEncryption.KMS,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    //GlueのSecuirtyConfigurationに必要なKMSキーポリシー追加
    const logsServiceUrl = 'logs.' + cdk.Stack.of(scope).region + '.amazonaws.com';
    props.kmsForGlueCatalog.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['kms:Encrypt*', 'kms:Decrypt*', 'kms:ReEncrypt*', 'kms:GenerateDataKey*', 'kms:Describe*'],
        principals: [new iam.ServicePrincipal(logsServiceUrl)],
        resources: ['*'],
      }),
    );

    //GlueのSecuirtyConfigurationを作成する
    const glueSecurityConfig = new glue_alpha.SecurityConfiguration(this, 'MySecurityConfiguration', {
      cloudWatchEncryption: {
        mode: glue_alpha.CloudWatchEncryptionMode.KMS,
        kmsKey: props.kmsForGlueCatalog.key,
      },
      jobBookmarksEncryption: {
        mode: glue_alpha.JobBookmarksEncryptionMode.CLIENT_SIDE_KMS,
        kmsKey: props.kmsForGlueCatalog.key,
      },
      s3Encryption: {
        mode: glue_alpha.S3EncryptionMode.KMS,
        kmsKey: props.kmsForGlueCatalog.key,
      },
    });

    //Originデータを処理するIAMロールを作成する
    const iamRoleForOriginData = new GlueIAMRole(this, 'IamRoleForOriginData', {
      bucketForSource: props.bucketForOriginData, //インプットデータを保存するS3バケット
      bucketForTarget: props.bucketForRawData, //アウトプットデータを保存するS3バケット
      bucketForGlueAssest: bucketForGlueAssest, //Glue用ファイルを保存するS3バケット
      glueSecurityConfig: glueSecurityConfig,
    });

    //Originデータを処理するGlueジョブを作成する
    const originToRawTasks: sfn.TaskStateBase[] = [];

    createGlueJob(this, 'OriginToRaw_Customer', iamRoleForOriginData.glueIamRole, {
      '--source_bucket_name': props.bucketForOriginData.bucket.bucketName,
      '--target_bucket_name': props.bucketForRawData.bucket.bucketName,
      '--source_glue_database': props.glueDatabaseForOriginData.databaseName,
      '--target_glue_database': props.glueDatabaseForRawData.databaseName,
    });
    originToRawTasks.push(
      new GlueStartJobRun(this, `sfntask_${'OriginToRaw_Customer'.toLowerCase()}`, {
        glueJobName: 'OriginToRaw_Customer',
        integrationPattern: sfn.IntegrationPattern.RUN_JOB,
      }).addRetry({ interval: cdk.Duration.seconds(30) }),
    );

    createGlueJob(this, 'OriginToRaw_InternetBankingUser', iamRoleForOriginData.glueIamRole, {
      '--source_bucket_name': props.bucketForOriginData.bucket.bucketName,
      '--target_bucket_name': props.bucketForRawData.bucket.bucketName,
      '--source_glue_database': props.glueDatabaseForOriginData.databaseName,
      '--target_glue_database': props.glueDatabaseForRawData.databaseName,
    });
    originToRawTasks.push(
      new GlueStartJobRun(this, `sfntask_${'OriginToRaw_InternetBankingUser'.toLowerCase()}`, {
        glueJobName: 'OriginToRaw_InternetBankingUser',
        integrationPattern: sfn.IntegrationPattern.RUN_JOB,
      }).addRetry({ interval: cdk.Duration.seconds(30) }),
    );

    createGlueJob(this, 'OriginToRaw_CustomerAccount', iamRoleForOriginData.glueIamRole, {
      '--source_bucket_name': props.bucketForOriginData.bucket.bucketName,
      '--target_bucket_name': props.bucketForRawData.bucket.bucketName,
      '--source_glue_database': props.glueDatabaseForOriginData.databaseName,
      '--target_glue_database': props.glueDatabaseForRawData.databaseName,
    });
    originToRawTasks.push(
      new GlueStartJobRun(this, `sfntask_${'OriginToRaw_CustomerAccount'.toLowerCase()}`, {
        glueJobName: 'OriginToRaw_CustomerAccount',
        integrationPattern: sfn.IntegrationPattern.RUN_JOB,
      }).addRetry({ interval: cdk.Duration.seconds(30) }),
    );

    createGlueJob(
      this,
      'OriginToRaw_DepositWithdrawHistory',
      iamRoleForOriginData.glueIamRole,
      {
        '--source_bucket_name': props.bucketForOriginData.bucket.bucketName,
        '--target_bucket_name': props.bucketForRawData.bucket.bucketName,
        '--source_glue_database': props.glueDatabaseForOriginData.databaseName,
        '--target_glue_database': props.glueDatabaseForRawData.databaseName,
      },
      5,
    );
    originToRawTasks.push(
      new GlueStartJobRun(this, `sfntask_${'OriginToRaw_DepositWithdrawHistory'.toLowerCase()}`, {
        glueJobName: 'OriginToRaw_DepositWithdrawHistory',
        integrationPattern: sfn.IntegrationPattern.RUN_JOB,
      }).addRetry({ interval: cdk.Duration.seconds(30) }),
    );

    //Rawデータを処理するIAMロールを作成する
    const iamRoleForRawData = new GlueIAMRole(this, 'IamRoleForRawData', {
      bucketForSource: props.bucketForRawData,
      bucketForTarget: props.bucketForNormalizedData,
      bucketForGlueAssest: bucketForGlueAssest,
      glueSecurityConfig: glueSecurityConfig,
    });

    //Rawデータを処理するGlueジョブを作成する
    const rawToNormalizeTasks: sfn.TaskStateBase[] = [];
    createGlueJob(this, 'RawToNormalized_Customer', iamRoleForRawData.glueIamRole, {
      '--target_bucket_name': props.bucketForNormalizedData.bucket.bucketName,
      '--source_glue_database': props.glueDatabaseForRawData.databaseName,
      '--target_glue_database': props.glueDatabaseForNormalizedData.databaseName,
    });
    rawToNormalizeTasks.push(
      new GlueStartJobRun(this, `sfntask_${'RawToNormalized_Customer'.toLowerCase()}`, {
        glueJobName: 'RawToNormalized_Customer',
        integrationPattern: sfn.IntegrationPattern.RUN_JOB,
      }).addRetry({ interval: cdk.Duration.seconds(30) }),
    );

    createGlueJob(this, 'RawToNormalized_InternetBankingUser', iamRoleForRawData.glueIamRole, {
      '--target_bucket_name': props.bucketForNormalizedData.bucket.bucketName,
      '--source_glue_database': props.glueDatabaseForRawData.databaseName,
      '--target_glue_database': props.glueDatabaseForNormalizedData.databaseName,
    });
    rawToNormalizeTasks.push(
      new GlueStartJobRun(this, `sfntask_${'RawToNormalized_InternetBankingUser'.toLowerCase()}`, {
        glueJobName: 'RawToNormalized_InternetBankingUser',
        integrationPattern: sfn.IntegrationPattern.RUN_JOB,
      }).addRetry({ interval: cdk.Duration.seconds(30) }),
    );

    createGlueJob(this, 'RawToNormalized_CustomerAccount', iamRoleForRawData.glueIamRole, {
      '--target_bucket_name': props.bucketForNormalizedData.bucket.bucketName,
      '--source_glue_database': props.glueDatabaseForRawData.databaseName,
      '--target_glue_database': props.glueDatabaseForNormalizedData.databaseName,
    });
    rawToNormalizeTasks.push(
      new GlueStartJobRun(this, `sfntask_${'RawToNormalized_CustomerAccount'.toLowerCase()}`, {
        glueJobName: 'RawToNormalized_CustomerAccount',
        integrationPattern: sfn.IntegrationPattern.RUN_JOB,
      }).addRetry({ interval: cdk.Duration.seconds(30) }),
    );

    createGlueJob(
      this,
      'RawToNormalized_DepositWithdrawHistory',
      iamRoleForRawData.glueIamRole,
      {
        '--target_bucket_name': props.bucketForNormalizedData.bucket.bucketName,
        '--source_glue_database': props.glueDatabaseForRawData.databaseName,
        '--target_glue_database': props.glueDatabaseForNormalizedData.databaseName,
      },
      5,
    );
    rawToNormalizeTasks.push(
      new GlueStartJobRun(this, `sfntask_${'RawToNormalized_DepositWithdrawHistory'.toLowerCase()}`, {
        glueJobName: 'RawToNormalized_DepositWithdrawHistory',
        arguments: sfn.TaskInput.fromObject({
          '--import_date.$': '$.import_date',
        }),
        integrationPattern: sfn.IntegrationPattern.RUN_JOB,
      }).addRetry({ interval: cdk.Duration.seconds(30) }),
    );

    //Normalizedデータを処理するIAMロールを作成する
    const iamRoleForNormalizedData = new GlueIAMRole(this, 'IamRoleForNormalizedData', {
      bucketForSource: props.bucketForNormalizedData,
      bucketForTarget: props.bucketForAnalyticsData,
      bucketForGlueAssest: bucketForGlueAssest,
      glueSecurityConfig: glueSecurityConfig,
    });

    //Normalizedデータを処理するGlueジョブを作成する
    const normalizeToAnalysisTasks: sfn.TaskStateBase[] = [];
    //顧客口座情報の集計ジョブ
    createGlueJob(this, 'NormalizedToAnalytics_InternetBankingPeriod', iamRoleForNormalizedData.glueIamRole, {
      '--target_bucket_name': props.bucketForAnalyticsData.bucket.bucketName,
      '--source_glue_database': props.glueDatabaseForNormalizedData.databaseName,
      '--target_glue_database': props.glueDatabaseForAnalyticsData.databaseName,
    });
    normalizeToAnalysisTasks.push(
      new GlueStartJobRun(this, `sfntask_${'NormalizedToAnalytics_InternetBankingPeriod'.toLowerCase()}`, {
        glueJobName: 'NormalizedToAnalytics_InternetBankingPeriod',
        integrationPattern: sfn.IntegrationPattern.RUN_JOB,
      }).addRetry({ interval: cdk.Duration.seconds(30) }),
    );
    // インバン日数計算ジョブ
    createGlueJob(
      this,
      'NormalizedToAnalytics_CustomerAccountDeposits',
      iamRoleForNormalizedData.glueIamRole,
      {
        '--target_bucket_name': props.bucketForAnalyticsData.bucket.bucketName,
        '--source_glue_database': props.glueDatabaseForNormalizedData.databaseName,
        '--target_glue_database': props.glueDatabaseForAnalyticsData.databaseName,
      },
      5,
    );
    normalizeToAnalysisTasks.push(
      new GlueStartJobRun(this, `sfntask_${'NormalizedToAnalytics_CustomerAccountDeposits'.toLowerCase()}`, {
        glueJobName: 'NormalizedToAnalytics_CustomerAccountDeposits',
        integrationPattern: sfn.IntegrationPattern.RUN_JOB,
      }).addRetry({ interval: cdk.Duration.seconds(30) }),
    );

    //StepFunctions StateMachine
    const logGroup = new logs.LogGroup(this, 'BleaForFSI_SimpleDatalake_GlueJobs_LogGroup');
    const originToRawParallel = new Parallel(this, 'OriginToRaw', {
      resultPath: sfn.JsonPath.DISCARD,
    })
      .branch(...originToRawTasks)
      .next(new Parallel(this, 'RawToNormalize').branch(...rawToNormalizeTasks))
      .next(new Parallel(this, 'NormalizeToAnalysis').branch(...normalizeToAnalysisTasks));
    const passFlow = new sfn.Pass(this, 'Parameter Supplement', {
      parameters: { ['import_date']: 'previous date' },
    }).next(originToRawParallel);
    const choiceFlow = new sfn.Choice(this, 'Parameter Check')
      .when(sfn.Condition.isPresent('$.import_date'), originToRawParallel)
      .otherwise(passFlow);
    //Glue Jobを実行管理する StepFunctions ステートマシン
    const jobPipelineSfn = new StateMachine(this, 'gluejobpipeline', {
      stateMachineName: `${PjPrefix.toLowerCase()}-glue-job-pipeline`,
      stateMachineType: sfn.StateMachineType.STANDARD,
      definition: choiceFlow,
      logs: {
        destination: logGroup,
        level: sfn.LogLevel.ALL,
      },
    });

    //Step Functionの実行を監視するCloudWatchアラームを追加
    new CloudWatchAlarm(this, 'cloudwatch alarm', {
      notifyEmail: envProps.simpleDataLake.notifyEmail,
      logGroup: logGroup,
    });

    //StepFunctions定期実行用のEventBridgeスケジュール
    new EventBridgeSchedule(this, 'StepFunction Schedule Run', {
      schedule: { hour: '15', minute: '0' },
      stateMachine: jobPipelineSfn,
      name: 'bleafsi-simple-datalake-jobs-run',
      description: 'BLEA for FSI simple datalake GludJobsを定期実行',
    });

    function createGlueJob(
      scope: Construct,
      glueJobName: string,
      iamRole: IamRole,
      jobParams: { [key: string]: string },
      workerCount = 2,
      maxConcurrentRuns = 1,
      maxRetries = 0,
      workerType: glue_alpha.WorkerType = glue_alpha.WorkerType.G_1X,
    ): void {
      new GlueJob(scope, glueJobName, {
        bucketForGlueAssest: bucketForGlueAssest,
        glueConnections: props.glueConnections,
        jobName: glueJobName,
        glueSecurityConfig: glueSecurityConfig,
        bucketForSparkUILog: bucketForSparkUILog,
        glueJobIAMRole: iamRole,
        maxConcurrentRuns: maxConcurrentRuns,
        maxRetries: maxRetries,
        workerCount: workerCount,
        workerType: workerType,
        jobParams: jobParams,
      });
    }
  }
}
