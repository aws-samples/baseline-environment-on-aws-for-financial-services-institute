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
  monitoring: RegionEnv;
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
  monitoring: {
    region: 'us-west-2',
    regionCidr: '10.102.0.0/16',
    vpcCidr: '10.102.0.0/20',
    tgwAsn: 64514,
  },
};

// Parameter for Staging
export const StageParameter: StackParameter = {
  envName: 'Staging',
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
  monitoring: {
    region: 'us-west-2',
    regionCidr: '10.102.0.0/16',
    vpcCidr: '10.102.0.0/20',
    tgwAsn: 64514,
  },
};

// Parameter for Production
export const ProdParameter: StackParameter = {
  envName: 'Production',
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
  monitoring: {
    region: 'us-west-2',
    regionCidr: '10.102.0.0/16',
    vpcCidr: '10.102.0.0/20',
    tgwAsn: 64514,
  },
};

///// サイバーレジリエンス機能の設定 //////
export const CyberResilienceParameter = {
  // デプロイする場合は true に指定
  deploy: false,
  // どの機能をデプロイか選択
  option: [] as ('backup' | 'restore' | 'isolation')[],

  // Data Bunkerアカウントの設定
  dataBunkerAccount: {
    // アカウントID
    id: '123456789012', // 実際のData BunkerアカウントIDに置き換える
    // Data Bunkerアカウントに作成するバックアップボールト名
    vaultName: 'logical-air-gapped-vault',
  },
  // リストアアカウントの設定
  restoreAccount: {
    // リストアアカウントID
    id: '123456789012',
    // リストアリージョン
    region: 'ap-northeast-1',
  },
};
