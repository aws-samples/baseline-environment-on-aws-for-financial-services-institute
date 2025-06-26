import { Resource, IResource } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as customerprofiles from 'aws-cdk-lib/aws-customerprofiles';
import * as kms from 'aws-cdk-lib/aws-kms';
import { IDomain } from './domain';

export interface ObjectTypeFieldProps {
  readonly source?: string;
  readonly target?: string;
  readonly contentType?: string;
}

export interface FieldMapProps {
  readonly name: string;
  readonly objectTypeField: ObjectTypeFieldProps;
}

export interface ObjectTypeKeyProps {
  readonly fieldNames?: string[];
  readonly standardIdentifiers?: string[];
}

export interface KeyMapProps {
  readonly name: string;
  readonly objectTypeKeyList?: ObjectTypeKeyProps[];
}

export interface ObjectTypeProps {
  readonly domain: IDomain;
  readonly objectTypeName: string;
  readonly description: string;
  readonly allowProfileCreation?: boolean;
  readonly encryptionKey?: kms.IKey;
  readonly expirationDays?: number;
  readonly fields?: FieldMapProps[];
  readonly keys?: KeyMapProps[];
  readonly sourceLastUpdatedTimestampFormat?: string;
  readonly templateId?: string;
}

export type IObjectType = IResource;

export class ObjectType extends Resource implements IObjectType {
  constructor(scope: Construct, id: string, props: ObjectTypeProps) {
    super(scope, id);

    const objectType = new customerprofiles.CfnObjectType(this, 'Resource', {
      domainName: props.domain.domainName,
      objectTypeName: props.objectTypeName,
      description: props.description,
      allowProfileCreation: props.allowProfileCreation,
      encryptionKey: props.encryptionKey?.keyArn,
      expirationDays: props.expirationDays,
      fields: props.fields?.map((field) => ({
        name: field.name,
        objectTypeField: {
          source: field.objectTypeField.source,
          target: field.objectTypeField.target,
          contentType: field.objectTypeField.contentType,
        },
      })),
      keys: props.keys?.map((key) => ({
        name: key.name,
        objectTypeKeyList: key.objectTypeKeyList?.map((keyItem) => ({
          fieldNames: keyItem.fieldNames,
          standardIdentifiers: keyItem.standardIdentifiers,
        })),
      })),
      sourceLastUpdatedTimestampFormat: props.sourceLastUpdatedTimestampFormat,
      templateId: props.templateId,
    });

    objectType.node.addDependency(props.domain);
    if (props.encryptionKey) {
      objectType.node.addDependency(props.encryptionKey);
    }
  }
}
