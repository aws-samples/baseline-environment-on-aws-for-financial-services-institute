/**
 * Shared ONTAP REST API client for Lambda Custom Resources.
 * Used by: Spec B (TPS, ARP/AI), Spec G (FlexCache, Peering), Spec H (FlexClone, TPS)
 *
 * Authentication: Retrieves credentials from AWS Secrets Manager.
 * Retry: Exponential backoff, max 3 attempts.
 * Logging: Structured JSON to CloudWatch Logs (credentials excluded).
 */

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

export interface OntapClientConfig {
  managementEndpoint: string; // FSxN management DNS or IP
  secretArn: string; // Secrets Manager ARN for fsxadmin password
  region: string;
}

export interface OntapApiResponse {
  statusCode: number;
  body: any;
}

export class OntapClient {
  private config: OntapClientConfig;
  private password: string | null = null;
  private readonly maxRetries = 3;
  private readonly baseDelayMs = 1000;

  constructor(config: OntapClientConfig) {
    this.config = config;
  }

  /**
   * Retrieve fsxadmin password from Secrets Manager.
   */
  async authenticate(): Promise<void> {
    const client = new SecretsManagerClient({ region: this.config.region });
    const response = await client.send(new GetSecretValueCommand({ SecretId: this.config.secretArn }));
    if (!response.SecretString) {
      throw new Error('Secret value is empty');
    }
    const secret = JSON.parse(response.SecretString);
    this.password = secret.password || secret.fsxadmin_password || response.SecretString;
  }

  /**
   * Execute ONTAP REST API call with retry logic.
   */
  async call(method: string, path: string, body?: any): Promise<OntapApiResponse> {
    if (!this.password) {
      await this.authenticate();
    }

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const url = `https://${this.config.managementEndpoint}/api${path}`;
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`fsxadmin:${this.password}`).toString('base64')}`,
        };

        const options: RequestInit = { method, headers };
        if (body && (method === 'POST' || method === 'PATCH')) {
          options.body = JSON.stringify(body);
        }

        // Structured log (no credentials)
        console.log(
          JSON.stringify({
            event: 'ontap_api_call',
            attempt,
            method,
            path,
            endpoint: this.config.managementEndpoint,
            hasBody: !!body,
          }),
        );

        const response = await fetch(url, options);
        const responseBody = await response.json().catch(() => ({}));

        console.log(
          JSON.stringify({
            event: 'ontap_api_response',
            attempt,
            statusCode: response.status,
            path,
          }),
        );

        if (response.ok) {
          return { statusCode: response.status, body: responseBody };
        }

        // Non-retryable errors
        if (response.status === 400 || response.status === 401 || response.status === 403) {
          throw new Error(`ONTAP API error (${response.status}): ${JSON.stringify(responseBody)}`);
        }

        // Retryable errors (5xx, timeout)
        if (attempt < this.maxRetries) {
          const delay = this.baseDelayMs * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        throw new Error(
          `ONTAP API failed after ${this.maxRetries} attempts: ${response.status} ${JSON.stringify(responseBody)}`,
        );
      } catch (error: any) {
        if (attempt >= this.maxRetries || error.message.includes('ONTAP API error')) {
          throw error;
        }
        const delay = this.baseDelayMs * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new Error('Unreachable');
  }

  // ──────────────────────────────────────────────
  // High-level operations (used by specific Specs)
  // ──────────────────────────────────────────────

  /** Spec B: Enable Tamperproof Snapshot (Snapshot Locking) */
  async enableTPS(volumeUuid: string, retentionDays: number): Promise<OntapApiResponse> {
    return this.call('PATCH', `/storage/volumes/${volumeUuid}`, {
      snapshot_locking_enabled: true,
      snapshot_lock: { retention_period: `P${retentionDays}D` },
    });
  }

  /** Spec B: Enable ARP/AI */
  async enableARP(volumeUuid: string, mode: 'learning' | 'active' = 'learning'): Promise<OntapApiResponse> {
    return this.call('PATCH', `/storage/volumes/${volumeUuid}`, {
      anti_ransomware: { state: mode === 'learning' ? 'enabled' : 'active' },
    });
  }

  /** Spec B: Disable ARP/AI */
  async disableARP(volumeUuid: string): Promise<OntapApiResponse> {
    return this.call('PATCH', `/storage/volumes/${volumeUuid}`, {
      anti_ransomware: { state: 'disabled' },
    });
  }

  /** Spec G: Create inter-cluster peering */
  async createClusterPeering(remoteIpAddresses: string[], passphrase: string): Promise<OntapApiResponse> {
    return this.call('POST', '/cluster/peers', {
      remote: { ip_addresses: remoteIpAddresses },
      authentication: { passphrase },
    });
  }

  /** Spec G: Create SVM peering */
  async createSvmPeering(
    localSvmName: string,
    peerClusterName: string,
    peerSvmName: string,
  ): Promise<OntapApiResponse> {
    return this.call('POST', '/svm/peers', {
      svm: { name: localSvmName },
      peer: { cluster: { name: peerClusterName }, svm: { name: peerSvmName } },
    });
  }

  /** Spec G: Create FlexCache volume */
  async createFlexCache(
    name: string,
    svmName: string,
    originVolumePath: string,
    originSvmName: string,
    sizeMiB: number,
  ): Promise<OntapApiResponse> {
    return this.call('POST', '/storage/flexcache/flexcaches', {
      name,
      svm: { name: svmName },
      origins: [{ volume: { name: originVolumePath }, svm: { name: originSvmName } }],
      size: sizeMiB * 1024 * 1024, // bytes
    });
  }

  /** Spec G: Enable write-back mode on FlexCache */
  async enableFlexCacheWriteBack(flexcacheUuid: string): Promise<OntapApiResponse> {
    return this.call('PATCH', `/storage/flexcache/flexcaches/${flexcacheUuid}`, {
      writeback: { enabled: true },
    });
  }

  /** Spec H: Create FlexClone */
  async createFlexClone(parentVolumeName: string, cloneName: string, svmName: string): Promise<OntapApiResponse> {
    return this.call('POST', '/storage/volumes', {
      name: cloneName,
      svm: { name: svmName },
      clone: { parent_volume: { name: parentVolumeName }, is_flexclone: true },
    });
  }

  /** Get volume UUID by name (utility) */
  async getVolumeUuid(volumeName: string, svmName: string): Promise<string> {
    const response = await this.call('GET', `/storage/volumes?name=${volumeName}&svm.name=${svmName}&fields=uuid`);
    if (response.body?.records?.length > 0) {
      return response.body.records[0].uuid;
    }
    throw new Error(`Volume not found: ${volumeName} in SVM ${svmName}`);
  }
}
