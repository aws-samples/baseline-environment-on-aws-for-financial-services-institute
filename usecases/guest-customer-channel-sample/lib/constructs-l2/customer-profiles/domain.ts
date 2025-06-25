import { Resource, IResource } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as customerprofiles from 'aws-cdk-lib/aws-customerprofiles';
import * as kms from 'aws-cdk-lib/aws-kms';

export interface MatchingProps {
  readonly enabled: boolean;
  readonly autoMerging?: customerprofiles.CfnDomain.AutoMergingProperty;
  readonly exportingConfig?: customerprofiles.CfnDomain.ExportingConfigProperty;
  readonly jobSchedule?: customerprofiles.CfnDomain.JobScheduleProperty;
}

export interface RuleBasedMatchingProps {
  readonly enabled: boolean;
  readonly attributeTypesSelector?: customerprofiles.CfnDomain.AttributeTypesSelectorProperty;
  readonly conflictResolution?: customerprofiles.CfnDomain.ConflictResolutionProperty;
  readonly exportingConfig?: customerprofiles.CfnDomain.ExportingConfigProperty;
  readonly matchingRules?: customerprofiles.CfnDomain.MatchingRuleProperty[];
  readonly maxAllowedRuleLevelForMatching?: number;
  readonly maxAllowedRuleLevelForMerging?: number;
}

export interface DomainProps {
  readonly domainName: string;
  readonly defaultExpirationDays: number;
  readonly deadLetterQueueUrl?: string;
  readonly defaultEncryptionKey?: kms.IKey;
  readonly matching?: MatchingProps;
  readonly ruleBasedMatching?: RuleBasedMatchingProps;
}

export interface IDomain extends IResource {
  readonly domainName: string;
  readonly domainArn: string;
}

export class Domain extends Resource implements IDomain {
  public readonly domainName: string;
  public readonly domainArn: string;
  public readonly ruleBasedMatchingStatus?: string;

  constructor(scope: Construct, id: string, props: DomainProps) {
    super(scope, id);

    const domain = new customerprofiles.CfnDomain(this, 'Resource', {
      domainName: props.domainName,
      defaultExpirationDays: props.defaultExpirationDays,
      deadLetterQueueUrl: props.deadLetterQueueUrl,
      defaultEncryptionKey: props.defaultEncryptionKey?.keyArn,
      matching: props.matching
        ? {
            enabled: props.matching.enabled,
            autoMerging: props.matching.autoMerging,
            exportingConfig: props.matching.exportingConfig,
            jobSchedule: props.matching.jobSchedule,
          }
        : undefined,
      ruleBasedMatching: props.ruleBasedMatching
        ? {
            enabled: props.ruleBasedMatching.enabled,
            attributeTypesSelector: props.ruleBasedMatching.attributeTypesSelector,
            conflictResolution: props.ruleBasedMatching.conflictResolution,
            exportingConfig: props.ruleBasedMatching.exportingConfig,
            matchingRules: props.ruleBasedMatching.matchingRules,
            maxAllowedRuleLevelForMatching: props.ruleBasedMatching.maxAllowedRuleLevelForMatching,
            maxAllowedRuleLevelForMerging: props.ruleBasedMatching.maxAllowedRuleLevelForMerging,
          }
        : undefined,
    });

    if (props.defaultEncryptionKey) {
      domain.node.addDependency(props.defaultEncryptionKey);
    }

    this.domainName = props.domainName;
    this.domainArn = `arn:aws:profile:${this.stack.region}:${this.stack.account}:domains/${props.domainName}`;
  }
}
