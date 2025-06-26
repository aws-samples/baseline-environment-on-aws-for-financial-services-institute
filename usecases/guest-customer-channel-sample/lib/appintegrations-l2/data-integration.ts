import { Resource, IResource } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as appintegrations from 'aws-cdk-lib/aws-appintegrations';
import * as kms from 'aws-cdk-lib/aws-kms';

export interface DataIntegrationProps {
  readonly description?: string;
  readonly key: kms.IKey;
  readonly name: string;
  readonly sourceUri: string;
  readonly fileConfiguration?: appintegrations.CfnDataIntegration.FileConfigurationProperty;
  readonly objectConfiguration?: any;
  readonly scheduleConfig?: appintegrations.CfnDataIntegration.ScheduleConfigProperty;
}

export interface IDataIntegration extends IResource {
  readonly dataIntegrationArn: string;
  readonly dataIntegrationId: string;
}

export class DataIntegration extends Resource implements IDataIntegration {
  private readonly dataIntegration: appintegrations.CfnDataIntegration;
  public readonly dataIntegrationArn: string;
  public readonly dataIntegrationId: string;

  constructor(scope: Construct, id: string, props: DataIntegrationProps) {
    super(scope, id);

    this.dataIntegration = new appintegrations.CfnDataIntegration(this, 'Resource', {
      description: props.description,
      kmsKey: props.key.keyArn,
      name: props.name,
      sourceUri: props.sourceUri,
      fileConfiguration: props.fileConfiguration,
      objectConfiguration: props.objectConfiguration,
      scheduleConfig: props.scheduleConfig,
    });

    this.dataIntegrationArn = this.dataIntegration.attrDataIntegrationArn;
    this.dataIntegrationId = this.dataIntegration.attrId;
  }
}
