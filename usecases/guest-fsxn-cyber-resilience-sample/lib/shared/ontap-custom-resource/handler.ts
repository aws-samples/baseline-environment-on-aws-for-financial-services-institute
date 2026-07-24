/**
 * CloudFormation Custom Resource handler for ONTAP REST API operations.
 * Manages: TPS (Tamperproof Snapshot), ARP/AI, SnapVault relationships.
 *
 * Authentication: Retrieves fsxadmin credentials from AWS Secrets Manager.
 * Retry: Exponential backoff, max 3 attempts.
 * Logging: Structured JSON (credentials excluded).
 *
 * Runtime: Node.js 20.x
 * ReservedConcurrentExecutions: 2
 */

import { CloudFormationCustomResourceEvent, CloudFormationCustomResourceResponse } from 'aws-lambda';

// Import shared ONTAP client (copied from shared/lambda/ontap-custom-resource/)
import { OntapClient } from './ontap-client';

interface CustomResourceProperties {
  ServiceToken: string;
  action: 'ENABLE_TPS' | 'ENABLE_ARP' | 'DISABLE_ARP' | 'CREATE_SNAPVAULT';
  managementEndpoint: string;
  secretArn: string;
  region: string;
  svmName: string;
  volumeName: string;
  // TPS
  tpsRetentionDays?: number;
  // ARP
  arpMode?: 'learning' | 'active';
  // SnapVault
  destinationVolumeName?: string;
  snapvaultSchedule?: string;
}

export async function handler(event: CloudFormationCustomResourceEvent): Promise<CloudFormationCustomResourceResponse> {
  const props = event.ResourceProperties as unknown as CustomResourceProperties;

  console.log(
    JSON.stringify({
      event: 'custom_resource_invocation',
      requestType: event.RequestType,
      action: props.action,
      volumeName: props.volumeName,
      // No credentials logged
    }),
  );

  const client = new OntapClient({
    managementEndpoint: props.managementEndpoint,
    secretArn: props.secretArn,
    region: props.region,
  });

  try {
    const physicalResourceId = `ontap-${props.action}-${props.volumeName}`;
    const data: Record<string, string> = {};

    if (event.RequestType === 'Delete') {
      // On delete: only disable ARP (TPS-locked snapshots remain until expiry by design)
      if (props.action === 'ENABLE_ARP') {
        const volumeUuid = await client.getVolumeUuid(props.volumeName, props.svmName);
        await client.disableARP(volumeUuid);
        console.log(JSON.stringify({ event: 'arp_disabled', volumeName: props.volumeName }));
      }
      // TPS: do nothing on delete (locked snapshots cannot be removed)
      // SnapVault: TODO — break relationship
      return buildResponse(event, 'SUCCESS', physicalResourceId, data);
    }

    // Create or Update
    const volumeUuid = await client.getVolumeUuid(props.volumeName, props.svmName);

    switch (props.action) {
      case 'ENABLE_TPS': {
        const retentionDays = props.tpsRetentionDays ?? 7;
        await client.enableTPS(volumeUuid, retentionDays);
        data.tpsRetentionDays = retentionDays.toString();
        console.log(
          JSON.stringify({
            event: 'tps_enabled',
            volumeName: props.volumeName,
            retentionDays,
          }),
        );
        break;
      }

      case 'ENABLE_ARP': {
        const mode = props.arpMode ?? 'learning';
        await client.enableARP(volumeUuid, mode);
        data.arpMode = mode;
        console.log(JSON.stringify({ event: 'arp_enabled', volumeName: props.volumeName, mode }));
        break;
      }

      case 'CREATE_SNAPVAULT': {
        // SnapVault = SnapMirror with vault policy
        // This creates a protection relationship from source volume to SnapLock destination
        // TODO: Implement once SnapMirror API paths are validated
        console.log(
          JSON.stringify({
            event: 'snapvault_placeholder',
            volumeName: props.volumeName,
            destinationVolumeName: props.destinationVolumeName,
          }),
        );
        break;
      }

      default:
        throw new Error(`Unknown action: ${props.action}`);
    }

    return buildResponse(event, 'SUCCESS', physicalResourceId, data);
  } catch (error: any) {
    console.error(
      JSON.stringify({
        event: 'custom_resource_error',
        action: props.action,
        volumeName: props.volumeName,
        error: error.message,
      }),
    );
    return buildResponse(event, 'FAILED', `ontap-${props.action}-${props.volumeName}-failed`, {}, error.message);
  }
}

function buildResponse(
  event: CloudFormationCustomResourceEvent,
  status: 'SUCCESS' | 'FAILED',
  physicalResourceId: string,
  data: Record<string, string>,
  reason?: string,
): CloudFormationCustomResourceResponse {
  return {
    Status: status,
    Reason: reason ?? '',
    PhysicalResourceId: physicalResourceId,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: data,
  };
}
