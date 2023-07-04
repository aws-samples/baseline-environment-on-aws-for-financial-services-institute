import * as cdk from 'aws-cdk-lib';
import { aws_ssm as ssm } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CrossRegionSsmParamName } from './constants';
import { RemoteParameters } from 'cdk-remote-stack';
import { NagSuppressions } from 'cdk-nag';
import { strict as assert } from 'assert';

/*
 * リージョン間でSSMパラメータストアを操作するためのクラス
 */

interface CrossRegionSsmParamProps {
  baseRegion: string;
  envName: string;
}

export class CrossRegionSsmParam extends Construct {
  private readonly baseRegion: string;
  private readonly ssmNamePrefix: string;
  private parameters: RemoteParameters;

  constructor(scope: Construct, id: string, props: CrossRegionSsmParamProps) {
    super(scope, id);

    this.baseRegion = props.baseRegion;
    this.ssmNamePrefix = CrossRegionSsmParamName.getBasePath(props.envName);
  }

  get(name: string): string {
    if (!this.parameters) {
      this.parameters = new RemoteParameters(this, 'Parameters', {
        path: this.ssmNamePrefix,
        region: this.baseRegion,
        alwaysUpdate: false, // Stop refreshing the resource for snapshot testing
      });
      NagSuppressions.addResourceSuppressions(
        this.parameters,
        [
          { id: 'AwsSolutions-L1', reason: 'Non-latest Lambda runtime is used inside RemoteParameters' },
          { id: 'AwsSolutions-IAM4', reason: 'AWSLambdaBasicExecutionRole is used inside RemoteParameters' },
          { id: 'AwsSolutions-IAM5', reason: 'Wildcard policy is used inside RemoteParameters' },
        ],
        true,
      );
    }
    return this.parameters.get(this.getParameterPath(name));
  }

  put(name: string, value: string): void {
    // Restrict the SSM parameters to be placed in the same region.
    assert.equal(this.baseRegion, cdk.Stack.of(this).region);

    new ssm.StringParameter(this, `SsmParam-${name}`, {
      parameterName: this.getParameterPath(name),
      stringValue: value,
    });
  }

  private getParameterPath(name: string) {
    return `${this.ssmNamePrefix}/${name}`;
  }
}
