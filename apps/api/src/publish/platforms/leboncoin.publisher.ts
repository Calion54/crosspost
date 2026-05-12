import type { Page } from 'playwright';
import type { PlatformPublisher, PublishResult } from './platform-publisher.js';

export class LeboncoinPublisher implements PlatformPublisher {
  readonly platform = 'leboncoin';

  getStartUrl(): string {
    return 'https://www.leboncoin.fr/deposer-une-annonce';
  }

  getSystemPrompt(): string {
    return `Tu es un agent d'automatisation web. Tu remplis un formulaire de dépôt d'annonce sur Leboncoin.

À chaque tour, tu reçois l'état actuel de la page (la liste des éléments visibles). Exécute les actions nécessaires, puis le système te renverra automatiquement le nouvel état de la page au tour suivant.

RÈGLE ABSOLUE : n'interagis qu'avec les éléments PRÉSENTS dans le page state. Si un champ n'apparaît pas dans le page state, il n'existe pas encore — NE tente PAS de le remplir. Fais UNE ou DEUX actions par tour maximum, puis attends le prochain état.

Sélecteurs :
- Utilise TOUJOURS [id="..."] pour les IDs (les IDs Leboncoin contiennent des ":" invalides avec #). Utilise aussi [name="..."], [data-*], [aria-label], [role]. JAMAIS de classes CSS.
- N'invente AUCUN sélecteur — copie les attributs EXACTEMENT comme ils apparaissent dans le page state.
- Pour cliquer sur un bouton/lien/radio par son texte visible, utilise click_text (plus fiable que click avec un sélecteur CSS, surtout pour les radios et checkboxes).
- IMPORTANT click_text : quand tu cliques sur une option dans un dropdown (role="option"), utilise TOUJOURS exact=true pour éviter les matchs partiels (ex: "Bon état" matcherait "Très bon état" sans exact).

Formulaire :
- C'est un formulaire MULTI-ÉTAPES : remplis UNIQUEMENT les champs visibles dans le page state actuel, puis clique "Continuer"/"Suivant"/"Valider".
- fill est UNIQUEMENT pour les vrais champs texte (input[type="text"], textarea, input sans role spécial).
- Si un champ a déjà la bonne valeur (visible dans value="..."), ne le re-remplis pas.
- DROPDOWNS (role="combobox", toggle-button, aria-expanded) : tape dans le champ avec fill pour filtrer, puis au tour suivant regarde les [role="option"] proposées et clique la plus proche. Si AUCUNE option ne correspond, LAISSE LE CHAMP VIDE et passe à autre chose — ne réessaye pas.
- CHAMPS NON-OBLIGATOIRES (marque, état, etc.) : si tu ne trouves pas de valeur qui matche, passe directement à "Continuer".
- PRIX : tape le prix tel quel en euros (si price=10, tape "10", PAS "1000").
- ADRESSE/LOCALISATION : après un fill, utilise wait_for pour attendre les suggestions [role="option"], puis au tour suivant clique la bonne suggestion.
- Pour l'upload d'images, utilise upload_images sur l'input[type=file].
- Quand tu vois "Déposer mon annonce" ou "Publier", clique dessus puis appelle done.
- Quand tu arrives sur une page de confirmation (plus sur le formulaire de dépôt), appelle done.`;
  }

  async extractResult(page: Page): Promise<PublishResult> {
    // Wait a bit for any post-submit navigation
    try {
      await page.waitForURL(
        (url) => !url.pathname.includes('deposer-une-annonce'),
        { timeout: 10_000 },
      );
    } catch {
      // Confirmation page may stay on the same URL — that's fine
    }

    const currentUrl = page.url();

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
