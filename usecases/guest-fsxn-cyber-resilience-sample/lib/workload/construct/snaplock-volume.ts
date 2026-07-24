import * as cdk from 'aws-cdk-lib';
import { aws_fsx as fsx } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface SnapLockVolumeProps {
  svmId: string;
  volumeName: string;
  volumeSizeMiB: number;
  retentionDays: number;
  minimumRetentionDays: number;
  maximumRetentionYears: number;
  privilegedDelete: 'PERMANENTLY_DISABLED' | 'DISABLED';
}

/**
 * SnapLock Enterprise Volume for immutable backup storage.
 *
 * WARNING: If privilegedDelete is set to 'PERMANENTLY_DISABLED', this is
 * IRREVERSIBLE. No administrator can ever delete WORM-committed files
 * before their retention period expires, even with root/admin access.
 */
export class SnapLockVolume extends Construct {
  public readonly volumeId: string;

  constructor(scope: Construct, id: string, props: SnapLockVolumeProps) {
    super(scope, id);

    const volume = new fsx.CfnVolume(this, 'SnapLockVolume', {
      volumeType: 'ONTAP',
      name: props.volumeName,
      ontapConfiguration: {
        storageVirtualMachineId: props.svmId,
        junctionPath: `/${props.volumeName}`,
        sizeInMegabytes: props.volumeSizeMiB.toString(), // Deployment lesson #4
        storageEfficiencyEnabled: 'true',
        snaplockConfiguration: {
          snaplockType: 'ENTERPRISE',
          retentionPeriod: {
            defaultRetention: { type: 'DAYS', value: props.retentionDays },
            minimumRetention: { type: 'DAYS', value: props.minimumRetentionDays },
            maximumRetention: { type: 'YEARS', value: props.maximumRetentionYears },
          },
          autocommitPeriod: { type: 'HOURS', value: 1 },
          privilegedDelete: props.privilegedDelete,
        },
      },
    });
    volume.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
    this.volumeId = volume.ref;
  }
}
