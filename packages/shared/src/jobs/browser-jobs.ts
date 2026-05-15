import type { ListingCondition } from '../enums/listing-condition.enum';

export const BROWSER_QUEUE = 'browser';

export enum BrowserJobName {
  CONNECT = 'connect',
  SYNC = 'sync',
  CHECK_SESSION = 'check-session',
  LOGOUT = 'logout',
  PUBLISH = 'publish',
}

// ─── Connect ─────────────────────────────────────────────────

export interface ConnectJobData {
  platform: string;
  loginUrl: string;
  authCookie: string;
}

export interface ConnectJobProgress {
  status: 'browser_ready' | 'waiting_for_login';
  vncUrl?: string;
  vncToken?: string;
  wsPort?: number;
}

export interface ConnectJobResult {
  cookies: Record<string, unknown>[];
  userAgent: string;
  email: string;
}

// ─── Sync ────────────────────────────────────────────────────

export interface SyncJobData {
  platform: string;
  cookies: Record<string, unknown>[];
  userAgent?: string;
}

export interface ScrapedListing {
  externalId: string;
  externalUrl: string;
  title: string;
  description: string;
  price: number;
  category: string;
  condition: ListingCondition;
  brand?: string;
  location?: string;
  imageUrls: string[];
}

export interface SyncJobResult {
  listings: ScrapedListing[];
}

// ─── Check Session ───────────────────────────────────────────

export interface CheckSessionJobData {
  cookies: Record<string, unknown>[];
  userAgent?: string;
  checkUrl: string;
}

export interface CheckSessionJobResult {
  isValid: boolean;
}

// ─── Logout ──────────────────────────────────────────────────

export interface LogoutJobData {
  cookies: Record<string, unknown>[];
  userAgent?: string;
  logoutUrl: string;
}

export interface LogoutJobResult {
  ok: boolean;
}

// ─── Publish ─────────────────────────────────────────────────

export interface PublishJobData {
  platform: string;
  cookies: Record<string, unknown>[];
  userAgent?: string;
  accountId: string;
  listing: {
    title: string;
    description: string;
    price: number;
    category?: string;
    condition?: string;
    color?: string;
    packageSize?: string;
    location?: string;
  };
  imageUrls: string[]; // presigned S3 URLs
}

export interface PublishJobProgress {
  step: string;
}

export interface PublishJobResult {
  externalId: string;
  externalUrl: string;
}
