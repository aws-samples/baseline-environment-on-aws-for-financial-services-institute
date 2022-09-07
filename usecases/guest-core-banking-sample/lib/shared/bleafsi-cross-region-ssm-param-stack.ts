import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { custom_resources as cr } from 'aws-cdk-lib';
import { CrossRegionSsmParamName } from './bleafsi-constants';

interface CrossRegionSsmParamProps extends cdk.NestedStackProps {
  baseRegion: string;
  envName: string;
}

export class CrossRegionSsmParam extends cdk.NestedStack {
  private readonly baseRegion: string;
  private readonly ssmNamePrefix: string;

  constructor(scope: Construct, id: string, props: CrossRegionSsmParamProps) {
    super(scope, id, props);

    this.baseRegion = props.baseRegion;
    this.ssmNamePrefix = CrossRegionSsmParamName.getBasePath(props.envName);
  }

  get(name: string): string {
    const crStackId = `SsmGetParam-${name}`;
    const awsCustom = new cr.AwsCustomResource(this, crStackId, {
      onUpdate: {
        service: 'SSM',
        action: 'getParameter',
        parameters: { Name: `${this.ssmNamePrefix}${name}` },
        region: this.baseRegion,
        physicalResourceId: cr.PhysicalResourceId.of(crStackId),
      },
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });
    return awsCustom.getResponseField('Parameter.Value');
  }

  put(name: string, value: string): void {
    const crStackId = `SsmPutParam-${name}`;
    new cr.AwsCustomResource(this, crStackId, {
      onUpdate: {
        service: 'SSM',
        action: 'putParameter',
        parameters: {
          Name: `${this.ssmNamePrefix}${name}`,
          Value: value,
          Type: 'String',
          Overwrite: true,
          DataType: 'text',
        },
        region: this.baseRegion,
        physicalResourceId: cr.PhysicalResourceId.of(crStackId),
      },
      onDelete: {
        service: 'SSM',
        action: 'deleteParameter',
        parameters: {
          Name: `${this.ssmNamePrefix}${name}`,
        },
      },
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });
  }
}
