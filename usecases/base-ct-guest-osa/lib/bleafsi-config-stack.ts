import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_config as config } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';

/*
 * この stack は CloudFormation stack を作成するために使用されます。
 * 詳しくは lib/bleafsi-config-stackset.ts を参照して下さい。
 */
interface ConfigStackProps extends cdk.StackProps {
  cloudTrailBucketName: string; //Log Archiveアカウントに作成したS3バケット名（cdk.jsonで設定）
}

export class ConfigStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ConfigStackProps) {
    super(scope, id, props);

    const role = new iam.Role(this, 'ConfigRole', {
      assumedBy: new iam.ServicePrincipal('config.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWS_ConfigRole')],
    });

    new config.CfnConfigurationRecorder(this, 'ConfigRecorder', {
      roleArn: role.roleArn,
      recordingGroup: {
        allSupported: true,
        includeGlobalResourceTypes: true,
      },
    });

    //create config
    new config.CfnDeliveryChannel(this, 'ConfigDeliveryChannel', {
      s3BucketName: props.cloudTrailBucketName,
    });
  }
}
