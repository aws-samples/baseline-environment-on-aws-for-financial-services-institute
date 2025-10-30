import { IdentityManagementType } from './constructs-l2/connect';

export interface UserConfig {
  readonly alias: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly password: string;
}

export interface SamlProviderConfig {
  readonly metadataDocumentPath: string;
  readonly name?: string;
}

export interface ConnectInstanceAttributesConfig {
  readonly inboundCalls?: boolean;
  readonly outboundCalls?: boolean;
  readonly autoResolveBestVoices?: boolean;
  readonly contactflowLogs?: boolean;
  readonly contactLens?: boolean;
  readonly earlyMedia?: boolean;
  readonly useCustomTtsVoices?: boolean;
}

export interface ConnectInstanceConfig {
  readonly instanceAlias: string;
  readonly identityManagementType?: IdentityManagementType;
  readonly samlProvider?: SamlProviderConfig;
  readonly directoryId?: string;
  readonly adminUsers?: UserConfig[];
  //readonly agentUsers?: UserConfig[]; // TODO
  readonly attributes?: ConnectInstanceAttributesConfig;
}

export interface QconnectConfig {
  readonly enabled: boolean;
}

export interface QconnectConfig {
  readonly enabled: boolean;
}

export interface CustomerProfilesConfig {
  readonly enabled: boolean;
}

export interface CasesConfig {
  readonly enabled: boolean;
}

export interface PrimaryRegionConfig {
  readonly region?: string;
  readonly connectInstance: ConnectInstanceConfig;
  readonly connectWidgetId?: string;
  readonly connectSnippetId?: string;
  readonly qconnectConfig?: QconnectConfig;
  readonly customerProfilesConfig?: CustomerProfilesConfig;
  readonly casesConfig?: CasesConfig;
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
