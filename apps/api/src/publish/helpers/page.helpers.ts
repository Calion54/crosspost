import type { Page } from 'playwright';

export async function humanDelay(minMs: number, maxMs: number) {
  const delay = Math.floor(Math.random() * (maxMs - minMs) + minMs);
  await new Promise((r) => setTimeout(r, delay));
}

export async function humanType(page: Page, text: string) {
  for (const char of text) {
    await page.keyboard.type(char, {
      delay: Math.floor(Math.random() * 100 + 30),
    });
  }
}

export async function waitForPageSettle(page: Page) {
  try {
    await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
    await page.waitForSelector(
      'input, textarea, select, [role="combobox"], h1, h2, h3',
      { timeout: 5000 },
    );
    await page.waitForLoadState('networkidle', { timeout: 3000 });
  } catch {
    // Page may not have form elements
  }
}

export async function capturePageState(page: Page): Promise<string> {
  return page.evaluate(() => {
    const result: string[] = [];
    const seen = new Set<Element>();

    function isVisible(el: Element): boolean {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    }

    function isFormRelevant(el: Element): boolean {
      if (el.closest('header, nav, footer')) return false;
      const href = el.getAttribute('href');
      if (href && href.startsWith('#')) return false;
      if (
        el.tagName === 'A' &&
        href &&
        !href.startsWith('#') &&
        !el.closest('form, [role="listbox"], [role="dialog"], [role="menu"]')
      )
        return false;
      return true;
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
        if (attr.name.startsWith('data-') && !a.some((s) => s.startsWith(attr.name + '='))) {
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
      const parent = el.parentElement?.closest('[class*="field"], [class*="form"]');
      if (parent) {
        const lbl = parent.querySelector('label, [class*="label"]');
        if (lbl && lbl !== el) return lbl.textContent?.trim() || '';
      }
      return '';
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
          .map((o) => `<option value="${o.getAttribute('value') || ''}">${o.textContent?.trim()}</option>`)
          .join('');
      }
      result.push(`<${tag} ${a}${labelAttr}${currentVal}${textAttr}>${options}</${tag}>`);
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
