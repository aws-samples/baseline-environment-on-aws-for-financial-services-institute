import { Resource, IResource } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as connect from 'aws-cdk-lib/aws-connect';
import { IInstance } from './instance';
import { ISecurityProfile } from './security-profile';
import { IRoutingProfile } from './routing-profile';

export enum PhoneType {
  SOFT_PHONE = 'SOFT_PHONE',
  DESK_PHONE = 'DESK_PHONE',
}

export interface UserPhoneConfiguration {
  readonly phoneType: PhoneType;
  readonly afterContactWorkTimeLimit?: number;
  readonly autoAccept?: boolean;
  readonly deskPhoneNumber?: string;
}

export interface UserProps {
  readonly instance: IInstance;
  readonly username: string;
  readonly password?: string;
  readonly identityInfo?: connect.CfnUser.UserIdentityInfoProperty;
  readonly phoneConfig: UserPhoneConfiguration;
  readonly securityProfiles: ISecurityProfile[];
  readonly routingProfile: IRoutingProfile;
}

export interface IUser extends IResource {
  readonly userArn: string;
  readonly userId: string;
}

export class User extends Resource implements IUser {
  public readonly userArn: string;
  public readonly userId: string;

  constructor(scope: Construct, id: string, props: UserProps) {
    super(scope, id);

    const user = new connect.CfnUser(this, 'Resource', {
      instanceArn: props.instance.instanceArn,
      username: props.username,
      password: props.password,
      identityInfo: props.identityInfo,
      phoneConfig: {
        phoneType: props.phoneConfig.phoneType,
        autoAccept: props.phoneConfig.autoAccept,
        afterContactWorkTimeLimit: props.phoneConfig.afterContactWorkTimeLimit,
        deskPhoneNumber: props.phoneConfig.deskPhoneNumber,
      },
      securityProfileArns: props.securityProfiles.map((sp) => sp.securityProfileArn),
      routingProfileArn: props.routingProfile.routingProfileArn,
    });

    this.userId = user.ref;
    this.userArn = user.attrUserArn;

    this.node.addDependency(props.instance);
    this.node.addDependency(...props.securityProfiles);
    this.node.addDependency(props.routingProfile);
  }
}
