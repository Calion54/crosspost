import type { Page } from 'playwright';
import type { RegistryEntry } from '../registry/selector-registry.service.js';

export interface PublishResult {
  externalId: string;
  externalUrl: string;
}

export interface ListingData {
  title: string;
  description: string;
  price: number;
  category?: string;
  condition?: string;
  color?: string;
  packageSize?: string;
  location?: string;
}

export interface StepContext {
  page: Page;
  listing: ListingData;
  imagePaths: string[];
}

export interface WorkflowStep {
  name: string;
  run(ctx: StepContext): Promise<void>;
}

export interface PlatformPublisher {
  readonly platform: string;
  readonly startUrl: string;
  readonly defaultRegistry: Record<string, RegistryEntry>;
  readonly steps: WorkflowStep[];
  extractResult(page: Page): Promise<PublishResult>;
}
