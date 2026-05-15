import type { Page } from 'playwright';
import type { RegistryEntry } from '../../registry/selector-registry.service.js';
import type {
  PlatformPublisher,
  PublishResult,
  WorkflowStep,
  StepContext,
} from '../platform-publisher.js';
import {
  fillField,
  fillAutocomplete,
  clickButton,
  clickText,
  clickInModal,
  uploadImages,
  type FormContext,
} from '../../helpers/form.helpers.js';
import { waitForPageSettle, humanDelay } from '../../helpers/page.helpers.js';
import type { SelectorRegistryService } from '../../registry/selector-registry.service.js';

function makeFormCtx(
  ctx: StepContext,
  registry: SelectorRegistryService,
): FormContext {
  return { page: ctx.page, platform: 'leboncoin', registry };
}

export class LeboncoinPublisher implements PlatformPublisher {
  readonly platform = 'leboncoin';
  readonly startUrl = 'https://www.leboncoin.fr/deposer-une-annonce';

  constructor(private registry: SelectorRegistryService) {}

  readonly defaultRegistry: Record<string, RegistryEntry> = {
    title: {
      strategies: [
        { type: 'name', value: 'subject' },
        { type: 'label', value: "titre de l'annonce" },
      ],
    },
    body: {
      strategies: [
        { type: 'name', value: 'body' },
        { type: 'label', value: 'description' },
        { type: 'css', value: 'textarea' },
      ],
    },
    price: {
      strategies: [
        { type: 'name', value: 'price' },
        { type: 'label', value: 'prix' },
      ],
    },
    category: {
      strategies: [
        { type: 'label', value: 'catégorie' },
        { type: 'role', value: 'catégorie', roleType: 'combobox' },
      ],
    },
    condition: {
      strategies: [
        { type: 'label', value: 'État' },
        { type: 'css', value: 'input[data-spark-component="combobox-input"]' },
      ],
    },
    location: {
      strategies: [
        { type: 'placeholder', value: 'Adresse' },
        { type: 'label', value: 'adresse' },
      ],
    },
    categoryRadio: {
      strategies: [
        { type: 'css', value: '[data-spark-component="radio-label"]' },
      ],
    },
    imageInput: {
      strategies: [
        { type: 'css', value: 'input[type="file"][accept*="image"]' },
        { type: 'css', value: 'input[type="file"]' },
      ],
    },
    packageSizeEdit: {
      strategies: [
        { type: 'css', value: ':has(> div:has-text("Colis")) button[aria-label="Modifier"]' },
      ],
    },
    continueButton: {
      strategies: [
        { type: 'text', value: 'Continuer' },
        { type: 'text', value: 'Suivant' },
        { type: 'text', value: 'Valider' },
      ],
    },
    submitButton: {
      strategies: [
        { type: 'text', value: 'Déposer mon annonce' },
        { type: 'text', value: 'Publier' },
      ],
    },
  };

  get steps(): WorkflowStep[] {
    return [
      { name: 'fill_title', run: (ctx) => this.fillTitle(ctx) },
      { name: 'select_category', run: (ctx) => this.selectCategory(ctx) },
      { name: 'upload_images', run: (ctx) => this.uploadImages(ctx) },
      { name: 'click_continue_photos', run: (ctx) => this.clickContinue(ctx) },
      { name: 'fill_details', run: (ctx) => this.fillDetails(ctx) },
      { name: 'click_continue_details', run: (ctx) => this.clickContinue(ctx) },
      { name: 'fill_body', run: (ctx) => this.fillBody(ctx) },
      { name: 'click_continue_desc', run: (ctx) => this.clickContinue(ctx) },
      { name: 'fill_price', run: (ctx) => this.fillPrice(ctx) },
      { name: 'click_continue_price', run: (ctx) => this.clickContinue(ctx) },
      { name: 'fill_location', run: (ctx) => this.fillLocation(ctx) },
      { name: 'select_package_size', run: (ctx) => this.selectPackageSize(ctx) },
      { name: 'click_continue_location', run: (ctx) => this.clickContinue(ctx) },
      { name: 'submit', run: (ctx) => this.submit(ctx) },
    ];
  }

  private fctx(ctx: StepContext): FormContext {
    return makeFormCtx(ctx, this.registry);
  }

  private async fillTitle(ctx: StepContext) {
    await fillField(this.fctx(ctx), 'title', ctx.listing.title, "Titre de l'annonce");
    await humanDelay(2000, 3000);
  }

  private async selectCategory(ctx: StepContext) {
    const result = await clickButton(this.fctx(ctx), 'categoryRadio', 'Suggestion de catégorie');
    if (result.status === 'success') {
      await humanDelay(1500, 2500);
      await waitForPageSettle(ctx.page);
    }
  }

  private async clickContinue(ctx: StepContext) {
    for (const text of ['Continuer', 'Suivant', 'Valider']) {
      const result = await clickText(ctx.page, text);
      if (result.status === 'success') {
        await waitForPageSettle(ctx.page);
        return;
      }
    }
  }

  private async fillDetails(ctx: StepContext) {
    const fctx = this.fctx(ctx);
    if (ctx.listing.condition) {
      const conditionLabels: Record<string, string> = {
        new_with_tags: 'Neuf avec étiquette',
        new_without_tags: 'Neuf sans étiquette',
        very_good: 'Très bon état',
        good: 'Bon état',
        fair: 'État satisfaisant',
      };
      const searchText = conditionLabels[ctx.listing.condition] || ctx.listing.condition;
      await fillAutocomplete(fctx, 'condition', searchText, 'État du produit');
    }
  }

  private async fillBody(ctx: StepContext) {
    await fillField(this.fctx(ctx), 'body', ctx.listing.description, "Description de l'annonce");
  }

  private async fillPrice(ctx: StepContext) {
    await fillField(this.fctx(ctx), 'price', String(ctx.listing.price), 'Prix en euros');
  }

  private async fillLocation(ctx: StepContext) {
    if (!ctx.listing.location) return;
    await fillAutocomplete(this.fctx(ctx), 'location', ctx.listing.location, 'Adresse ou ville');
    await waitForPageSettle(ctx.page);
  }

  private async uploadImages(ctx: StepContext) {
    if (ctx.imagePaths.length === 0) return;
    await uploadImages(this.fctx(ctx), 'imageInput', ctx.imagePaths, 'Input de téléchargement de photos');
  }

  private async selectPackageSize(ctx: StepContext) {
    if (!ctx.listing.packageSize) return;
    const formatMap: Record<string, string> = { S: 'Petit', M: 'Moyen', L: 'Volumineux' };
    const formatText = formatMap[ctx.listing.packageSize];
    if (!formatText) return;

    try {
      const editResult = await clickButton(this.fctx(ctx), 'packageSizeEdit', 'Modifier taille colis');
      if (editResult.status !== 'success') return;
      await waitForPageSettle(ctx.page);

      const formatResult = await clickInModal(ctx.page, formatText);
      if (formatResult.status !== 'success') return;
      await clickInModal(ctx.page, 'Continuer');
      await waitForPageSettle(ctx.page);

      try {
        const modal = ctx.page.locator('[role="dialog"]');
        const weightOption = modal.locator('[data-spark-component="radio-label"]').first();
        if (await weightOption.count() > 0) {
          await weightOption.click();
          await humanDelay(500, 800);
        }
      } catch {}

      for (const text of ['Valider', 'Continuer', 'Confirmer']) {
        const result = await clickInModal(ctx.page, text);
        if (result.status === 'success') break;
      }
    } catch {}
  }

  private capturedAdId: string | null = null;

  private async submit(ctx: StepContext) {
    const { page } = ctx;
    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/') && resp.request().method() === 'POST' && resp.status() < 400,
      { timeout: 30_000 },
    ).catch(() => null);

    for (const text of ['Déposer sans booster mon annonce', 'Déposer mon annonce', 'Publier']) {
      const result = await clickText(page, text);
      if (result.status === 'success') {
        try {
          const response = await responsePromise;
          if (response) {
            const body = await response.json().catch(() => null);
            const adId = body?.id || body?.ad_id || body?.adId || body?.list_id;
            if (adId) this.capturedAdId = String(adId);
          }
        } catch {}
        await humanDelay(3000, 5000);
        return;
      }
    }
    throw new Error('Submit button not found');
  }

  async extractResult(page: Page): Promise<PublishResult> {
    if (this.capturedAdId) {
      const adId = this.capturedAdId;
      this.capturedAdId = null;
      return { externalId: adId, externalUrl: `https://www.leboncoin.fr/ad/${adId}` };
    }
    const currentUrl = page.url();
    const adMatch = currentUrl.match(/\/ad\/[^/]+\/(\d+)/);
    if (adMatch) return { externalId: adMatch[1], externalUrl: currentUrl };
    return { externalId: 'unknown', externalUrl: currentUrl };
  }
}
