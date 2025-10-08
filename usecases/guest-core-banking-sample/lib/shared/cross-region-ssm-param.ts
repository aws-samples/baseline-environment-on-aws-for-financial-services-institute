import * as cdk from 'aws-cdk-lib';
import { aws_ssm as ssm } from 'aws-cdk-lib';
import * as custom from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import { CrossRegionSsmParamName } from './constants';
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

  constructor(scope: Construct, id: string, props: CrossRegionSsmParamProps) {
    super(scope, id);
    this.baseRegion = props.baseRegion;
    this.ssmNamePrefix = CrossRegionSsmParamName.getBasePath(props.envName);
  }

  get(name: string): string {
    const parameterName = this.getParameterPath(name);

    const cr = new custom.AwsCustomResource(this, `GetParam-${name}`, {
      onUpdate: {
        service: 'SSM',
        action: 'getParameter',
        parameters: { Name: parameterName, WithDecryption: true },
        region: this.baseRegion,
        physicalResourceId: custom.PhysicalResourceId.of(`param-${parameterName}`),
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({ resources: custom.AwsCustomResourcePolicy.ANY_RESOURCE }),
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
    });

    return cr.getResponseField('Parameter.Value');
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
