import { Logger } from '@nestjs/common';
import type { Page } from 'playwright';
import type Anthropic from '@anthropic-ai/sdk';
import type { LlmService } from '../common/llm/llm.service.js';
import type { ScrapeDebugService } from '../common/debug/scrape-debug.service.js';

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'fill',
    description: 'Clear an input/textarea and type new text.',
    input_schema: {
      type: 'object' as const,
      properties: {
        selector: { type: 'string', description: 'CSS selector' },
        value: { type: 'string', description: 'Text to type' },
      },
      required: ['selector', 'value'],
    },
  },
  {
    name: 'click',
    description: 'Click on an element by CSS selector.',
    input_schema: {
      type: 'object' as const,
      properties: {
        selector: { type: 'string', description: 'CSS selector' },
      },
      required: ['selector'],
    },
  },
  {
    name: 'click_text',
    description: 'Click an element by its visible text. Useful for buttons, links, and menu items.',
    input_schema: {
      type: 'object' as const,
      properties: {
        text: { type: 'string', description: 'Exact or partial visible text of the element to click' },
        exact: { type: 'boolean', description: 'If true, match the full text exactly (default: false)' },
      },
      required: ['text'],
    },
  },
  {
    name: 'select_option',
    description: 'Select an option in a native <select> element.',
    input_schema: {
      type: 'object' as const,
      properties: {
        selector: { type: 'string', description: 'CSS selector for the <select>' },
        value: { type: 'string', description: 'Option value to select' },
      },
      required: ['selector', 'value'],
    },
  },
  {
    name: 'upload_images',
    description: 'Upload all listing images to a file input. Only call once.',
    input_schema: {
      type: 'object' as const,
      properties: {
        selector: { type: 'string', description: 'CSS selector for input[type=file]' },
      },
      required: ['selector'],
    },
  },
  {
    name: 'wait_for',
    description: 'Wait for an element to appear (max 5s). Useful after typing in an autocomplete field.',
    input_schema: {
      type: 'object' as const,
      properties: {
        selector: { type: 'string', description: 'CSS selector to wait for' },
      },
      required: ['selector'],
    },
  },
  {
    name: 'done',
    description: 'Signal that the form has been submitted.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
];

export interface AgentContext {
  page: Page;
  imagePaths: string[];
  listingData: Record<string, unknown>;
  imageCount: number;
  systemPrompt: string;
  scrapeDebug?: ScrapeDebugService;
  platform?: string;
  onStep?: (step: string) => void;
}

export class BrowserAgent {
  private readonly logger = new Logger(BrowserAgent.name);

  constructor(private readonly llm: LlmService) {}

  async run(ctx: AgentContext): Promise<void> {
    const MAX_TURNS = 30;
    let imagesUploaded = false;
    let snapshotCount = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Capture initial page state
    let lastPageState = await this.capturePageState(ctx.page);
    await this.saveSnapshot(ctx, snapshotCount++, lastPageState);

    const listingInfo = `Données de l'annonce :\n${JSON.stringify(ctx.listingData, null, 2)}\n\nImages : ${ctx.imageCount} photo(s) à uploader.`;
    const actionLog: string[] = [];

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      let content = `${listingInfo}\n\nÉtat actuel de la page :\n${lastPageState}`;
      if (actionLog.length > 0) {
        content += `\n\nHistorique des actions :\n${actionLog.join('\n')}`;
      }

      const messages: Anthropic.MessageParam[] = [
        { role: 'user', content },
      ];

      const response = await this.llm.createMessage({
        system: ctx.systemPrompt,
        tools: TOOLS,
        messages,
      });

      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;

      const toolNames = response.content
        .filter((b) => b.type === 'tool_use')
        .map((b) => b.name);
      this.logger.debug(
        `[agent] Turn ${turn + 1} — in: ${response.usage.input_tokens}, out: ${response.usage.output_tokens}, cumul: ${totalInputTokens}+${totalOutputTokens}=${totalInputTokens + totalOutputTokens} — tools: ${toolNames.join(', ') || 'none'}`,
      );

      if (response.stop_reason === 'end_turn') {
        this.logger.debug('[agent] LLM ended turn — done');
        break;
      }

      let isDone = false;

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;

        const input = block.input as Record<string, string>;
        this.logger.debug(`[agent] → ${block.name} ${JSON.stringify(input)}`);

        const result = await this.executeTool(ctx, block.name, input, imagesUploaded);

        actionLog.push(`${block.name}(${Object.values(input).join(', ')}): ${result.output}`);

        if (block.name === 'upload_images' && result.success) {
          imagesUploaded = true;
        }
        if (block.name === 'done') {
          isDone = true;
        }

        if (block.name !== 'done') {
          await this.saveSnapshot(ctx, snapshotCount++, result.output);
        }

        ctx.onStep?.(block.name);
      }

      // Wait for page to settle before capturing state
      try {
        await ctx.page.waitForLoadState('domcontentloaded', { timeout: 5000 });
        await ctx.page.waitForSelector(
          'input, textarea, select, [role="combobox"], [role="option"], h1, h2, h3',
          { timeout: 5000 },
        );
        // Wait for network to settle — catches lazy-loaded form fields
        await ctx.page.waitForLoadState('networkidle', { timeout: 3000 });
      } catch { /* page may legitimately have no form fields */ }

      lastPageState = await this.capturePageState(ctx.page);
      this.logger.debug(`[agent] Page state (${lastPageState.length} chars):\n${lastPageState}`);

      if (isDone) {
        this.logger.debug('[agent] Done signal received');
        break;
      }
    }

    this.logger.log(
      `[agent] Tokens used — input: ${totalInputTokens}, output: ${totalOutputTokens}, total: ${totalInputTokens + totalOutputTokens}`,
    );
  }

  private async executeTool(
    ctx: AgentContext,
    name: string,
    input: Record<string, string>,
    imagesUploaded: boolean,
  ): Promise<{ success: boolean; output: string }> {
    const { page } = ctx;

    try {
      switch (name) {
        case 'fill': {
          await page.waitForSelector(input.selector, { state: 'visible', timeout: 5000 });
          const el = await page.$(input.selector);
          if (!el) return { success: false, output: 'Element not found' };
          await el.scrollIntoViewIfNeeded();
          await this.humanDelay(200, 400);
          await el.click();
          await this.humanDelay(300, 600);
          await page.keyboard.press('Meta+a');
          await this.humanDelay(100, 200);
          await page.keyboard.press('Backspace');
          await this.humanDelay(100, 200);
          await this.humanType(page, input.value);
          await this.humanDelay(1500, 2500);
          return { success: true, output: `OK — filled "${input.selector}" with "${input.value.substring(0, 50)}"` };
        }

        case 'click': {
          await page.waitForSelector(input.selector, { state: 'visible', timeout: 5000 });
          const el = await page.$(input.selector);
          if (!el) return { success: false, output: 'Element not found' };
          await el.scrollIntoViewIfNeeded();
          await this.humanDelay(200, 400);
          try {
            await el.click({ timeout: 5000 });
          } catch {
            // Fallback: force click (bypasses overlay interception)
            await el.click({ force: true });
          }
          await this.humanDelay(1500, 3000);
          return { success: true, output: `OK — clicked "${input.selector}"` };
        }

        case 'select_option': {
          await page.selectOption(input.selector, input.value);
          await this.humanDelay(800, 1500);
          return { success: true, output: `OK — selected "${input.value}"` };
        }

        case 'click_text': {
          const locator = input.exact === 'true'
            ? page.getByText(input.text, { exact: true })
            : page.getByText(input.text);
          const el = locator.first();
          await el.waitFor({ state: 'visible', timeout: 5000 });
          await el.scrollIntoViewIfNeeded();
          await this.humanDelay(200, 400);
          await el.click({ timeout: 5000 });
          await this.humanDelay(1500, 3000);
          return { success: true, output: `OK — clicked "${input.text}"` };
        }

        case 'upload_images': {
          if (imagesUploaded) return { success: true, output: 'Images already uploaded' };
          if (ctx.imagePaths.length === 0) return { success: true, output: 'No images to upload' };
          const el = await page.$(input.selector);
          if (!el) return { success: false, output: 'File input not found' };
          await el.setInputFiles(ctx.imagePaths);
          await this.humanDelay(4000, 6000);
          return { success: true, output: `OK — uploaded ${ctx.imagePaths.length} images` };
        }

        case 'wait_for': {
          try {
            await page.waitForSelector(input.selector, { timeout: 5000 });
            return { success: true, output: 'OK — element appeared' };
          } catch {
            return { success: false, output: `Timeout waiting for "${input.selector}"` };
          }
        }

        case 'done': {
          return { success: true, output: 'Task marked as complete' };
        }

        default:
          return { success: false, output: `Unknown tool: ${name}` };
      }
    } catch (err: any) {
      this.logger.warn(`[agent] Tool ${name} failed: ${err.message}`);
      return { success: false, output: err.message };
    }
  }

  private async saveSnapshot(
    ctx: AgentContext,
    index: number,
    _output: string,
  ) {
    if (!ctx.scrapeDebug) return;
    try {
      await ctx.scrapeDebug.captureSnapshot(ctx.page, {
        platform: ctx.platform || 'unknown',
        externalId: `publish_step_${index}`,
        extractedData: { step: index },
        saveFullHtml: index === 0,
      });
    } catch { /* ignore */ }
  }

  private async capturePageState(page: Page): Promise<string> {
    return page.evaluate(() => {
      const result: string[] = [];
      const seen = new Set<Element>();

      function isVisible(el: Element): boolean {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      }

      function attrs(el: Element): string {
        const a: string[] = [];
        for (const name of [
          'type', 'name', 'id', 'placeholder', 'aria-label', 'aria-invalid',
          'data-testid', 'data-qa-id', 'role',
          'required', 'maxlength', 'min', 'max', 'value', 'accept',
          'multiple', 'disabled', 'checked', 'aria-checked', 'aria-selected',
          'aria-expanded', 'href',
        ]) {
          const v = el.getAttribute(name);
          if (v != null && v !== '') a.push(`${name}="${v}"`);
        }
        for (const attr of el.attributes) {
          if (attr.name.startsWith('data-') && !a.some(s => s.startsWith(attr.name + '='))) {
            a.push(`${attr.name}="${attr.value}"`);
          }
        }
        return a.join(' ');
      }

      function getLabel(el: Element): string {
        const labelledBy = el.getAttribute('aria-labelledby');
        if (labelledBy) {
          const lbl = document.getElementById(labelledBy);
          if (lbl) return lbl.textContent?.trim() || '';
        }
        const id = el.getAttribute('id');
        if (id) {
          const lbl = document.querySelector(`label[for="${id}"]`);
          if (lbl) return lbl.textContent?.trim() || '';
        }
        const closestLabel = el.closest('label');
        if (closestLabel) return closestLabel.textContent?.trim() || '';
        const fieldset = el.closest('fieldset');
        if (fieldset) {
          const legend = fieldset.querySelector('legend');
          if (legend) return legend.textContent?.trim() || '';
        }
        const parent = el.parentElement?.closest('[class*="field"], [class*="form"]');
        if (parent) {
          const lbl = parent.querySelector('label, [class*="label"]');
          if (lbl && lbl !== el) return lbl.textContent?.trim() || '';
        }
        return '';
      }

      function isFormRelevant(el: Element): boolean {
        // Skip elements inside site chrome (header, nav, footer)
        if (el.closest('header, nav, footer')) return false;
        // Skip skip-nav / anchor links (e.g. "aller au contenu")
        const href = el.getAttribute('href');
        if (href && href.startsWith('#')) return false;
        // Skip external links (not part of the form)
        if (el.tagName === 'A' && href && !href.startsWith('#') && !el.closest('form, [role="listbox"], [role="dialog"], [role="menu"]')) {
          return false;
        }
        return true;
      }

      function add(el: Element) {
        if (seen.has(el) || !isVisible(el) || !isFormRelevant(el)) return;
        seen.add(el);

        const tag = el.tagName.toLowerCase();
        const a = attrs(el);
        const label = getLabel(el);
        const labelAttr = label ? ` label="${label.substring(0, 100)}"` : '';

        let currentVal = '';
        if ('value' in el) {
          const v = (el as HTMLInputElement).value;
          if (v) currentVal = ` current-value="${v.substring(0, 200)}"`;
        }

        const text = el.textContent?.trim();
        const textAttr =
          tag === 'button' || tag === 'a' || tag === 'div' || tag === 'li'
            ? ` text="${(text || '').substring(0, 120)}"`
            : '';

        let options = '';
        if (tag === 'select') {
          options = Array.from(el.querySelectorAll('option'))
            .slice(0, 40)
            .map(
              (o) =>
                `<option value="${o.getAttribute('value') || ''}">${o.textContent?.trim()}</option>`,
            )
            .join('');
        }

        result.push(
          `<${tag} ${a}${labelAttr}${currentVal}${textAttr}>${options}</${tag}>`,
        );
      }

      document
        .querySelectorAll(
          [
            'input', 'textarea', 'select', 'button', 'a[href]',
            '[role="listbox"]', '[role="combobox"]', '[role="radio"]',
            '[role="radiogroup"]', '[role="checkbox"]', '[role="option"]',
            '[role="menuitem"]', '[role="tab"]', '[role="button"]',
            '[contenteditable="true"]',
          ].join(', '),
        )
        .forEach(add);

      const h1 = document.querySelector('h1, h2, h3');
      if (h1) {
        result.unshift(`<!-- Page: ${h1.textContent?.trim()} -->`);
      }

      return result.join('\n');
    });
  }

  private async humanDelay(minMs: number, maxMs: number) {
    const delay = Math.floor(Math.random() * (maxMs - minMs) + minMs);
    await new Promise((r) => setTimeout(r, delay));
  }

  private async humanType(page: Page, text: string) {
    for (const char of text) {
      await page.keyboard.type(char, {
        delay: Math.floor(Math.random() * 100 + 30),
      });
    }
  }
}
