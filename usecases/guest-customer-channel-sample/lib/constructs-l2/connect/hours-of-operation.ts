import { Resource, IResource } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as connect from 'aws-cdk-lib/aws-connect';
import { IInstance } from './instance';

export interface HoursOfOperationProps {
  readonly instance: IInstance;
  readonly name: string;
  readonly description?: string;
  readonly timeZone: string;
  readonly config: connect.CfnHoursOfOperation.HoursOfOperationConfigProperty[];
}

export interface IHoursOfOperation extends IResource {
  readonly hoursOfOperationArn: string;
  readonly hoursOfOperationId: string;
}

export class HoursOfOperation extends Resource implements IHoursOfOperation {
  public readonly hoursOfOperationArn: string;
  public readonly hoursOfOperationId: string;

  constructor(scope: Construct, id: string, props: HoursOfOperationProps) {
    super(scope, id);

    const hoursOfOperation = new connect.CfnHoursOfOperation(this, 'Resource', {
      instanceArn: props.instance.instanceArn,
      name: props.name,
      description: props.description,
      timeZone: props.timeZone,
      config: props.config,
    });

    this.hoursOfOperationId = hoursOfOperation.ref;
    this.hoursOfOperationArn = hoursOfOperation.attrHoursOfOperationArn;

    this.node.addDependency(props.instance);
  }
}
