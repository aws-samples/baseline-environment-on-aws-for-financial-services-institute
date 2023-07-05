/*
 * リージョン間で共有されるSSMパラメータ名の定義
 */

export class CrossRegionSsmParamName {
  static getBasePath(envName: string) {
    return `/bleafsi/${envName}`;
  }
  static readonly ECR_APP_IMAGE_TAG = 'EcrAppImageTag';
  static readonly ECR_APP_REPOSITORY_NAME = 'EcrAppRepositoryName';
  static readonly PRIVATE_HOSTED_ZONE_ID = 'PrivateHostedZoneId';
  static readonly TGW_PEERING_ATTACHMENT_ID = 'TgwPeeringAttachmentId';
  static readonly TGW_PRIMARY_ID = 'TgwPrimaryId';
}
