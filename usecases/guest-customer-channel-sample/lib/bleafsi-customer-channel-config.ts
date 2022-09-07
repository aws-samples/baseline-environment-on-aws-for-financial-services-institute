import * as cr_connect from './bleafsi-cr-connect';
import {
  assertObject,
  assertString,
  assertBoolean,
  assertArray,
  assertProperty,
  assertPropertyIfExists,
} from './bleafsi-type-assertions';

export interface ContactFlowConfig {
  readonly name: string;
  readonly type: string;
}
export function assertContactFlowConfig(path: string, x: unknown): ContactFlowConfig {
  const obj = assertObject(path, x);
  assertProperty(path, obj, 'name', assertString);
  assertProperty(path, obj, 'type', assertString);
  return obj as ContactFlowConfig;
}

export interface SamlProviderConfig {
  readonly metadataDocumentPath: string;
  readonly name?: string;
}
export function assertSamlProviderConfig(path: string, x: unknown): SamlProviderConfig {
  const obj = assertObject(path, x);
  assertProperty(path, obj, 'metadataDocumentPath', assertString);
  assertPropertyIfExists(path, obj, 'name', assertString);
  return obj as SamlProviderConfig;
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
export function assertConnectInstanceConfig(path: string, x: unknown): ConnectInstanceConfig {
  const obj = assertObject(path, x);
  assertProperty(path, obj, 'instanceAlias', assertString);
  assertPropertyIfExists(path, obj, 'inboundCallsEnabled', assertBoolean);
  assertPropertyIfExists(path, obj, 'outboundCallsEnabled', assertBoolean);
  assertPropertyIfExists(path, obj, 'identityManagementType', assertString); // TODO
  assertPropertyIfExists(path, obj, 'contactFlows', assertArray(assertContactFlowConfig));
  assertPropertyIfExists(path, obj, 'samlProvider', assertSamlProviderConfig);
  assertPropertyIfExists(path, obj, 'directoryId', assertString);
  return obj as ConnectInstanceConfig;
}

export interface PrimaryRegionConfig {
  readonly region?: string;
  readonly connectInstance: ConnectInstanceConfig;
}
export function assertPrimaryRegionConfig(path: string, x: unknown): PrimaryRegionConfig {
  const obj = assertObject(path, x);
  assertPropertyIfExists(path, obj, 'region', assertString);
  assertProperty(path, obj, 'connectInstance', assertConnectInstanceConfig);
  return obj as PrimaryRegionConfig;
}

export interface SecondaryRegionConfig {
  readonly region?: string;
  readonly connectInstance: ConnectInstanceConfig;
}
export function assertSecondaryRegionConfig(path: string, x: unknown): SecondaryRegionConfig {
  const obj = assertObject(path, x);
  assertPropertyIfExists(path, obj, 'region', assertString);
  assertProperty(path, obj, 'connectInstance', assertConnectInstanceConfig);
  return obj as SecondaryRegionConfig;
}

export interface TertiaryRegionConfig {
  readonly region?: string;
}
export function assertTertiaryRegionConfig(path: string, x: unknown): TertiaryRegionConfig {
  const obj = assertObject(path, x);
  assertPropertyIfExists(path, obj, 'region', assertString);
  return obj as TertiaryRegionConfig;
}

export interface AppEnvConfig {
  readonly envName: string;
  readonly description?: string;
  readonly account?: string;
  readonly primaryRegion: PrimaryRegionConfig;
  readonly secondaryRegion?: SecondaryRegionConfig;
  readonly tertiaryRegion?: TertiaryRegionConfig;
}
export function assertAppEnvConfig(path: string, x: unknown): AppEnvConfig {
  const obj = assertObject(path, x);
  assertProperty(path, obj, 'envName', assertString);
  assertPropertyIfExists(path, obj, 'description', assertString);
  assertPropertyIfExists(path, obj, 'account', assertString);
  assertProperty(path, obj, 'primaryRegion', assertPrimaryRegionConfig);
  assertPropertyIfExists(path, obj, 'secondaryRegion', assertSecondaryRegionConfig);
  assertPropertyIfExists(path, obj, 'tertiaryRegion', assertTertiaryRegionConfig);
  return obj as AppEnvConfig;
}
