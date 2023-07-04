import { PrimaryRegionConfig, SecondaryRegionConfig, TertiaryRegionConfig } from 'lib/config';

/*
 * BLEA-FSI Customer Channel Sample Application parameters definition
 */

export interface AppParameter {
  readonly envName: string;
  readonly account?: string;
  readonly primaryRegion: PrimaryRegionConfig;
  readonly secondaryRegion?: SecondaryRegionConfig;
  readonly tertiaryRegion?: TertiaryRegionConfig;
}

// Unique project prefix
export const PjPrefix = 'BLEAFSI-CustomerChannel';

// Parameter for Dev - Anonymous account & region
export const DevParameter: AppParameter = {
  envName: 'Development',
  primaryRegion: {
    region: 'ap-northeast-1',
    connectInstance: {
      instanceAlias: 'my-connect-instance-yyyymmdd-primary', // EDIT HERE: instance alias must be unique
      inboundCallsEnabled: true,
      outboundCallsEnabled: true,
      contactFlows: [
        {
          type: 'CONTACT_FLOW',
          name: 'SampleInboundContactFlow',
        },
      ],
      identityManagementType: 'CONNECT_MANAGED',
    },
  },
  secondaryRegion: {
    region: 'ap-southeast-1',
    connectInstance: {
      instanceAlias: 'my-connect-instance-yyyymmdd-secondary', // EDIT HERE: instance alias must be unique
    },
  },
  tertiaryRegion: {
    region: 'ap-northeast-3',
  },
};

// Parameter for Staging
export const StageParameter: AppParameter = {
  envName: 'Staging',
  account: '111111111111',
  primaryRegion: {
    region: 'ap-northeast-1',
    connectInstance: {
      instanceAlias: 'my-connect-instance-yyyymmdd-primary', // EDIT HERE: instance alias must be unique
    },
  },
  secondaryRegion: {
    region: 'ap-southeast-1',
    connectInstance: {
      instanceAlias: 'my-connect-instance-yyyymmdd-secondary', // EDIT HERE: instance alias must be unique
    },
  },
  tertiaryRegion: {
    region: 'ap-northeast-3',
  },
};

// Parameter for Production
export const ProdParameter: AppParameter = {
  envName: 'Production',
  account: '222222222222',
  primaryRegion: {
    region: 'ap-northeast-1',
    connectInstance: {
      instanceAlias: 'my-connect-instance-yyyymmdd-primary', // EDIT HERE: instance alias must be unique
    },
  },
  secondaryRegion: {
    region: 'ap-southeast-1',
    connectInstance: {
      instanceAlias: 'my-connect-instance-yyyymmdd-secondary', // EDIT HERE: instance alias must be unique
    },
  },
  tertiaryRegion: {
    region: 'ap-northeast-3',
  },
};
