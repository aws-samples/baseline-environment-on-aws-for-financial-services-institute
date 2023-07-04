import * as cdk from 'aws-cdk-lib';
import { Annotations, Match, Template } from 'aws-cdk-lib/assertions';
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag';
import { OpenApiFapiStack } from '../lib/primary/bleafsi-guest-openapi-fapi-stack';
import { PjPrefix, DevParameter, StageParameter, ProdParameter } from '../bin/parameter';

const app = new cdk.App();

let openApiFapiPrimaryStack: OpenApiFapiStack;

describe(`${PjPrefix} snapshot check`, () => {
  test('OpenAPI FAPI sample Stacks', () => {
    openApiFapiPrimaryStack = new OpenApiFapiStack(app, `${PjPrefix}-openapi-fapi-primary`, DevParameter);

    // test with snapshot
    expect(Template.fromStack(openApiFapiPrimaryStack)).toMatchSnapshot();
  });
});

// cdk-nag test
describe(`${PjPrefix} cdk-nag AwsSolutions Pack: openApiPrimaryStack`, () => {
  beforeAll(() => {
    //Suppress
    NagSuppressions.addStackSuppressions(
      openApiFapiPrimaryStack,
      [
        {
          id: 'AwsSolutions-S1',
          reason: 'OK. Not to use an additional S3 bucket for S3 Access Logs. because simplification to this sample.',
        },
        {
          id: 'AwsSolutions-S1',
          reason: 'OK. Not to use an additional S3 bucket for S3 Access Logs. because simplification to this sample.',
        },
        { id: 'AwsSolutions-RDS6', reason: 'OK. Not to use IAM Database Authentication, because performance aspects.' },
        {
          id: 'AwsSolutions-RDS11',
          reason: 'CAN NOT Avoid. Aurora serverless v1 cannot change the default port 3306.',
        },
        {
          id: 'AwsSolutions-SMG4',
          reason: "OK. does not need secrets rotations because It's needs additional Lambda functions.",
        },
        { id: 'AwsSolutions-IAM4', reason: 'OK to use AWS automated generation policies.' },
        { id: 'AwsSolutions-IAM5', reason: 'OK to use AWS automated generation policies.' },
        { id: 'AwsSolutions-ECS2', reason: 'Not secrets value, just a environment values.' },
        { id: 'AwsSolutions-EC23', reason: 'OK. Security group is open to internet for its responsibility' },
        { id: 'AwsSolutions-ELB2', reason: 'OK. NLB does not write any access log under TCP listner configuration.' },
        { id: 'CdkNagValidationFailure', reason: 'suppress warnings.' },
      ],
      true,
    );
    cdk.Aspects.of(openApiFapiPrimaryStack).add(new AwsSolutionsChecks());
  });

  test('No unsurpressed Errors', () => {
    const errors = Annotations.fromStack(openApiFapiPrimaryStack).findError(
      '*',
      Match.stringLikeRegexp('AwsSolutions-.*'),
    );
    try {
      expect(errors).toHaveLength(0);

      console.log('cdk-nag: no errors for stack ' + openApiFapiPrimaryStack.stackName);
    } catch (e) {
      const errorMessages = errors.map((e) => ({
        type: e.entry.type,
        data: e.entry.data,
        id: e.id,
      }));
      console.error(JSON.stringify(errorMessages, undefined, 2));
      throw e;
    }
  });
});
