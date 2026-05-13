import { Injectable, Logger } from '@nestjs/common';
import type { Page, Locator } from 'playwright';
import { LlmService } from '../../common/llm/llm.service.js';
import {
  SelectorRegistryService,
  type SelectorStrategy,
} from '../registry/selector-registry.service.js';
import { capturePageState } from '../helpers/page.helpers.js';

const SYSTEM_PROMPT = `You are a DOM analysis assistant. Given the current page state (a list of visible HTML elements) and a field description, find the best CSS selector or locator strategy for that field.

Respond ONLY in valid JSON, no markdown, no explanation:
{
  "found": true,
  "strategies": [
    { "type": "name", "value": "subject" },
    { "type": "label", "value": "Titre de l'annonce" },
    { "type": "css", "value": "[data-spark-component='input']" }
  ]
}

Strategy types: "label", "role" (with roleType), "name", "css", "text", "testid", "placeholder".
For "role" type, include "roleType" (e.g. "textbox", "button", "combobox").

If you cannot find the field, respond: { "found": false, "strategies": [] }

Rules:
- Prefer stable attributes: name, aria-label, data-testid, role, placeholder
- NEVER use dynamic IDs (containing random characters like ":form-field-_r_0_")
- NEVER use class-based selectors
- Return 2-3 strategies ordered from most stable to least stable
- The field MUST be present in the page state provided`;

export interface SentinelResult {
  locator: Locator;
  strategies: SelectorStrategy[];
}

@Injectable()
export class SentinelService {
  private readonly logger = new Logger(SentinelService.name);

  constructor(
    private llm: LlmService,
    private registry: SelectorRegistryService,
  ) {}

  async recoverField(
    page: Page,
    platform: string,
    fieldName: string,
    semanticHint: string,
  ): Promise<SentinelResult | null> {
    const pageState = await capturePageState(page);

    const userMessage = `Page state:\n${pageState}\n\nFind the field: "${semanticHint}" (internal name: "${fieldName}")`;

    try {
      const response = await this.llm.createMessage({
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
        maxTokens: 256,
      });

      const text =
        response.content[0].type === 'text' ? response.content[0].text : '';
      // Strip markdown fences and extract the JSON object
      let cleaned = text.replace(/```(?:json)?\s*/g, '').replace(/```/g, '').trim();
      // Extract first JSON object if there's trailing text
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logger.warn(`[sentinel] No JSON found in response for "${fieldName}"`);
        return null;
      }
      const parsed = JSON.parse(jsonMatch[0]);

      if (!parsed.found || !parsed.strategies?.length) {
        this.logger.warn(`[sentinel] Could not find "${fieldName}" on page`);
        return null;
      }

      const strategies: SelectorStrategy[] = parsed.strategies;

      // Try each strategy to verify it actually works
      for (const strategy of strategies) {
        const locator = this.toLocator(page, strategy);
        try {
          const count = await locator.count();
          if (count > 0 && (await locator.first().isVisible())) {
            // Found! Update the registry
            await this.registry.updateField(platform, fieldName, strategies);
            this.logger.log(
              `[sentinel] Repaired "${fieldName}" → ${strategy.type}="${strategy.value}"`,
            );
            return { locator: locator.first(), strategies };
          }
        } catch {
          // Strategy didn't work, try next
        }
      }

      this.logger.warn(`[sentinel] Strategies found for "${fieldName}" but none worked`);
      return null;
    } catch (err: any) {
      this.logger.error(`[sentinel] Error recovering "${fieldName}": ${err.message}`);
      return null;
    }
  }

  private toLocator(page: Page, strategy: SelectorStrategy): Locator {
    switch (strategy.type) {
      case 'label':
        return page.getByLabel(strategy.value);
      case 'role':
        return page.getByRole(strategy.roleType as any, { name: strategy.value });
      case 'name':
        return page.locator(`[name="${strategy.value}"]`);
      case 'css':
        return page.locator(strategy.value);
      case 'text':
        return page.getByText(strategy.value, { exact: true });
      case 'testid':
        return page.getByTestId(strategy.value);
      case 'placeholder':
        return page.getByPlaceholder(strategy.value);
      default:
        return page.locator(strategy.value);
    }
  }
}
