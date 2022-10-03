import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { custom_resources as cr } from 'aws-cdk-lib';
import { CrossRegionSsmParamName } from './shared/bleafsi-constants';
import { CrossRegionSsmParam } from './shared/bleafsi-cross-region-ssm-param-stack';

interface AcceptTgwPeeringStackProps extends cdk.StackProps {
  pjPrefix: string;
  envName: string;
}

export class AcceptTgwPeeringStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AcceptTgwPeeringStackProps) {
    super(scope, id, props);

    const { pjPrefix, envName } = props;

    const crossRegionSsmParam = new CrossRegionSsmParam(this, `${pjPrefix}-crossRegionSsmParam`, {
      baseRegion: cdk.Stack.of(this).region,
      envName,
    });
    const tgwPeeringAttachmentId = crossRegionSsmParam.get(CrossRegionSsmParamName.TGW_PEERING_ATTACHMENT_ID);

    // Accept Transit Gateway Peering Attachment via API
    const crStackId = `${pjPrefix}-AcceptTgwPeeringAttachment`;
    new cr.AwsCustomResource(this, crStackId, {
      onUpdate: {
        service: 'EC2',
        action: 'acceptTransitGatewayPeeringAttachment',
        parameters: {
          TransitGatewayAttachmentId: tgwPeeringAttachmentId,
          DryRun: false,
        },
        region: cdk.Stack.of(this).region,
        physicalResourceId: cr.PhysicalResourceId.of(crStackId),
      },
      onDelete: {
        service: 'EC2',
        action: 'deleteTransitGatewayPeeringAttachment',
        parameters: {
          TransitGatewayAttachmentId: tgwPeeringAttachmentId,
          DryRun: false,
        },
        region: cdk.Stack.of(this).region,
        physicalResourceId: cr.PhysicalResourceId.of(crStackId),
      },
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });
  }
}
