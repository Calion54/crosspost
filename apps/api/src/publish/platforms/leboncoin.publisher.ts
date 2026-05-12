import type { Page } from 'playwright';
import type { PlatformPublisher, PublishResult } from './platform-publisher.js';

export class LeboncoinPublisher implements PlatformPublisher {
  readonly platform = 'leboncoin';

  getStartUrl(): string {
    return 'https://www.leboncoin.fr/deposer-une-annonce';
  }

  getSystemPrompt(): string {
    return `Tu es un agent d'automatisation web. Tu remplis un formulaire de dépôt d'annonce sur Leboncoin.

À chaque tour, tu reçois l'état actuel de la page. Exécute les actions nécessaires, puis le système te renverra automatiquement le nouvel état de la page au tour suivant.

Règles :
- SÉLECTEURS CSS : utilise TOUJOURS [id="..."] pour les IDs (les IDs Leboncoin contiennent des ":" invalides avec #). Utilise aussi name, data-*, aria-label, type, role. JAMAIS de classes CSS.
- N'invente PAS de sélecteurs — utilise UNIQUEMENT ce qui est visible dans le page state.
- Pour cliquer sur un bouton/lien/radio par son texte visible, utilise click_text au lieu de click avec un sélecteur CSS. C'est plus fiable, surtout pour les radios et checkboxes (les inputs natifs sont cachés derrière des overlays).
- DROPDOWNS : si un élément a role="combobox", un toggle-button, ou aria-expanded → c'est un dropdown. JAMAIS de fill dessus. Utilise click pour ouvrir, puis au tour suivant tu verras les options et tu pourras cliquer la bonne. Si la valeur cherchée n'existe pas dans les options, PASSE au champ suivant.
- fill est UNIQUEMENT pour les vrais champs texte (input[type="text"], textarea, input sans role spécial).
- CHAMPS OPTIONNELS : si un champ n'a PAS de donnée correspondante, NE LE TOUCHE PAS. Passe au bouton "Continuer"/"Suivant".
- Si un champ a déjà la bonne valeur (visible dans value="..."), ne le re-remplis pas.
- Formulaire multi-étapes : remplis les champs visibles, puis clique "Continuer"/"Suivant"/"Valider".
- Quand tu vois "Déposer mon annonce" ou "Publier", clique dessus puis appelle done.
- Pour l'upload d'images, utilise upload_images sur l'input[type=file].
- PRIX : tape le prix tel quel en euros (si price=10, tape "10", PAS "1000").
- ADRESSE/LOCALISATION : après un fill, utilise wait_for pour attendre les suggestions [role="option"], puis au tour suivant clique la bonne suggestion.
- Quand tu arrives sur une page de confirmation (plus sur le formulaire de dépôt), appelle done.`;
  }

  async extractResult(page: Page): Promise<PublishResult> {
    // Wait for navigation away from the deposit form
    try {
      await page.waitForURL(
        (url) => !url.pathname.includes('deposer-une-annonce'),
        { timeout: 20_000 },
      );
    } catch {
      await new Promise((r) => setTimeout(r, 4000));
    }

    const currentUrl = page.url();

    if (currentUrl.includes('deposer-une-annonce')) {
      throw new Error(
        'Publication non soumise — toujours sur le formulaire de dépôt',
      );
    }

    // Try to extract ad ID from URL
    const adMatch = currentUrl.match(/\/ad\/[^/]+\/(\d+)/);
    if (adMatch) {
      return { externalId: adMatch[1], externalUrl: currentUrl };
    }

    // Try to find the ad URL on the confirmation page
    const adUrl = await page.evaluate(() => {
      const link = document.querySelector(
        'a[href*="/ad/"]',
      ) as HTMLAnchorElement;
      return link?.href || '';
    });
    if (adUrl) {
      const match = adUrl.match(/\/ad\/[^/]+\/(\d+)/);
      return { externalId: match?.[1] || 'unknown', externalUrl: adUrl };
    }

    // Fallback: check __NEXT_DATA__
    const externalId = await page.evaluate(() => {
      try {
        const script = document.querySelector('#__NEXT_DATA__');
        if (!script) return '';
        const data = JSON.parse(script.textContent || '');
        return data?.props?.pageProps?.adId?.toString() || '';
      } catch {
        return '';
      }
    });
    if (externalId) {
      return { externalId, externalUrl: currentUrl };
    }

    return { externalId: 'unknown', externalUrl: currentUrl };
  }
}
