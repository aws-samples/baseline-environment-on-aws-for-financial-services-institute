import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as fs from 'fs';
import * as path from 'path';

/*
 * このCDKテンプレートは 'bleafsi-config-stack.ts' から生成されたCloudFormation Stackテンプレート（bleafsi-base-ct-config.yaml）を
 * 元にCloudFormation StackSetを作成し、ゲストアカウントにCloudFormation Stackをデプロイします。CloudFormation Stackテンプレートは、
 * 下記コマンドで生成して下さい。
 *
 * npx cdk synthesize --all --app "npx ts-node --prefer-ts-exts bin/bleafsi-base-generate-stack.ts" -c environment=dev --profile ct-guest > bleafsi-base-ct-config.yaml
 *
 * 直接CDKテンプレートを使ってデプロイを行わないのは、Control Tower配下の組織ではガードレールにより管理アカウント配下の
 * AWSControlTowerStackSetRole ロール以外から AWS Config をデプロイできないためです。
 *
 * このCDKテンプレートは、Control Towerの管理者アカウントで実行して下さい。ゲストアカウント上では実行できません。*/

interface ConfigStackSetProps extends cdk.StackProps {
  targetGuestAccountId: string; //guest account id to deploy
}

export class ConfigStackSet extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ConfigStackSetProps) {
    super(scope, id, props);

    const templateFilePath = path.resolve(__dirname, '../bleafsi-base-ct-config.yaml');
    const templateToString = fs.readFileSync(templateFilePath).toString();

    const regions = ['ap-northeast-3']; //Osaka region

    //create stackset
    new cdk.CfnStackSet(this, 'ConfigStackSet', {
      stackSetName: 'BLEAFSI-ConfigStackSet',
      permissionModel: 'SELF_MANAGED',
      capabilities: ['CAPABILITY_IAM'],
      administrationRoleArn: `arn:aws:iam::${cdk.Stack.of(this).account}:role/service-role/AWSControlTowerStackSetRole`,
      executionRoleName: 'AWSControlTowerExecution',
      stackInstancesGroup: [
        {
          regions: regions,
          deploymentTargets: {
            accounts: [props.targetGuestAccountId],
          },
        },
      ],
      templateBody: templateToString,
    });
  }
}
