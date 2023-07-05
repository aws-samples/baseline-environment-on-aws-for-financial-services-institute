import * as cr_connect from './cr-connect';

export interface ContactFlowConfig {
  readonly name: string;
  readonly type: string;
}

export interface SamlProviderConfig {
  readonly metadataDocumentPath: string;
  readonly name?: string;
}

export interface ConnectInstanceConfig {
  readonly instanceAlias: string;
  readonly inboundCallsEnabled?: boolean;
  readonly outboundCallsEnabled?: boolean;
  readonly identityManagementType?: cr_connect.IdentityManagementType;
  readonly contactFlows?: ContactFlowConfig[];
  readonly samlProvider?: SamlProviderConfig;
  readonly directoryId?: string;
}

export interface PrimaryRegionConfig {
  readonly region?: string;
  readonly connectInstance: ConnectInstanceConfig;
}
export interface SecondaryRegionConfig {
  readonly region?: string;
  readonly connectInstance: ConnectInstanceConfig;
}
export interface TertiaryRegionConfig {
  readonly region?: string;
}

export interface AppEnvConfig {
  readonly envName: string;
  readonly description?: string;
  readonly account?: string;
  readonly primaryRegion: PrimaryRegionConfig;
  readonly secondaryRegion?: SecondaryRegionConfig;
  readonly tertiaryRegion?: TertiaryRegionConfig;
}
