import { Resource, IResource } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as customerprofiles from 'aws-cdk-lib/aws-customerprofiles';
import { IDomain } from './domain';

export interface ObjectTypeMapping {
  readonly key: string;
  readonly value: string;
}

export interface FlowDefinitionProps {
  readonly flowName: string;
  readonly kmsArn: string;
  readonly sourceFlowConfig: customerprofiles.CfnIntegration.SourceFlowConfigProperty;
  readonly tasks: customerprofiles.CfnIntegration.TaskProperty[];
  readonly triggerConfig: customerprofiles.CfnIntegration.TriggerConfigProperty;
  readonly description?: string;
}

export interface IntegrationProps {
  readonly domain: IDomain;
  readonly uri?: string;
  readonly objectTypeName?: string;
  readonly objectTypeNames?: ObjectTypeMapping[];
  readonly eventTriggerNames?: string[];
  readonly flowDefinition?: FlowDefinitionProps;
}

export interface IIntegration extends IResource {
  readonly domainName: string;
  readonly uri?: string;
}

export class Integration extends Resource implements IIntegration {
  public readonly domainName: string;
  public readonly uri?: string;

  constructor(scope: Construct, id: string, props: IntegrationProps) {
    super(scope, id);

    this.domainName = props.domain.domainName;
    this.uri = props.uri;

    const integration = new customerprofiles.CfnIntegration(this, 'Resource', {
      domainName: props.domain.domainName,
      uri: props.uri,
      objectTypeName: props.objectTypeName,
      objectTypeNames: props.objectTypeNames?.map((mapping) => ({
        key: mapping.key,
        value: mapping.value,
      })),
      eventTriggerNames: props.eventTriggerNames,
      flowDefinition: props.flowDefinition
        ? {
            flowName: props.flowDefinition.flowName,
            kmsArn: props.flowDefinition.kmsArn,
            sourceFlowConfig: props.flowDefinition.sourceFlowConfig,
            tasks: props.flowDefinition.tasks,
            triggerConfig: props.flowDefinition.triggerConfig,
            description: props.flowDefinition.description,
          }
        : undefined,
    });

    integration.node.addDependency(props.domain);
  }
}
