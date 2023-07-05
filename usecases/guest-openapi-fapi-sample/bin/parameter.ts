import * as cdk from 'aws-cdk-lib';

/*
 * BLEA-FSI OpenAPI Fapi Sample application parameters denifition
 */

// stack specific parameters
export interface StackParameter extends cdk.StackProps {
  envName: string;
  account?: string;
  dbUser: string;
  keycloakContainerVersionTag: string;
  keycloakContainerImageName: string;
  primaryRegion: {
    region: string;
    vpcCidr: string;
  };
  secondaryRegion?: {
    region: string;
    vpcCidr: string;
  };
}
// Project name prefix
export const PjPrefix = 'BLEAFSI-OpenApi-Fapi';

//// Development environment parameters ////
export const DevParameter: StackParameter = {
  envName: 'Development',
  dbUser: 'dbadmin',
  keycloakContainerVersionTag: '16.1.1',
  keycloakContainerImageName: 'fapidemo/keycloak',
  primaryRegion: {
    region: 'ap-northeast-1',
    vpcCidr: '10.110.0.0/16',
  },
};

//// Staging environment parameters ////
export const StageParameter: StackParameter = {
  envName: 'Staging',
  account: '111111111111',
  dbUser: 'dbadmin',
  keycloakContainerVersionTag: '16.1.1',
  keycloakContainerImageName: 'fapidemo/keycloak',
  primaryRegion: {
    region: 'ap-northeast-1',
    vpcCidr: '10.110.0.0/16',
  },
};

//// Production environment parameters ////
export const ProdParameter: StackParameter = {
  envName: 'Production',
  account: '222222222222',
  dbUser: 'dbadmin',
  keycloakContainerVersionTag: '16.1.1',
  keycloakContainerImageName: 'fapidemo/keycloak',
  primaryRegion: {
    region: 'ap-northeast-1',
    vpcCidr: '10.110.0.0/16',
  },
};
