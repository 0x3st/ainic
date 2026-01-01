// deSEC API client

import type { DeSECRRSet, DeSECZone } from './types';

const DESEC_API_BASE = 'https://desec.io/api/v1';

export class DeSECClient {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<{ success: true; data: T } | { success: false; error: string; status: number }> {
    const url = `${DESEC_API_BASE}${path}`;
    const headers: Record<string, string> = {
      'Authorization': `Token ${this.token}`,
      'Content-Type': 'application/json',
    };

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage: string;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.detail || errorJson.message || errorText;
        } catch {
          errorMessage = errorText;
        }
        return { success: false, error: errorMessage, status: response.status };
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return { success: true, data: null as T };
      }

      const data = await response.json() as T;
      return { success: true, data };
    } catch (e) {
      return { success: false, error: `Request failed: ${e}`, status: 0 };
    }
  }

  // Create a new zone
  async createZone(domain: string): Promise<{ success: true; data: DeSECZone } | { success: false; error: string; status: number }> {
    return this.request<DeSECZone>('POST', '/domains/', { name: domain });
  }

  // Get zone info
  async getZone(domain: string): Promise<{ success: true; data: DeSECZone } | { success: false; error: string; status: number }> {
    return this.request<DeSECZone>('GET', `/domains/${domain}/`);
  }

  // Delete a zone
  async deleteZone(domain: string): Promise<{ success: true; data: null } | { success: false; error: string; status: number }> {
    return this.request<null>('DELETE', `/domains/${domain}/`);
  }

  // Get all RRsets for a zone
  async getRRSets(domain: string): Promise<{ success: true; data: DeSECRRSet[] } | { success: false; error: string; status: number }> {
    return this.request<DeSECRRSet[]>('GET', `/domains/${domain}/rrsets/`);
  }

  // Get specific RRset
  async getRRSet(
    domain: string,
    subname: string,
    type: string
  ): Promise<{ success: true; data: DeSECRRSet } | { success: false; error: string; status: number }> {
    const encodedSubname = subname === '' ? '@' : encodeURIComponent(subname);
    return this.request<DeSECRRSet>('GET', `/domains/${domain}/rrsets/${encodedSubname}/${type}/`);
  }

  // Create or update RRset (PUT is idempotent)
  async putRRSet(
    domain: string,
    rrset: DeSECRRSet
  ): Promise<{ success: true; data: DeSECRRSet } | { success: false; error: string; status: number }> {
    const encodedSubname = rrset.subname === '' ? '@' : encodeURIComponent(rrset.subname);
    return this.request<DeSECRRSet>(
      'PUT',
      `/domains/${domain}/rrsets/${encodedSubname}/${rrset.type}/`,
      rrset
    );
  }

  // Delete RRset
  async deleteRRSet(
    domain: string,
    subname: string,
    type: string
  ): Promise<{ success: true; data: null } | { success: false; error: string; status: number }> {
    const encodedSubname = subname === '' ? '@' : encodeURIComponent(subname);
    return this.request<null>('DELETE', `/domains/${domain}/rrsets/${encodedSubname}/${type}/`);
  }

  // Bulk update RRsets (PATCH on the rrsets collection)
  async bulkUpdateRRSets(
    domain: string,
    rrsets: DeSECRRSet[]
  ): Promise<{ success: true; data: DeSECRRSet[] } | { success: false; error: string; status: number }> {
    return this.request<DeSECRRSet[]>('PATCH', `/domains/${domain}/rrsets/`, rrsets);
  }

  // Add NS delegation in parent zone
  async addNSDelegation(
    parentZone: string,
    childLabel: string,
    nsRecords: string[]
  ): Promise<{ success: true; data: DeSECRRSet } | { success: false; error: string; status: number }> {
    const rrset: DeSECRRSet = {
      subname: childLabel,
      type: 'NS',
      ttl: 3600,
      records: nsRecords,
    };
    return this.putRRSet(parentZone, rrset);
  }

  // Remove NS delegation from parent zone
  async removeNSDelegation(
    parentZone: string,
    childLabel: string
  ): Promise<{ success: true; data: null } | { success: false; error: string; status: number }> {
    return this.deleteRRSet(parentZone, childLabel, 'NS');
  }

  // Get NS records for a zone (from the zone's own NS records at apex)
  async getZoneNS(domain: string): Promise<{ success: true; data: string[] } | { success: false; error: string; status: number }> {
    const result = await this.getRRSet(domain, '', 'NS');
    if (!result.success) {
      return result;
    }
    return { success: true, data: result.data.records };
  }
}

// Helper to create a subdomain zone and set up delegation
export async function createSubdomainWithDelegation(
  client: DeSECClient,
  parentZone: string,
  label: string
): Promise<{ success: true; fqdn: string; ns: string[] } | { success: false; error: string }> {
  const fqdn = `${label}.${parentZone}`;

  // Step 1: Create the subdomain zone
  const createResult = await client.createZone(fqdn);
  if (!createResult.success) {
    // Check if zone already exists (409 Conflict)
    if (createResult.status === 409) {
      return { success: false, error: 'Domain already exists' };
    }
    return { success: false, error: `Failed to create zone: ${createResult.error}` };
  }

  // Step 2: Get the NS records for the new zone
  // deSEC automatically creates NS records for new zones
  // We need to wait a moment and then fetch them
  const nsResult = await client.getZoneNS(fqdn);
  if (!nsResult.success) {
    // Cleanup: delete the zone we just created
    await client.deleteZone(fqdn);
    return { success: false, error: `Failed to get NS records: ${nsResult.error}` };
  }

  const nsRecords = nsResult.data;

  // Step 3: Add NS delegation in parent zone
  const delegationResult = await client.addNSDelegation(parentZone, label, nsRecords);
  if (!delegationResult.success) {
    // Cleanup: delete the zone we just created
    await client.deleteZone(fqdn);
    return { success: false, error: `Failed to add NS delegation: ${delegationResult.error}` };
  }

  return { success: true, fqdn, ns: nsRecords };
}

// Helper to delete a subdomain zone and remove delegation
export async function deleteSubdomainWithDelegation(
  client: DeSECClient,
  parentZone: string,
  label: string
): Promise<{ success: true } | { success: false; error: string }> {
  const fqdn = `${label}.${parentZone}`;

  // Step 1: Remove NS delegation from parent zone
  const delegationResult = await client.removeNSDelegation(parentZone, label);
  if (!delegationResult.success && delegationResult.status !== 404) {
    return { success: false, error: `Failed to remove NS delegation: ${delegationResult.error}` };
  }

  // Step 2: Delete the subdomain zone
  const deleteResult = await client.deleteZone(fqdn);
  if (!deleteResult.success && deleteResult.status !== 404) {
    return { success: false, error: `Failed to delete zone: ${deleteResult.error}` };
  }

  return { success: true };
}
