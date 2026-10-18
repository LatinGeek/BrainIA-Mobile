import type { V2QueuedRevision } from '../../../../lib/domain';

/** Resolved per request so a provisioned credential can be rotated in place. */
export type V2AccessToken = string | (() => string | null | Promise<string | null>);

export type V2Transport = {
  request(method: 'GET' | 'POST' | 'PUT', path: string, body?: unknown): Promise<{ status: number; value: unknown }>;
  deliverRevision(revision: V2QueuedRevision): Promise<V2QueuedRevision>;
};
export function createV2Transport(baseUrl: string, accessToken?: V2AccessToken, fetcher?: (...args: any[]) => Promise<any>): V2Transport;
export function parseStrict(text: string): unknown;
