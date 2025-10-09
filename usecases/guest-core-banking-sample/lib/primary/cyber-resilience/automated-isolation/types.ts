import * as cdk from 'aws-cdk-lib';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';

export interface IsolationStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  notifyEmail: string;
  envName: string;
}

export interface GuardDutyEventBridgeProps {
  isolationLambdaArn: string;
}

export interface IsolationLambdaProps {
  vpc: ec2.Vpc;
  snsTopicArn: string;
  envName: string;
}

export interface SnsNotificationProps {
  notifyEmail: string;
  envName: string;
}
