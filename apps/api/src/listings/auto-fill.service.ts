import { Injectable, Logger } from '@nestjs/common';
import { ListingCondition, PackageSize } from '@crosspost/shared';
import type { AutoFillDto, AutoFillResult } from '@crosspost/shared';
import { LlmService } from '../common/llm/llm.service.js';

const SYSTEM_PROMPT = `Tu es un assistant spécialisé dans les annonces de vente en ligne (Leboncoin, Vinted, etc.).
À partir du titre et de la description d'une annonce, tu dois extraire et deviner les informations suivantes.
Réponds UNIQUEMENT en JSON valide, sans markdown, sans explication.

Format attendu :
{
  "category": "catégorie générale du produit (ex: Vêtements, Électronique, Jeux & Jouets, Maison, Sport...)",
  "condition": "new_with_tags | new_without_tags | very_good | good | fair",
  "brand": "marque si identifiable, sinon null",
  "size": "taille si applicable (vêtements, chaussures), sinon null",
  "color": "couleur principale si mentionnée, sinon null",
  "packageSize": "S | M | L",
  "suggestedPrice": null
}

Règles :
- Pour "condition", déduis de la description (neuf, bon état, etc.). Si pas d'indication, mets "good".
- Pour "brand", cherche dans le titre et la description.
- Pour "size", ne mets une valeur que pour les vêtements, chaussures, accessoires vestimentaires.
- Pour "packageSize", choisis la taille du colis pour expédier l'objet : S (petit, tient dans une enveloppe ou petite boîte), M (moyen, boîte à chaussures), L (grand, carton volumineux). Obligatoire.
- Pour "suggestedPrice", mets null (on ne devine pas le prix).
- Si tu ne peux pas déterminer un champ, mets null.`;

@Injectable()
export class AutoFillService {
  private readonly logger = new Logger(AutoFillService.name);

  constructor(private llm: LlmService) {}

  async autoFill(dto: AutoFillDto): Promise<AutoFillResult> {
    const userMessage = [
      `Titre : ${dto.title}`,
      dto.description ? `Description : ${dto.description}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const response = await this.llm.createMessage({
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 256,
    });

    const text =
      response.content[0].type === 'text' ? response.content[0].text : '';

    this.logger.debug(`AutoFill raw response: ${text}`);

    try {
      const cleaned = text.replace(/```(?:json)?\s*/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      const conditionValues = Object.values(ListingCondition) as string[];
      const condition = conditionValues.includes(parsed.condition)
        ? (parsed.condition as ListingCondition)
        : undefined;

      const packageSizeValues = Object.values(PackageSize) as string[];
      const packageSize = packageSizeValues.includes(parsed.packageSize)
        ? (parsed.packageSize as PackageSize)
        : undefined;

      return {
        category: parsed.category || undefined,
        condition,
        brand: parsed.brand || undefined,
        size: parsed.size || undefined,
        color: parsed.color || undefined,
        packageSize,
        suggestedPrice: parsed.suggestedPrice || undefined,
      };
    } catch (err: any) {
      this.logger.error(`Failed to parse AutoFill response: ${text}`);
      return {};
    }
  }
}
