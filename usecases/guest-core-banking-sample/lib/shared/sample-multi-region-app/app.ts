import { RemovalPolicy, Duration, Stack, CfnOutput } from 'aws-cdk-lib';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { IVpc } from 'aws-cdk-lib/aws-ec2';
import { RecordSet, RecordType, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { Cluster } from 'aws-cdk-lib/aws-ecs';
import { ApplicationLoadBalancer, ApplicationProtocol, ListenerAction } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { IHostedZone } from 'aws-cdk-lib/aws-route53';
import { LoadBalancerTarget } from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';
import { SampleAppService } from './service';
import { IAuroraGlobalCluster } from '../aurora-cluster';
import { SampleAppWorker } from './worker';
import { Canary } from './canary';

export interface SampleMultiRegionAppProps {
  balanceDatabase: IAuroraGlobalCluster;
  countDatabase: IAuroraGlobalCluster;
  mainDynamoDbTableName: string;
  vpc: IVpc;
  hostedZone: IHostedZone;
}

/**
 * マルチリージョン サンプルアプリケーション用のECS Fargateコンテナ、Application LBを作成
 */
export class SampleMultiRegionApp extends Construct {
  public readonly paramTable: Table;
  public readonly alb: ApplicationLoadBalancer;

  constructor(scope: Construct, id: string, props: SampleMultiRegionAppProps) {
    super(scope, id);

    const { vpc } = props;

    const paramTable = new Table(this, 'ParamTable', {
      partitionKey: {
        name: 'PK',
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    this.paramTable = paramTable;

    new CfnOutput(this, 'ParamTableName', { value: paramTable.tableName });

    const alb = new ApplicationLoadBalancer(this, 'Alb', {
      vpc,
      vpcSubnets: vpc.selectSubnets({
        subnetGroupName: 'Protected',
      }),
    });
    this.alb = alb;

    const recordSet = new RecordSet(this, 'MyRecordSet', {
      recordType: RecordType.A,
      target: RecordTarget.fromAlias(new LoadBalancerTarget(alb)),
      zone: props.hostedZone,
      recordName: `api.${Stack.of(this).region}`,
      ttl: Duration.seconds(60),
    });

    const listener = alb.addListener('Listener', {
      port: 80,
      protocol: ApplicationProtocol.HTTP,
      // In the production environment, set this to `false` use the listener's `connections` object to selectively grant access to the load balancer on the listener port.
      open: true,
      defaultAction: ListenerAction.fixedResponse(400),
    });

    const cluster = new Cluster(this, 'Cluster', {
      vpc,
      containerInsights: true,
    });

    //マイクロサービス コンテナの作成

    //Balanceサービスの起動
    new SampleAppService(this, 'Balance', {
      cluster,
      vpc,
      listener,
      listenerPath: 'balance',
      priority: 1,
      auroraDatabase: props.balanceDatabase,
      enableAdot: true,
    });

    //Countサービスの起動
    new SampleAppService(this, 'Count', {
      cluster,
      vpc,
      listener,
      listenerPath: 'count',
      priority: 2,
      auroraDatabase: props.balanceDatabase,
      enableAdot: true,
    });

    //Transactionサービスの起動
    new SampleAppService(this, 'Transaction', {
      cluster,
      vpc,
      listener,
      listenerPath: 'transaction',
      priority: 3,
      mainTableName: props.mainDynamoDbTableName,
      paramTable,
      enableAdot: true,
    });

    //Transaction Workerサービスの起動
    new SampleAppWorker(this, 'TransactionWorker', {
      cluster,
      vpc,
      mainTableName: props.mainDynamoDbTableName,
      paramTable,
      balanceEndpoint: `http://${alb.loadBalancerDnsName}/balance`,
      countEndpoint: `http://${alb.loadBalancerDnsName}/count`,
      enableAdot: true,
    });

    //CloudWatch syntheticsの設定
    new Canary(this, 'Canary', {
      vpc: vpc,
      targetApiUrl: `http://api.${props.hostedZone.zoneName}`,
    });
  }
}
