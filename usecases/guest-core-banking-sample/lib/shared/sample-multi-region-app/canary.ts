import { Construct } from 'constructs';
import * as synthetics from 'aws-cdk-lib/aws-synthetics';
import { Duration } from 'aws-cdk-lib';
import { join } from 'path';
import { IVpc } from 'aws-cdk-lib/aws-ec2';

export interface CanaryProps {
  vpc: IVpc;
  /**
   * @example https://api.example.com
   */
  targetApiUrl: string;
}

export class Canary extends Construct {
  readonly canaryName: string;

  constructor(scope: Construct, id: string, props: CanaryProps) {
    super(scope, id);
    const { vpc } = props;

    const canary = new synthetics.Canary(this, 'Resource', {
      schedule: synthetics.Schedule.rate(Duration.minutes(1)),
      test: synthetics.Test.custom({
        code: synthetics.Code.fromAsset(join(__dirname, 'canary')),
        handler: 'index.handler',
      }),
      runtime: synthetics.Runtime.SYNTHETICS_NODEJS_PUPPETEER_7_0,
      environmentVariables: {
        BASE_URL: props.targetApiUrl,
      },
      vpc,
      vpcSubnets: vpc.selectSubnets({ subnets: vpc.privateSubnets.concat(vpc.isolatedSubnets) }),
    });

    this.canaryName = canary.canaryName;
  }
}
