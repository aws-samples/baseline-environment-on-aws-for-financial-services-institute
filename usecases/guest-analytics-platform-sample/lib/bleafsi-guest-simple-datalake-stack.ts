import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { PjPrefix, StackParameter } from '../bin/parameter';
import { PrivateVpc, VpcEndpointTypeName } from './constructs/bleafsi-vpc';
import { Bucket } from './constructs/bleafsi-s3-bucket';
import { KmsKey } from './constructs/bleafsi-kms-key';
import { aws_s3 as s3, RemovalPolicy } from 'aws-cdk-lib';
import { aws_athena } from 'aws-cdk-lib';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_glue as glue } from 'aws-cdk-lib';
import { GluePipeline } from './glue-pipeline';
import { QuickSightRole } from './quicksight-role';
import { aws_glue } from 'aws-cdk-lib';
import * as glue_alpha from '@aws-cdk/aws-glue-alpha';
import { aws_s3_deployment as s3deploy } from 'aws-cdk-lib';
import * as origin_data_schema from './resources/OriginDataSchema';
import * as master_data_schema from './resources/MasterDataSchema';

/*
 * BLEA-FSI Analytics Platform: Simple data lake Sample application stack
 */
export class SimpleDataLakeStack extends cdk.Stack {
  readonly vpc: PrivateVpc;
  readonly bucketForOriginData: Bucket;
  readonly bucketForRawData: Bucket;
  readonly bucketForNormalizedData: Bucket;
  readonly bucketForAnalytics: Bucket;
  readonly gluePipeline: GluePipeline;
  readonly bucketForMasterData: Bucket;
  readonly bucketForAthenaQueryOutput: Bucket;
  readonly glueDataCatalogDatabase: glue_alpha.Database;
  readonly glueDataCatalogTable: glue_alpha.Table;
  readonly gluePrivateConnections: glue_alpha.Connection[];
  readonly glueDatabaseForOriginData: glue_alpha.Database;
  readonly glueDatabaseForRawData: glue_alpha.Database;
  readonly glueDatabaseForNormalizedData: glue_alpha.Database;
  readonly glueDatabaseForAnalyticsData: glue_alpha.Database;

  constructor(scope: Construct, id: string, props: StackParameter) {
    super(scope, id, props);

    this.gluePrivateConnections = [];

    // VPC (Private Subnet, 2AZ, VPC FlowLogs, S3 Gateway, SecretsManager VPC Endpoint)
    // Glue Jobs will run on this VPC
    this.vpc = new PrivateVpc(this, 'SampleVpc', {
      vpcIpAddresses: props.simpleDataLake.vpcCidr,
      privateSubnetCidr: 17,
      vpcEndpoints: [VpcEndpointTypeName.S3_Gateway, VpcEndpointTypeName.KMS, VpcEndpointTypeName.Glue],
    });

    // security group for Glue connection. It must contain self referencing inbound rule.
    // see https://docs.aws.amazon.com/glue/latest/dg/setup-vpc-for-glue-access.html
    const glueConnectionSecurityGroup = new ec2.SecurityGroup(this, 'GlueConnectionSecurityGroup', {
      vpc: this.vpc.vpc,
      description: 'Security group for Glue connection',
      allowAllOutbound: false,
    });
    glueConnectionSecurityGroup.addIngressRule(
      glueConnectionSecurityGroup,
      ec2.Port.allTraffic(),
      'allow self referencing',
    );
    // glueConnectionSecurityGroup.addEgressRule(ec2.Peer.ipv4('0.0.0.0/0'), ec2.Port.allTraffic(), 'allow egress');
    // see https://github.com/aws/aws-cdk/issues/7094#issuecomment-1067263518
    const cfnSg = glueConnectionSecurityGroup.node.defaultChild as ec2.CfnSecurityGroup;
    cfnSg.addPropertyOverride('SecurityGroupEgress', [
      {
        CidrIpv6: '::/0',
        Description: 'from ::/0:ALL TRAFFIC',
        IpProtocol: '-1',
      },
      {
        CidrIp: '0.0.0.0/0',
        Description: 'Allow all outbound traffic by default',
        IpProtocol: '-1',
      },
    ]);

    // Glue Connection for private network
    const gluePrivateConnection = new glue_alpha.Connection(this, 'PrivateConnection', {
      type: glue_alpha.ConnectionType.NETWORK,
      // The security groups granting AWS Glue inbound access to the data source within the VPC
      securityGroups: [glueConnectionSecurityGroup],
      // The VPC subnet will be used by the connection
      subnet: this.vpc.vpc.isolatedSubnets[0],
    });
    this.gluePrivateConnections.push(gluePrivateConnection);

    const originBucketName = `${PjPrefix.toLowerCase()}-origin-${cdk.Stack.of(this).account}`;
    const normalizedBucketName = `${PjPrefix.toLowerCase()}-normalized-${cdk.Stack.of(this).account}`;
    const analyticsBucketName = `${PjPrefix.toLowerCase()}-analytics-${cdk.Stack.of(this).account}`;
    const masterDataBucketName = `${PjPrefix.toLowerCase()}-master-${cdk.Stack.of(this).account}`;
    const athenaQueryResultBucketName = `${PjPrefix.toLowerCase()}-athenaquery-output-${cdk.Stack.of(this).account}`;

    // S3バケット暗号化用の共通KMSキー
    const s3KmsKey = new KmsKey(this, 'S3BuketEncryption', {
      description: 'this key is used for encryption of S3 Buckets in Bleafsi datalake',
    });

    // S3バケット（オリジナルデータ）with SSE-KMS CMK
    this.bucketForOriginData = new Bucket(this, 'BucketForOriginData', {
      bucketName: originBucketName,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: s3KmsKey.key,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // S3バケット（生データ）with SSE-KMS CMK
    this.bucketForRawData = new Bucket(this, 'BucketForRawData', {
      bucketName: `${PjPrefix.toLowerCase()}-raw-${cdk.Stack.of(this).account}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: s3KmsKey.key,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // S3バケット（正規化データ）with SSE-KMS CMK
    this.bucketForNormalizedData = new Bucket(this, 'BucketForNormalizedData', {
      bucketName: normalizedBucketName,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: s3KmsKey.key,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // S3バケット（分析用データ）with SSE-KMS CMK
    this.bucketForAnalytics = new Bucket(this, 'BucketForAnalytics', {
      bucketName: analyticsBucketName,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: s3KmsKey.key,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // S3バケット（マスターデータ）
    this.bucketForMasterData = new Bucket(this, 'BucketForMasterData', {
      bucketName: masterDataBucketName,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: s3KmsKey.key,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const glueDatabaseForMasterData = new glue_alpha.Database(this, 'glueDatabaseForMasterData', {
      databaseName: 'master',
    });

    // 取引区分マスタのGlue Tableを作成
    const masterTrxTypeTable = new glue_alpha.Table(this, 'master_trx_type', {
      database: glueDatabaseForMasterData,
      columns: master_data_schema.MasterTrxTypeColumns,
      partitionKeys: [],
      bucket: this.bucketForMasterData.bucket,
      s3Prefix: 'master_trx_type',
      dataFormat: glue_alpha.DataFormat.CSV,
      tableName: 'master_trx_type'.toLowerCase(),
    });
    (masterTrxTypeTable.node.defaultChild as aws_glue.CfnTable).addPropertyOverride('TableInput.Parameters', {
      'skip.header.line.count': '1',
    });

    // 取引区分マスタをアップロードする
    new s3deploy.BucketDeployment(this, 'upload masterTrxType', {
      sources: [s3deploy.Source.asset('./resources/master_trx_type/')],
      destinationBucket: this.bucketForMasterData.bucket,
      destinationKeyPrefix: 'master_trx_type',
    });

    // 科目マスタのGlue Tableを作成
    const masterAcctTable = new glue_alpha.Table(this, 'master_acct', {
      database: glueDatabaseForMasterData,
      columns: master_data_schema.MasterAcctColumns,
      partitionKeys: [],
      bucket: this.bucketForMasterData.bucket,
      s3Prefix: 'master_acct',
      dataFormat: glue_alpha.DataFormat.CSV,
      tableName: 'master_acct'.toLowerCase(),
    });
    (masterAcctTable.node.defaultChild as aws_glue.CfnTable).addPropertyOverride('TableInput.Parameters', {
      'skip.header.line.count': '1',
    });

    // 科目マスタをアップロードする
    new s3deploy.BucketDeployment(this, 'upload masterAcct', {
      sources: [s3deploy.Source.asset('./resources/master_acct/')],
      destinationBucket: this.bucketForMasterData.bucket,
      destinationKeyPrefix: 'master_acct',
    });

    // 支店マスタのGlue Tableを作成
    const masterBranch = new glue_alpha.Table(this, 'master_branch', {
      database: glueDatabaseForMasterData,
      columns: master_data_schema.MasterBranchColumns,
      partitionKeys: [],
      bucket: this.bucketForMasterData.bucket,
      s3Prefix: 'master_branch',
      dataFormat: new glue_alpha.DataFormat({
        inputFormat: glue_alpha.InputFormat.TEXT,
        outputFormat: glue_alpha.OutputFormat.HIVE_IGNORE_KEY_TEXT,
        serializationLibrary: glue_alpha.SerializationLibrary.LAZY_SIMPLE,
      }),
      tableName: 'master_branch'.toLowerCase(),
    });
    (masterBranch.node.defaultChild as aws_glue.CfnTable).addPropertyOverride('TableInput.Parameters', {
      'skip.header.line.count': '1',
    });
    (masterBranch.node.defaultChild as aws_glue.CfnTable).addPropertyOverride(
      'TableInput.StorageDescriptor.SerdeInfo.Parameters',
      {
        'serialization.format': ',',
        'field.delim': ',',
      },
    );
    masterBranch.node.addDependency(masterBranch);

    // 支店マスタをアップロードする
    new s3deploy.BucketDeployment(this, 'upload masterBranch', {
      sources: [s3deploy.Source.asset('./resources/master_branch/')],
      destinationBucket: this.bucketForMasterData.bucket,
      destinationKeyPrefix: 'master_branch',
    });

    //Glue Databaseを作成
    this.glueDatabaseForOriginData = new glue_alpha.Database(this, 'glueDatabaseForOriginData', {
      databaseName: 'origin',
    });
    this.glueDatabaseForRawData = new glue_alpha.Database(this, 'glueDatabaseForRawData', {
      databaseName: 'raw',
    });
    this.glueDatabaseForNormalizedData = new glue_alpha.Database(this, 'glueDatabaseForNormalizedData', {
      databaseName: 'normalized',
    });
    this.glueDatabaseForAnalyticsData = new glue_alpha.Database(this, 'glueDatabaseForAnalyticsData', {
      databaseName: 'analytics',
    });

    //OriginデータのGlue Tableを作成
    const originCustomerTable = new glue_alpha.Table(this, 'Customer', {
      database: this.glueDatabaseForOriginData,
      columns: origin_data_schema.CustomerColumns,
      partitionKeys: [],
      bucket: this.bucketForOriginData.bucket,
      s3Prefix: 'Customer',
      dataFormat: glue_alpha.DataFormat.CSV,
      tableName: 'Customer'.toLowerCase(),
    });
    (originCustomerTable.node.defaultChild as aws_glue.CfnTable).addPropertyOverride('TableInput.Parameters', {
      'skip.header.line.count': '1',
    });

    const originInternetBankingUserTable = new glue_alpha.Table(this, 'InternetBankingUser', {
      database: this.glueDatabaseForOriginData,
      columns: origin_data_schema.InternetBankingUserColumns,
      partitionKeys: [],
      bucket: this.bucketForOriginData.bucket,
      s3Prefix: 'InternetBankingUser',
      dataFormat: glue_alpha.DataFormat.CSV,
      tableName: 'InternetBankingUser'.toLowerCase(),
    });
    (originInternetBankingUserTable.node.defaultChild as aws_glue.CfnTable).addPropertyOverride(
      'TableInput.Parameters',
      {
        'skip.header.line.count': '1',
      },
    );

    const originCustomerAccountTable = new glue_alpha.Table(this, 'CustomerAccount', {
      database: this.glueDatabaseForOriginData,
      columns: origin_data_schema.CustomerAccountColumns,
      partitionKeys: [],
      bucket: this.bucketForOriginData.bucket,
      s3Prefix: 'CustomerAccount',
      dataFormat: glue_alpha.DataFormat.CSV,
      tableName: 'CustomerAccount'.toLowerCase(),
    });
    (originCustomerAccountTable.node.defaultChild as aws_glue.CfnTable).addPropertyOverride('TableInput.Parameters', {
      'skip.header.line.count': '1',
    });

    const originDepositWithdrawHistoryTable = new glue_alpha.Table(this, 'DepositWithdrawHistory', {
      database: this.glueDatabaseForOriginData,
      columns: origin_data_schema.DepositWithdrawHistoryColumns,
      partitionKeys: [],
      bucket: this.bucketForOriginData.bucket,
      s3Prefix: 'DepositWithdrawHistory',
      dataFormat: glue_alpha.DataFormat.CSV,
      tableName: 'DepositWithdrawHistory'.toLowerCase(),
    });
    (originDepositWithdrawHistoryTable.node.defaultChild as aws_glue.CfnTable).addPropertyOverride(
      'TableInput.Parameters',
      {
        'skip.header.line.count': '1',
      },
    );

    // S3バケット（Athena検索結果用） データは Athena Workgroup側で暗号化するためKMSでは暗号化しない
    this.bucketForAthenaQueryOutput = new Bucket(this, 'BucketForAthenaQueryOutput', {
      bucketName: athenaQueryResultBucketName,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      createAccessLog: false,
    });

    // Athena workgroup
    const athenaWorkGroupKey = new KmsKey(this, 'AthenaWorkGroupEncryption', {
      description: 'this key is used for encryption of AthenaWorkGroup such as query result ',
    });

    new aws_athena.CfnWorkGroup(this, 'AthenaWorkGroup', {
      name: `${PjPrefix.toLowerCase()}-workgroup`,
      description: 'athena workgroup for analytics platform',
      workGroupConfiguration: {
        engineVersion: {
          selectedEngineVersion: 'Athena engine version 3',
        },
        enforceWorkGroupConfiguration: true,
        resultConfiguration: {
          encryptionConfiguration: {
            encryptionOption: 'SSE_KMS',
            kmsKey: athenaWorkGroupKey.key.keyId,
          },
          outputLocation: this.bucketForAthenaQueryOutput.bucket.s3UrlForObject() + '/',
        },
      },
    });

    // ETL Job pipeline
    this.gluePipeline = new GluePipeline(
      this,
      'GluePipeline',
      {
        glueConnections: this.gluePrivateConnections,
        bucketForOriginData: this.bucketForOriginData,
        bucketForRawData: this.bucketForRawData,
        bucketForNormalizedData: this.bucketForNormalizedData,
        bucketForAnalyticsData: this.bucketForAnalytics,
        glueDatabaseForOriginData: this.glueDatabaseForOriginData,
        glueDatabaseForRawData: this.glueDatabaseForRawData,
        glueDatabaseForNormalizedData: this.glueDatabaseForNormalizedData,
        glueDatabaseForAnalyticsData: this.glueDatabaseForAnalyticsData,
        kmsForGlueCatalog: athenaWorkGroupKey,
      },
      props,
    );

    // Glue Catalog Encryption Settings
    new glue.CfnDataCatalogEncryptionSettings(this, 'MyCfnDataCatalogEncryptionSettings', {
      catalogId: `${cdk.Stack.of(this).account}`,
      dataCatalogEncryptionSettings: {
        connectionPasswordEncryption: {
          kmsKeyId: athenaWorkGroupKey.key.keyId,
          returnConnectionPasswordEncrypted: true,
        },
        encryptionAtRest: {
          catalogEncryptionMode: 'SSE-KMS',
          sseAwsKmsKeyId: athenaWorkGroupKey.key.keyId,
        },
      },
    });

    // QuickSight クエリー権限をIAMロールに割り当てる
    new QuickSightRole(this, 'QuickSight Role Policy', {
      normalizedBucketName: normalizedBucketName,
      analyticsBucketName: analyticsBucketName,
      masterDataBucketName: masterDataBucketName,
      athenaQueryResultBucketName: athenaQueryResultBucketName,
      athenaKmsKey: athenaWorkGroupKey,
      s3KmsKey: s3KmsKey,
    });

    // CFn output
    new cdk.CfnOutput(this, 'S3 Bucket url for Origin data', {
      value: `s3://${this.bucketForOriginData.bucket.bucketName}`,
      description: 'S3 Bucket for Origin data',
    });
  }
}
