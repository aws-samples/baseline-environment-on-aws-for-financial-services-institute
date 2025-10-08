import { Resource, IResource } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { Stack } from 'aws-cdk-lib';
import * as connect from 'aws-cdk-lib/aws-connect';
import * as iam from 'aws-cdk-lib/aws-iam';

export enum IdentityManagementType {
  SAML = 'SAML',
  CONNECT_MANAGED = 'CONNECT_MANAGED',
  EXISTING_DIRECTORY = 'EXISTING_DIRECTORY',
}

export interface InstanceProps {
  readonly attributes: connect.CfnInstance.AttributesProperty;
  readonly identityManagementType: IdentityManagementType;
  readonly instanceAlias?: string;
  readonly directoryId?: string;
}

export interface IInstance extends IResource {
  readonly instanceId: string;
  readonly instanceArn: string;
  readonly serviceRole: iam.IRole;
}

export class Instance extends Resource implements IInstance {
  private readonly instance: connect.CfnInstance;
  public readonly instanceId: string;
  public readonly instanceArn: string;
  public readonly serviceRole: iam.IRole;
  public readonly instanceAlias?: string;
  public readonly instanceDomain?: string;

  constructor(scope: Construct, id: string, props: InstanceProps) {
    super(scope, id);

    this.instance = new connect.CfnInstance(this, 'Resource', {
      attributes: props.attributes,
      identityManagementType: props.identityManagementType,
      instanceAlias: props.instanceAlias,
      directoryId: props.directoryId,
    });

    this.instanceId = this.instance.attrId;
    this.instanceArn = this.instance.attrArn;
    this.serviceRole = iam.Role.fromRoleArn(this, 'ServiceRole', this.instance.attrServiceRole);

    this.instanceAlias = props.instanceAlias;
    if (this.instanceAlias) {
      this.instanceDomain = `${this.instanceAlias}.my.connect.aws`;
    }
  }
}

export function getInstanceArnFromInstanceId(stack: Stack, instanceId: string): string {
  return `arn:aws:connect:${stack.region}:${stack.account}:instance/${instanceId}`;
}
