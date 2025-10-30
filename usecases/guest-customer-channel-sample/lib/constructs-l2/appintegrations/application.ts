import { Resource, IResource } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as appintegrations from 'aws-cdk-lib/aws-appintegrations';

export interface ApplicationProps {
  readonly applicationSourceConfig: appintegrations.CfnApplication.ApplicationSourceConfigProperty;
  readonly description: string;
  readonly name: string;
  readonly namespace: string;
  readonly permissions?: string[];
}

export interface IApplication extends IResource {
  readonly applicationArn: string;
}

export class Application extends Resource implements IApplication {
  private readonly application: appintegrations.CfnApplication;
  public readonly applicationArn: string;

  constructor(scope: Construct, id: string, props: ApplicationProps) {
    super(scope, id);

    this.application = new appintegrations.CfnApplication(this, 'Resource', {
      applicationSourceConfig: props.applicationSourceConfig,
      description: props.description,
      name: props.name,
      namespace: props.namespace,
      permissions: props.permissions,
    });

    this.applicationArn = this.application.attrApplicationArn;
  }
}
