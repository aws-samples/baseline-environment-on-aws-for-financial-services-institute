import { Construct } from 'constructs';
import * as glue_alpha from '@aws-cdk/aws-glue-alpha';
import { Bucket as bucket } from './constructs/bleafsi-s3-bucket';
import { IamRole } from './constructs/bleafsi-iam-role';
import { aws_logs as logs } from 'aws-cdk-lib';

/*
 * Glue Job stack
 */
export interface GlueJobProps {
  bucketForGlueAssest: bucket; //Glue用ファイルを保存するS3バケット
  glueConnections: glue_alpha.Connection[]; //ソースデータに接続するためのGlue Connectionのリスト
  jobName: string;
  glueSecurityConfig: glue_alpha.SecurityConfiguration;
  bucketForSparkUILog: bucket;
  glueJobIAMRole: IamRole;
  sourceBucket?: bucket;
  maxConcurrentRuns: number;
  maxRetries: number;
  workerCount: number;
  workerType: glue_alpha.WorkerType;
  jobParams: { [key: string]: string };
}

/*
 * Glue パイプライン用のジョブを作成
 */
export class GlueJob extends Construct {
  readonly glueJob: glue_alpha.Job;

  constructor(scope: Construct, id: string, props: GlueJobProps) {
    super(scope, id);

    const defaultArguments = {
      '--TempDir': 's3://' + props.bucketForGlueAssest.bucket.bucketName + '/output/temp/',
      '--enable-spark-ui': 'true',
      '--spark-event-logs-path': 's3://' + props.bucketForGlueAssest.bucket.bucketName + '/output/logs/',
      '--enable-continuous-cloudwatch-log': 'true',
      '--enable-glue-datacatalog': 'true',
      '--enable-metrics': 'true',
      '--enable-job-insights': 'true',
      '--enable-auto-scaling': 'true',
      '--job-bookmark-option': 'job-bookmark-disable',
    };

    Object.entries(props.jobParams).forEach(([key, value]) => {
      Object.assign(defaultArguments, { [key]: value });
    });

    this.glueJob = new glue_alpha.Job(this, props.jobName, {
      executable: glue_alpha.JobExecutable.pythonEtl({
        glueVersion: glue_alpha.GlueVersion.V4_0,
        pythonVersion: glue_alpha.PythonVersion.THREE,
        //Glue JobのスクリプトはS3バケットから取得
        script: glue_alpha.Code.fromBucket(props.bucketForGlueAssest.bucket, 'scripts/' + props.jobName + '.py'),
      }),
      connections: props.glueConnections,
      continuousLogging: {
        enabled: true,
        logGroup: new logs.LogGroup(this, `GlueJob${props.jobName}`),
        quiet: true,
      },
      defaultArguments,
      jobName: props.jobName,
      maxConcurrentRuns: props.maxConcurrentRuns,
      maxRetries: props.maxRetries,
      role: props.glueJobIAMRole.iamRole,
      securityConfiguration: props.glueSecurityConfig,
      sparkUI: {
        enabled: true,
        bucket: props.bucketForSparkUILog.bucket,
      },
      description: 'PySpark job for' + props.jobName,
      workerCount: props.workerCount,
      workerType: props.workerType,
    });
  }
}
