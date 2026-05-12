import { chromium, type Browser, type Page } from 'playwright';
import { BrowserAgent } from '../browser-agent';
import type { LlmService } from '../../common/llm/llm.service';

// Minimal HTML fixtures that mimic Leboncoin form pages
const TITLE_PAGE = `<!DOCTYPE html><html><body>
<h2>Déposer une annonce</h2>
<a href="#step-title">aller au contenu</a>
<button type="button">Quitter</button>
<input type="text" name="subject" id=":form-field-_r_0_" aria-invalid="false" placeholder="Titre" />
<button type="button">En savoir plus</button>
</body></html>`;

const CATEGORY_PAGE = `<!DOCTYPE html><html><body>
<h2>Déposer une annonce</h2>
<input type="text" name="subject" id=":form-field-_r_0_" value="cruche ricard 1l" />
<div aria-label="Choix 1 : catégorie Arts de la table dans la famille Maison &amp; Jardin" role="button">
  Maison &amp; Jardin &gt; Arts de la table
</div>
<button type="button" id=":radio-input-_r_7_" role="presentation" value="45" aria-checked="false">radio</button>
<input type="radio" value="45" />
<div aria-label="Choix 2 : catégorie Collection dans la famille Loisirs" role="button">
  Loisirs &gt; Collection
</div>
<input type="radio" value="40" />
<button type="button">Choisissez</button>
</body></html>`;

const BRAND_EMPTY_PAGE = `<!DOCTYPE html><html><body>
<h2>Dites-nous en plus</h2>
<input type="text" id=":form-field-_r_3p_" role="combobox" value="Ricard"
       aria-expanded="true" placeholder="Choisissez" />
<button type="button" id=":form-field-_r_3p_-toggle-button" aria-label="Fermer la liste" aria-expanded="true">toggle</button>
<ul id=":form-field-_r_3p_-menu" role="listbox"></ul>
<input type="text" id=":form-field-_r_5h_" role="combobox" placeholder="Choisissez"
       aria-expanded="false" />
<button type="submit">Continuer</button>
</body></html>`;

const BRAND_WITH_OPTIONS_PAGE = `<!DOCTYPE html><html><body>
<h2>Dites-nous en plus</h2>
<input type="text" id=":form-field-_r_3p_" role="combobox" value="Atmo"
       aria-expanded="true" placeholder="Choisissez" />
<ul id=":form-field-_r_3p_-menu" role="listbox">
  <li role="option" id=":form-field-_r_3p_-item-49">Atmosphera</li>
</ul>
<button type="submit">Continuer</button>
</body></html>`;

describe('BrowserAgent — capturePageState', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    const context = await browser.newContext();
    page = await context.newPage();
  });

  afterEach(async () => {
    await page.context().close();
  });

  async function getPageState(html: string): Promise<string> {
    await page.setContent(html);
    // Access the private method via prototype
    const agent = new BrowserAgent({} as LlmService);
    return (agent as any).capturePageState(page);
  }

  it('captures title input with label', async () => {
    const state = await getPageState(TITLE_PAGE);
    expect(state).toContain('name="subject"');
    expect(state).toContain('id=":form-field-_r_0_"');
  });

  it('captures page heading', async () => {
    const state = await getPageState(TITLE_PAGE);
    expect(state).toContain('<!-- Page: Déposer une annonce -->');
  });

  it('captures category radio buttons with aria-label', async () => {
    const state = await getPageState(CATEGORY_PAGE);
    expect(state).toContain('Arts de la table');
    expect(state).toContain('role="button"');
    expect(state).toContain('Collection');
  });

  it('captures combobox with role and aria-expanded', async () => {
    const state = await getPageState(BRAND_EMPTY_PAGE);
    expect(state).toContain('role="combobox"');
    expect(state).toContain('aria-expanded="true"');
  });

  it('captures listbox options when present', async () => {
    const state = await getPageState(BRAND_WITH_OPTIONS_PAGE);
    expect(state).toContain('role="option"');
    expect(state).toContain('Atmosphera');
  });

  it('captures empty listbox (no options)', async () => {
    const state = await getPageState(BRAND_EMPTY_PAGE);
    expect(state).toContain('role="listbox"');
    // Should NOT contain any role="option" since listbox is empty
    expect(state).not.toContain('role="option"');
  });

  it('captures submit button', async () => {
    const state = await getPageState(BRAND_EMPTY_PAGE);
    expect(state).toContain('type="submit"');
    expect(state).toContain('Continuer');
  });

  it('captures current-value for filled inputs', async () => {
    const state = await getPageState(CATEGORY_PAGE);
    expect(state).toContain('current-value="cruche ricard 1l"');
  });

  it('excludes skip-nav links', async () => {
    const state = await getPageState(TITLE_PAGE);
    expect(state).not.toContain('aller au contenu');
    expect(state).not.toContain('#step-title');
  });

  it('excludes header/nav/footer elements', async () => {
    const html = `<!DOCTYPE html><html><body>
      <header><a href="/home">Home</a><button type="button">Menu</button></header>
      <nav><a href="/about">About</a></nav>
      <main><input type="text" name="title" placeholder="Title" /></main>
      <footer><a href="/legal">Legal</a><button type="button">Cookies</button></footer>
    </body></html>`;
    const state = await getPageState(html);
    expect(state).toContain('name="title"');
    expect(state).not.toContain('Home');
    expect(state).not.toContain('About');
    expect(state).not.toContain('Legal');
    expect(state).not.toContain('Cookies');
    expect(state).not.toContain('Menu');
  });

  it('excludes standalone links not in a form context', async () => {
    const html = `<!DOCTYPE html><html><body>
      <a href="/other-page">Some link</a>
      <form><input type="text" name="field" /><button type="submit">Submit</button></form>
      <a href="/another">Another link</a>
    </body></html>`;
    const state = await getPageState(html);
    expect(state).toContain('name="field"');
    expect(state).not.toContain('Some link');
    expect(state).not.toContain('Another link');
  });

  it('keeps links inside listbox/dialog', async () => {
    const html = `<!DOCTYPE html><html><body>
      <div role="listbox"><a href="/option1">Option 1</a></div>
      <input type="text" name="field" />
    </body></html>`;
    const state = await getPageState(html);
    expect(state).toContain('Option 1');
  });
});

