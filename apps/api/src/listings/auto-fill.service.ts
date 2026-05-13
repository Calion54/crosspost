import { Injectable, Logger } from '@nestjs/common';
import { ListingCategory, ListingColor, ListingCondition, PackageSize } from '@crosspost/shared';
import type { AutoFillDto, AutoFillResult } from '@crosspost/shared';
import { LlmService } from '../common/llm/llm.service.js';

const SYSTEM_PROMPT = `Tu es un assistant spécialisé dans les annonces de vente en ligne (Leboncoin, Vinted, etc.).
À partir du titre et de la description d'une annonce, tu dois :
1. Enrichir la description pour la rendre complète et structurée
2. Extraire les métadonnées du produit

Réponds UNIQUEMENT en JSON valide, sans markdown, sans explication.

Format attendu :
{
  "description": "Description enrichie et structurée (voir règles ci-dessous)",
  "category": "clothing | electronics | home | sports | toys_games | books_media | beauty | baby | diy | collectibles | other",
  "condition": "new_with_tags | new_without_tags | very_good | good | fair",
  "color": "black | white | grey | blue | red | green | yellow | orange | pink | purple | brown | beige | gold | silver | multicolor | other",
  "packageSize": "S | M | L",
  "suggestedPrice": null
}

Règles pour la description enrichie :
- Garde le texte original de l'utilisateur comme base
- Ajoute un bloc structuré à la fin avec les caractéristiques détectées, séparé par une ligne vide
- Format du bloc : "Marque : X", "Taille : X", "Matière : X", etc. — une ligne par caractéristique
- N'ajoute que les caractéristiques que tu peux déduire du titre et de la description
- Ce bloc servira ensuite à remplir automatiquement les champs spécifiques des plateformes (marque, taille, modèle, etc.)
- La description doit rester naturelle et agréable à lire

Exemple :
Titre : "Veste en cuir Schott NYC taille L"
Description utilisateur : "Portée quelques fois, très bon état"
→ description enrichie :
"Portée quelques fois, très bon état.

Marque : Schott NYC
Taille : L
Matière : Cuir"

Règles pour les métadonnées :
- Pour "condition", déduis de la description (neuf, bon état, etc.). Si pas d'indication, mets "good".
- Pour "packageSize" : S (enveloppe, petite boîte), M (boîte à chaussures), L (carton volumineux). Obligatoire.
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
      maxTokens: 512,
    });

    const text =
      response.content[0].type === 'text' ? response.content[0].text : '';

    this.logger.debug(`AutoFill raw response: ${text}`);

    try {
      const cleaned = text.replace(/```(?:json)?\s*/g, '').replace(/```/g, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logger.error(`No JSON found in AutoFill response: ${text}`);
        return {};
      }
      const parsed = JSON.parse(jsonMatch[0]);

      const categoryValues = Object.values(ListingCategory) as string[];
      const category = categoryValues.includes(parsed.category)
        ? (parsed.category as ListingCategory)
        : undefined;

      const conditionValues = Object.values(ListingCondition) as string[];
      const condition = conditionValues.includes(parsed.condition)
        ? (parsed.condition as ListingCondition)
        : undefined;

      const colorValues = Object.values(ListingColor) as string[];
      const color = colorValues.includes(parsed.color)
        ? (parsed.color as ListingColor)
        : undefined;

      const packageSizeValues = Object.values(PackageSize) as string[];
      const packageSize = packageSizeValues.includes(parsed.packageSize)
        ? (parsed.packageSize as PackageSize)
        : undefined;

      return {
        description: parsed.description || undefined,
        category,
        condition,
        color,
        packageSize,
        suggestedPrice: parsed.suggestedPrice || undefined,
      };
    } catch (err: any) {
      this.logger.error(`Failed to parse AutoFill response: ${text}`);
      return {};
    }
  }
}
