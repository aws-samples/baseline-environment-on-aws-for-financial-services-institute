export class CrossRegionSsmParamName {
  static getBasePath(envName: string) {
    return `/bleafsi/${envName}/`;
  }
  static readonly ECR_APP_IMAGE_TAG = 'EcrAppImageTag';
  static readonly ECR_APP_REPOSITORY_NAME = 'EcrAppRepositoryName';
  static readonly KMS_SECONDARY_APP_KEY_ARN = 'KmsSecondaryAppKeyArn';
  static readonly PRIVATE_HOSTED_ZONE_ID = 'PrivateHostedZoneId';
  static readonly TGW_PEERING_ATTACHMENT_ID = 'TgwPeeringAttachmentId';
  static readonly TGW_PRIMARY_ID = 'TgwPrimaryId';
}
