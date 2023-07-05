import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { S3Stack } from './s3-stack';
import { VpcStack } from './vpc-stack';
import { KmsKeyStack } from './kms-key-stack';
import { IamRoleStack } from './iam-role-stack';
import { EcrStack } from './ecr-stack';
import { WafStack } from './waf-stack';

/*
 * このサブプロジェクトのlib配下に作成した L3 Construct をAWSアカウント上にデプロイするためのテスト用 Application
 */

const app = new cdk.App();

const PjPrefix = 'BLEAFSI-Shared-Constructs-Dev';

// スタック作成
const stackS3 = new S3Stack(app, `${PjPrefix}-S3`);

const stackVpc = new VpcStack(app, `${PjPrefix}-Vpc`);

const stackKmsKey = new KmsKeyStack(app, `${PjPrefix}-Kms`);

const iamRoleStack = new IamRoleStack(app, `${PjPrefix}-Iam`);

const ecrStack = new EcrStack(app, `${PjPrefix}-Ecr`);

const wafStack = new WafStack(app, `${PjPrefix}-Waf`);

// Tagging "Environment" tag to all resources in this app
const envTagName = 'Environment';
cdk.Tags.of(stackS3).add(envTagName, 'test');
cdk.Tags.of(stackVpc).add(envTagName, 'test');
cdk.Tags.of(stackKmsKey).add(envTagName, 'test');
cdk.Tags.of(iamRoleStack).add(envTagName, 'test');
cdk.Tags.of(ecrStack).add(envTagName, 'test');
cdk.Tags.of(wafStack).add(envTagName, 'test');
