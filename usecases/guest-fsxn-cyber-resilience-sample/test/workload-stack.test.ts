import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { WorkloadStack } from '../lib/workload/stack/workload-stack';

let template: Template;

beforeAll(() => {
  const app = new cdk.App();
  const stack = new WorkloadStack(app, 'TestWorkload', {
    env: { account: '123456789012', region: 'ap-northeast-1' },
    envName: 'Test',
    monitoringNotifyEmail: 'test@example.com',
    monitoringSlackWorkspaceId: '',
    monitoringSlackChannelId: '',
    vpcCidr: '10.0.0.0/16',
    fsxnStorageCapacityGiB: 1024,
    fsxnThroughputCapacityMBps: 128,
    fsxnDeploymentType: 'MULTI_AZ_1',
    fsxnSvmName: 'svm-test',
    fsxnProductionVolumeName: 'vol_test',
    fsxnProductionVolumeSizeMiB: 102400,
    fsxnJunctionPath: '/test',
    ontapSecretArn: 'arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:test-XXXXXX',
    tpsRetentionDays: 7,
    arpInitialMode: 'learning',
    snaplockVolumeName: 'snaplock_test',
    snaplockVolumeSizeMiB: 51200,
    snaplockRetentionDays: 30,
    snaplockMinimumRetentionDays: 7,
    snaplockMaximumRetentionYears: 1,
    snaplockPrivilegedDelete: 'PERMANENTLY_DISABLED',
    backupRetentionDays: 30,
    enableNetworkIsolation: true,
    enableSnapVault: true,
  });
  template = Template.fromStack(stack);
});

describe('FSxN File System', () => {
  test('is created with KMS encryption', () => {
    template.hasResourceProperties('AWS::FSx::FileSystem', {
      FileSystemType: 'ONTAP',
      KmsKeyId: Match.anyValue(),
    });
  });

  test('has Multi-AZ deployment with RouteTableIds', () => {
    template.hasResourceProperties('AWS::FSx::FileSystem', {
      OntapConfiguration: Match.objectLike({
        DeploymentType: 'MULTI_AZ_1',
        RouteTableIds: Match.anyValue(),
      }),
    });
  });
});

describe('SnapLock Volume', () => {
  test('is created with Enterprise type', () => {
    template.hasResourceProperties('AWS::FSx::Volume', {
      OntapConfiguration: Match.objectLike({
        SnaplockConfiguration: Match.objectLike({
          SnaplockType: 'ENTERPRISE',
          PrivilegedDelete: 'PERMANENTLY_DISABLED',
        }),
      }),
    });
  });

  test('has correct retention period', () => {
    template.hasResourceProperties('AWS::FSx::Volume', {
      OntapConfiguration: Match.objectLike({
        SnaplockConfiguration: Match.objectLike({
          RetentionPeriod: Match.objectLike({
            DefaultRetention: { Type: 'DAYS', Value: 30 },
          }),
        }),
      }),
    });
  });
});

describe('Custom Resources', () => {
  test('creates TPS, ARP, and SnapVault custom resources', () => {
    template.resourceCountIs('AWS::CloudFormation::CustomResource', 3);
  });
});

describe('Backup', () => {
  test('creates backup plan', () => {
    template.resourceCountIs('AWS::Backup::BackupPlan', 1);
  });

  test('creates backup vault', () => {
    template.resourceCountIs('AWS::Backup::BackupVault', 1);
  });
});

describe('Network Isolation', () => {
  test('creates EventBridge rule for GuardDuty', () => {
    template.hasResourceProperties('AWS::Events::Rule', {
      EventPattern: Match.objectLike({
        source: ['aws.guardduty'],
      }),
    });
  });
});

describe('Monitoring', () => {
  test('creates CloudWatch alarms', () => {
    template.resourceCountIs('AWS::CloudWatch::Alarm', 4); // throughput + storage + cpu + backup failure
  });

  test('has SNS topic', () => {
    template.resourceCountIs('AWS::SNS::Topic', 1);
  });
});

describe('Security', () => {
  test('no Internet Gateway', () => {
    template.resourceCountIs('AWS::EC2::InternetGateway', 0);
  });

  test('no NAT Gateway', () => {
    template.resourceCountIs('AWS::EC2::NatGateway', 0);
  });

  test('KMS key has rotation enabled', () => {
    template.hasResourceProperties('AWS::KMS::Key', {
      EnableKeyRotation: true,
    });
  });
});
