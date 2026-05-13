import { Injectable, Logger } from '@nestjs/common';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import type { Page, Locator } from 'playwright';

export interface SelectorStrategy {
  type: 'label' | 'role' | 'name' | 'css' | 'text' | 'testid' | 'placeholder';
  value: string;
  roleType?: string; // for type: 'role' → 'textbox', 'button', etc.
}

export interface RegistryEntry {
  strategies: SelectorStrategy[];
  lastValidated?: string;
}

type Registry = Record<string, RegistryEntry>;

const DATA_DIR = join(process.cwd(), 'publish-registry');

@Injectable()
export class SelectorRegistryService {
  private readonly logger = new Logger(SelectorRegistryService.name);
  private registries = new Map<string, Registry>();
  private defaults = new Map<string, Registry>();

  registerDefaults(platform: string, defaults: Registry) {
    this.defaults.set(platform, defaults);
  }

  async load(platform: string): Promise<void> {
    const defaults = this.defaults.get(platform) || {};
    const filePath = this.filePath(platform);

    try {
      const raw = await readFile(filePath, 'utf-8');
      const overrides: Registry = JSON.parse(raw);
      // Merge: overrides win over defaults
      this.registries.set(platform, { ...defaults, ...overrides });
      this.logger.log(`[registry] Loaded overrides for ${platform} from ${filePath}`);
    } catch {
      this.registries.set(platform, { ...defaults });
      this.logger.log(`[registry] Using defaults for ${platform} (no overrides file)`);
    }
  }

  async resolve(
    page: Page,
    platform: string,
    fieldName: string,
    { allowHidden = false } = {},
  ): Promise<Locator | null> {
    const registry = this.registries.get(platform);
    if (!registry?.[fieldName]) return null;

    const entry = registry[fieldName];
    for (const strategy of entry.strategies) {
      const locator = this.toLocator(page, strategy);
      try {
        const count = await locator.count();
        if (count > 0 && (allowHidden || await locator.first().isVisible())) {
          entry.lastValidated = new Date().toISOString().split('T')[0];
          return locator.first();
        }
      } catch {
        // Strategy failed, try next
      }
    }

    return null;
  }

  async updateField(
    platform: string,
    fieldName: string,
    strategies: SelectorStrategy[],
  ) {
    const registry = this.registries.get(platform) || {};
    registry[fieldName] = {
      strategies,
      lastValidated: new Date().toISOString().split('T')[0],
    };
    this.registries.set(platform, registry);
    await this.save(platform);
    this.logger.log(`[registry] Updated ${platform}.${fieldName} with ${strategies.length} strategies`);
  }

  getEntry(platform: string, fieldName: string): RegistryEntry | undefined {
    return this.registries.get(platform)?.[fieldName];
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

  private filePath(platform: string): string {
    return join(DATA_DIR, `${platform}.json`);
  }

  private async save(platform: string) {
    const registry = this.registries.get(platform);
    if (!registry) return;

    // Only save entries that differ from defaults
    const defaults = this.defaults.get(platform) || {};
    const overrides: Registry = {};

    for (const [key, entry] of Object.entries(registry)) {
      const defaultEntry = defaults[key];
      if (!defaultEntry || JSON.stringify(entry.strategies) !== JSON.stringify(defaultEntry.strategies)) {
        overrides[key] = entry;
      }
    }

    if (Object.keys(overrides).length === 0) return;

    const filePath = this.filePath(platform);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(overrides, null, 2));
    this.logger.debug(`[registry] Saved overrides for ${platform}`);
  }
}
