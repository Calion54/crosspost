import type { Page } from 'playwright';

export interface PublishResult {
  externalId: string;
  externalUrl: string;
}

export interface PlatformPublisher {
  readonly platform: string;

  /** URL to navigate to before starting the agent */
  getStartUrl(): string;

  /** System prompt for the LLM agent — platform-specific instructions */
  getSystemPrompt(): string;

  /** Extract the publication result after the agent signals done */
  extractResult(page: Page): Promise<PublishResult>;
}
