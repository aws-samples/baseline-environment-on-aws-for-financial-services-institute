import { Resource, IResource, IResolvable } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as connect from 'aws-cdk-lib/aws-connect';
import { CfnTag } from 'aws-cdk-lib/core';
import { IInstance } from './instance';

export interface SecurityProfileProps {
  readonly instance: IInstance;
  readonly securityProfileName: string;
  readonly description?: string;
  readonly allowedAccessControlTags?: Array<CfnTag | IResolvable> | IResolvable;
  readonly permissions?: string[];
}

export interface ISecurityProfile extends IResource {
  readonly securityProfileArn: string;
  readonly securityProfileId: string;
}

export class SecurityProfile extends Resource implements ISecurityProfile {
  public readonly securityProfileArn: string;
  public readonly securityProfileId: string;

  constructor(scope: Construct, id: string, props: SecurityProfileProps) {
    super(scope, id);

    const securityProfile = new connect.CfnSecurityProfile(this, 'Resource', {
      instanceArn: props.instance.instanceArn,
      securityProfileName: props.securityProfileName,
      description: props.description,
      allowedAccessControlTags: props.allowedAccessControlTags,
      permissions: props.permissions,
    });

    this.securityProfileId = securityProfile.ref;
    this.securityProfileArn = securityProfile.attrSecurityProfileArn;

    this.node.addDependency(props.instance);
  }
}
