import * as cdk from 'aws-cdk-lib';
import { aws_ec2 as ec2, aws_fsx as fsx, aws_kms as kms } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface FsxnStorageProps {
  vpc: ec2.IVpc;
  fsxnSecurityGroup: ec2.ISecurityGroup;
  privateSubnetRouteTableIds: string[];
  storageCapacityGiB: number;
  throughputCapacityMBps: number;
  deploymentType: 'MULTI_AZ_1' | 'SINGLE_AZ_1';
  svmName: string;
  volumeName: string;
  volumeSizeMiB: number;
  junctionPath: string;
  kmsKey: kms.IKey;
}

export class FsxnStorage extends Construct {
  /** CloudFormation FileSystem ID (fs-xxx) */
  public readonly fileSystemId: string;
  /** CloudFormation Volume ID (fsvol-xxx) */
  public readonly volumeId: string;
  /** CloudFormation SVM ID (svm-xxx) */
  public readonly svmId: string;
  /** ONTAP management endpoint DNS for REST API access */
  public readonly managementEndpoint: string;

  constructor(scope: Construct, id: string, props: FsxnStorageProps) {
    super(scope, id);

    const subnets = props.vpc.isolatedSubnets;

    const fileSystem = new fsx.CfnFileSystem(this, 'FileSystem', {
      fileSystemType: 'ONTAP',
      storageCapacity: props.storageCapacityGiB,
      subnetIds: props.deploymentType === 'MULTI_AZ_1' ? subnets.map((s) => s.subnetId) : [subnets[0].subnetId],
      securityGroupIds: [props.fsxnSecurityGroup.securityGroupId],
      kmsKeyId: props.kmsKey.keyArn,
      ontapConfiguration: {
        deploymentType: props.deploymentType,
        throughputCapacity: props.throughputCapacityMBps,
        preferredSubnetId: subnets[0].subnetId,
        // RouteTableIds only for Multi-AZ (Deployment lesson #1)
        ...(props.deploymentType === 'MULTI_AZ_1' && {
          routeTableIds: props.privateSubnetRouteTableIds,
        }),
      },
    });
    fileSystem.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
    this.fileSystemId = fileSystem.ref;

    // Management endpoint for ONTAP REST API access
    this.managementEndpoint = `management.${fileSystem.ref}.fsx.${cdk.Stack.of(this).region}.amazonaws.com`;

    const svm = new fsx.CfnStorageVirtualMachine(this, 'SVM', {
      fileSystemId: fileSystem.ref,
      name: props.svmName,
      rootVolumeSecurityStyle: 'UNIX',
    });
    this.svmId = svm.ref;

    const volume = new fsx.CfnVolume(this, 'ProductionVolume', {
      volumeType: 'ONTAP',
      name: props.volumeName,
      ontapConfiguration: {
        storageVirtualMachineId: svm.ref,
        junctionPath: props.junctionPath,
        sizeInMegabytes: props.volumeSizeMiB.toString(), // Deployment lesson #4
        storageEfficiencyEnabled: 'true',
        tieringPolicy: { name: 'AUTO', coolingPeriod: 31 },
      },
    });
    volume.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
    this.volumeId = volume.ref;
  }
}
