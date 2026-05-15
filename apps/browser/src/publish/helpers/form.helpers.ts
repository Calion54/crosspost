import { Logger } from '@nestjs/common';
import type { Page, Locator } from 'playwright';
import type { SelectorRegistryService } from '../registry/selector-registry.service.js';
import { humanDelay, humanType } from './page.helpers.js';

const logger = new Logger('FormHelpers');

export type StepStatus = 'success' | 'repaired' | 'skipped' | 'failed';

export interface StepResult {
  field: string;
  status: StepStatus;
  detail?: string;
}

export interface FormContext {
  page: Page;
  platform: string;
  registry: SelectorRegistryService;
}

async function resolveField(
  ctx: FormContext,
  fieldName: string,
  semanticHint: string,
  { allowHidden = false } = {},
): Promise<{ locator: Locator; repaired: boolean } | null> {
  const locator = await ctx.registry.resolve(ctx.page, ctx.platform, fieldName, { allowHidden });
  if (locator) {
    return { locator, repaired: false };
  }
  logger.warn(`[form] Registry miss for "${fieldName}" — field not found`);
  return null;
}

export async function fillField(
  ctx: FormContext,
  fieldName: string,
  value: string,
  semanticHint: string,
): Promise<StepResult> {
  if (!value) return { field: fieldName, status: 'skipped', detail: 'empty value' };

  const resolved = await resolveField(ctx, fieldName, semanticHint);
  if (!resolved) return { field: fieldName, status: 'failed', detail: 'field not found' };

  try {
    await resolved.locator.scrollIntoViewIfNeeded();
    await humanDelay(200, 400);
    await resolved.locator.click();
    await humanDelay(300, 600);
    await ctx.page.keyboard.press('Meta+a');
    await humanDelay(100, 200);
    await ctx.page.keyboard.press('Backspace');
    await humanDelay(100, 200);
    await humanType(ctx.page, value);
    await humanDelay(800, 1500);

    logger.debug(`[form] Filled "${fieldName}" with "${value.substring(0, 50)}"`);
    return { field: fieldName, status: resolved.repaired ? 'repaired' : 'success' };
  } catch (err: any) {
    return { field: fieldName, status: 'failed', detail: err.message };
  }
}

export async function fillAutocomplete(
  ctx: FormContext,
  fieldName: string,
  value: string,
  semanticHint: string,
): Promise<StepResult> {
  if (!value) return { field: fieldName, status: 'skipped', detail: 'empty value' };

  const resolved = await resolveField(ctx, fieldName, semanticHint);
  if (!resolved) return { field: fieldName, status: 'failed', detail: 'field not found' };

  try {
    await resolved.locator.scrollIntoViewIfNeeded();
    await humanDelay(200, 400);
    await resolved.locator.click();
    await humanDelay(300, 500);
    await ctx.page.keyboard.press('Meta+a');
    await humanDelay(100, 200);
    await ctx.page.keyboard.press('Backspace');
    await humanDelay(200, 400);
    await humanType(ctx.page, value);
    await humanDelay(1000, 2000);

    try {
      await ctx.page.waitForSelector(
        '[role="listbox"][data-state="open"] [role="option"], [role="option"]:visible',
        { timeout: 5000, state: 'attached' },
      );
      await humanDelay(800, 1200);

      const allOptions = ctx.page.locator('[role="option"]');
      const optionCount = await allOptions.count();
      let clicked = false;

      for (let i = 0; i < optionCount; i++) {
        const text = (await allOptions.nth(i).textContent())?.trim();
        if (text === value) {
          await allOptions.nth(i).click({ force: true });
          clicked = true;
          break;
        }
      }

      if (!clicked) {
        const partial = allOptions.filter({ hasText: value }).first();
        if (await partial.count() > 0) {
          await partial.click({ force: true });
          clicked = true;
        }
      }

      if (!clicked) {
        const firstOption = ctx.page.locator('[role="option"]:not([aria-disabled="true"])').first();
        if (await firstOption.count()) {
          await firstOption.click({ force: true });
        }
      }
      await humanDelay(800, 1500);
    } catch {
      logger.warn(`[form] No autocomplete options appeared for "${fieldName}"`);
    }

    return { field: fieldName, status: resolved.repaired ? 'repaired' : 'success' };
  } catch (err: any) {
    return { field: fieldName, status: 'failed', detail: err.message };
  }
}

export async function clickButton(
  ctx: FormContext,
  fieldName: string,
  semanticHint: string,
): Promise<StepResult> {
  const resolved = await resolveField(ctx, fieldName, semanticHint);
  if (!resolved) return { field: fieldName, status: 'failed', detail: 'button not found' };

  try {
    await resolved.locator.scrollIntoViewIfNeeded();
    await humanDelay(200, 400);
    await resolved.locator.click({ timeout: 5000 });
    await humanDelay(1500, 3000);
    return { field: fieldName, status: resolved.repaired ? 'repaired' : 'success' };
  } catch (err: any) {
    return { field: fieldName, status: 'failed', detail: err.message };
  }
}

export async function clickText(page: Page, text: string, exact = true): Promise<StepResult> {
  try {
    const locator = page.getByText(text, { exact });
    await locator.first().waitFor({ state: 'visible', timeout: 5000 });
    await locator.first().scrollIntoViewIfNeeded();
    await humanDelay(200, 400);
    await locator.first().click({ timeout: 5000 });
    await humanDelay(1500, 3000);
    return { field: text, status: 'success' };
  } catch (err: any) {
    return { field: text, status: 'failed', detail: err.message };
  }
}

export async function clickInModal(page: Page, text: string, exact = true): Promise<StepResult> {
  try {
    const modal = page.locator('[role="dialog"]');
    const locator = modal.getByText(text, { exact });
    await locator.first().waitFor({ state: 'visible', timeout: 5000 });
    await locator.first().scrollIntoViewIfNeeded();
    await humanDelay(200, 400);
    await locator.first().click({ timeout: 5000 });
    await humanDelay(1500, 3000);
    return { field: text, status: 'success' };
  } catch (err: any) {
    return { field: text, status: 'failed', detail: err.message };
  }
}

export async function uploadImages(
  ctx: FormContext,
  fieldName: string,
  imagePaths: string[],
  semanticHint: string,
): Promise<StepResult> {
  if (imagePaths.length === 0) return { field: fieldName, status: 'skipped', detail: 'no images' };

  const resolved = await resolveField(ctx, fieldName, semanticHint, { allowHidden: true });
  if (!resolved) return { field: fieldName, status: 'failed', detail: 'file input not found' };

  try {
    await resolved.locator.setInputFiles(imagePaths);
    await humanDelay(5000, 8000);
    return {
      field: fieldName,
      status: resolved.repaired ? 'repaired' : 'success',
      detail: `${imagePaths.length} images uploaded`,
    };
  } catch (err: any) {
    return { field: fieldName, status: 'failed', detail: err.message };
  }
}
