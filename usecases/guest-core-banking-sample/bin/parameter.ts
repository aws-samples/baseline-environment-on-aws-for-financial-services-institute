import * as cdk from 'aws-cdk-lib';

/*
 * BLEA-FSI Core Banking Sample application parameters denifition
 */

///////////////////////////////////////////////

//specific parameter definition
export interface StackParameter extends cdk.StackProps {
  envName: string;
  account?: string;
  notifyEmail: string;
  dbUser: string;
  hostedZoneName: string;
  primary: RegionEnv;
  secondary: RegionEnv;
}

export interface RegionEnv {
  //デプロイするリージョン
  region: string;
  //リージョン全体に適用するCIDRブロック（TGWルーティングで利用）
  regionCidr: string;
  //VPCに適用するCIDR
  vpcCidr: string;
  //Transit GatewayのASN
  tgwAsn: number;
}

// Unique project prefix
export const PjPrefix = 'BLEAFSI-CoreBanking';

///// テスト用サンプルアプリケーション の設定 //////

//シンプルなECSコンテナアプリケーションの設定
export const SampleEcsAppParameter = {
  //デプロイする場合は true に指定
  deploy: false,
  //動作確認用 NLB を作成するかどうか
  createTestResource: true,
};

//マルチリージョン マイクロサービス・アプリケーションの設定
export const SampleMultiRegionAppParameter = {
  //デプロイする場合は true に指定
  deploy: false,
  //実行確認用のクライアントを配置するVPCのCIDR
  appClientVpcCidr: '10.100.16.0/24',
};

///// 勘定系ワークロードのデプロイ設定 //////

// Parameter for Dev - Anonymous account & region
export const DevParameter: StackParameter = {
  envName: 'Development',
  account: process.env.CDK_DEFAULT_ACCOUNT,
  notifyEmail: 'notify-monitoring@example.com',
  dbUser: 'dbadmin',
  hostedZoneName: 'example.com',
  primary: {
    region: 'ap-northeast-1',
    regionCidr: '10.100.0.0/16',
    vpcCidr: '10.100.0.0/20',
    tgwAsn: 64512,
  },
  secondary: {
    region: 'ap-northeast-3',
    regionCidr: '10.101.0.0/16',
    vpcCidr: '10.101.0.0/20',
    tgwAsn: 64513,
  },
};

// Parameter for Staging
export const StageParameter: StackParameter = {
  envName: 'Staging',
  account: '111111111111',
  notifyEmail: 'notify-monitoring@example.com',
  dbUser: 'dbadmin',
  hostedZoneName: 'example.com',
  primary: {
    region: 'ap-northeast-1',
    regionCidr: '10.100.0.0/16',
    vpcCidr: '10.100.0.0/20',
    tgwAsn: 64512,
  },
  secondary: {
    region: 'ap-northeast-3',
    regionCidr: '10.101.0.0/16',
    vpcCidr: '10.101.0.0/20',
    tgwAsn: 64513,
  },
};

// Parameter for Production
export const ProdParameter: StackParameter = {
  envName: 'Production',
  account: '222222222222',
  notifyEmail: 'notify-monitoring@example.com',
  dbUser: 'dbadmin',
  hostedZoneName: 'example.com',
  primary: {
    region: 'ap-northeast-1',
    regionCidr: '10.100.0.0/16',
    vpcCidr: '10.100.0.0/20',
    tgwAsn: 64512,
  },
  secondary: {
    region: 'ap-northeast-3',
    regionCidr: '10.101.0.0/16',
    vpcCidr: '10.101.0.0/20',
    tgwAsn: 64513,
  },
};
