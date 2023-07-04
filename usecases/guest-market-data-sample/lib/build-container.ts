import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_ecr as ecr } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';
import { aws_codebuild as codebuild } from 'aws-cdk-lib';
import { aws_s3_assets as s3assets } from 'aws-cdk-lib';
import { aws_kms as kms } from 'aws-cdk-lib';
import { custom_resources as cr } from 'aws-cdk-lib';
import * as path from 'path';

/*
 * Container Image builder codebuild stack
 */
export interface ContainerImageBuilderProps extends cdk.StackProps {
  ecrRepository: ecr.Repository;
  appName: string;
  appKey: kms.IKey;
  region?: string;
  account?: string;
}

/* Generates CodeBuild project to build container image and push to ECR */
export class ImageBuilder extends Construct {
  public readonly imageTag: string;
  constructor(scope: Construct, id: string, props: ContainerImageBuilderProps) {
    super(scope, id);
    // Receive as Param
    this.imageTag = props.appName;

    // Upload Dockerfile and buildspec.yml to s3
    const asset = new s3assets.Asset(this, 'app-asset', {
      path: path.join(__dirname, '../sample-ecs-app'),
    });

    // CodeBuild project
    const project = new codebuild.Project(this, `${props.appName}-project`, {
      source: codebuild.Source.s3({
        bucket: asset.bucket,
        path: asset.s3ObjectKey,
      }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_4_0,
        privileged: true,
        environmentVariables: {
          AWS_DEFAULT_REGION: {
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            value: `${props.region}`,
          },
          AWS_ACCOUNT_ID: {
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            value: `${props.account}`,
          },
          IMAGE_TAG: {
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            value: `${props.appName}`,
          },
          IMAGE_REPO_NAME: {
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            value: props.ecrRepository.repositoryName,
          },
        },
      },
      encryptionKey: props.appKey,
    });

    project.addToRolePolicy(
      new iam.PolicyStatement({
        resources: ['*'],
        actions: ['ecr:GetAuthorizationToken'],
      }),
    );
    project.addToRolePolicy(
      new iam.PolicyStatement({
        resources: [`arn:aws:ecr:${props.region}:${props.account}:repository/${props.ecrRepository.repositoryName}`],
        actions: [
          'ecr:BatchCheckLayerAvailability',
          'ecr:CompleteLayerUpload',
          'ecr:InitiateLayerUpload',
          'ecr:PutImage',
          'ecr:UploadLayerPart',
        ],
      }),
    );

    // CodeBuild:StartBuild
    const sdkcallForStartBuild = {
      service: 'CodeBuild',
      action: 'startBuild', // Must with a lowercase letter.

      parameters: {
        projectName: project.projectName,
      },
      physicalResourceId: cr.PhysicalResourceId.of(project.projectArn),
    };

    new cr.AwsCustomResource(this, 'startBuild', {
      policy: {
        statements: [
          new iam.PolicyStatement({
            resources: [project.projectArn],
            actions: ['codebuild:StartBuild'],
          }),
        ],
      },
      onCreate: sdkcallForStartBuild,
    });
  }
}
