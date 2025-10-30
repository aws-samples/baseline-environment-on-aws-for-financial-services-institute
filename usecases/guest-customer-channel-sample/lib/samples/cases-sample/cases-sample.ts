import { Construct } from 'constructs';
import * as connect_cases_l2 from '../../constructs-l2/connect-cases';
import * as connect_l2 from '../../constructs-l2/connect';

export interface CasesSampleProps {
  readonly connectInstance: connect_l2.IInstance;
}

export class CasesSample extends Construct {
  public readonly domain: connect_cases_l2.Domain;

  constructor(scope: Construct, id: string, props: CasesSampleProps) {
    super(scope, id);

    this.domain = new connect_cases_l2.Domain(this, 'Domain', {
      name: 'connect-cases-domain',
    });

    new connect_l2.IntegrationAssociation(this, 'IntegrationAssociation', {
      instance: props.connectInstance,
      integrationType: connect_l2.IntegrationType.CASES_DOMAIN,
      integrationArn: this.domain.domainArn,
    });
  }
}
