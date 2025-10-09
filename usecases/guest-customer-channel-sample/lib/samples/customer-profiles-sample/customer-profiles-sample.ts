import { Construct } from 'constructs';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as customer_profiles_l2 from '../../constructs-l2/customer-profiles';
import * as connect_l2 from '../../constructs-l2/connect';

export interface CustomerProfilesSampleProps {
  readonly key: kms.IKey;
  readonly connectInstance: connect_l2.IInstance;
}

export class CustomerProfilesSample extends Construct {
  public readonly domain: customer_profiles_l2.Domain;
  public readonly integration: customer_profiles_l2.Integration;

  constructor(scope: Construct, id: string, props: CustomerProfilesSampleProps) {
    super(scope, id);

    this.domain = new customer_profiles_l2.Domain(this, 'Domain', {
      // Note: 'amazon-connect-'で始めることで、サービスロールに権限が追加されなくても最初からアクセスできる
      domainName: 'amazon-connect-customer-channel-domain',
      defaultExpirationDays: 366,
      defaultEncryptionKey: props.key,
      matching: {
        enabled: true,
      },
      ruleBasedMatching: {
        enabled: true,
      },
    });
    this.domain.node.addDependency(props.key);

    this.integration = new customer_profiles_l2.Integration(this, 'Integration', {
      domain: this.domain,
      uri: props.connectInstance.instanceArn,
      objectTypeName: 'CTR',
    });
    this.integration.node.addDependency(props.connectInstance);

    // TODO: マネジメントコンソールでは AssociateCustomerProfilesDomain という permission only のアクションを呼び出していて、
    //       サービスロールがドメインに対して profile:* でアクセスできるように権限を追加している。
    //       APIだけ実行する場合はこのアクションが呼ばれないため、影響調査が必要となっている。

    new customer_profiles_l2.ObjectType(this, 'ObjectType', {
      domain: this.domain,
      objectTypeName: 'CTR',
      description:
        'This template auto-associates with an existing profile, and a new profile will be created if an existing profile cannot be found. (CTR-NoInferred)"',
      encryptionKey: props.key,
      templateId: 'CTR-NoInferred',
    });
  }
}
