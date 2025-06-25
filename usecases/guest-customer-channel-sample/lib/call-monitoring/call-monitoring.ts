import { Auth } from './constructs/auth';
import { Api } from './constructs/api';
import { Kinesis } from './constructs/kinesis';
import { Frontend } from './constructs/frontend';
import { Construct } from 'constructs';
import * as connect_l2 from '../connect-l2';
import * as appintegrations_l2 from '../appintegrations-l2';
import { UserConfig } from 'lib/config';

export interface CallMonitoringProps {
  readonly webAclId: string;
  readonly connectInstance: connect_l2.IInstance;
  readonly connectUrl: string;
  readonly users?: UserConfig[];
}

export class CallMonitoring extends Construct {
  constructor(scope: Construct, id: string, props: CallMonitoringProps) {
    super(scope, id);

    const auth = new Auth(this, 'Auth', {
      users: props.users,
    });

    const api = new Api(this, 'Api', {
      auth,
    });

    new Kinesis(this, 'Kinesis', {
      api,
      connectInstance: props.connectInstance,
    });

    const frontend = new Frontend(this, 'Frontend', {
      auth,
      api,
      webAclId: props.webAclId,
      connectUrl: props.connectUrl,
    });

    const application = new appintegrations_l2.Application(this, 'FrontendApp', {
      name: 'Call monitoring',
      namespace: 'CallMonitoringFrontendApp',
      description: 'Call monitoring application',
      applicationSourceConfig: {
        externalUrlConfig: {
          accessUrl: frontend.frontendUrl,
        },
      },
      permissions: [
        'User.Details.View',
        'User.Configuration.View',
        'User.Status.View',
        'Contact.Details.View',
        'Contact.CustomerDetails.View',
        'Contact.Attributes.View',
      ],
    });
    application.node.addDependency(frontend);

    new connect_l2.ApplicationIntegrationAssociation(this, 'FrontendAppIntegration', {
      instance: props.connectInstance,
      application,
    });
  }
}
