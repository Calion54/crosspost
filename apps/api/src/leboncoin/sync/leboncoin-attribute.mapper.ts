import { Injectable, Logger } from '@nestjs/common';
import {
  ListingColor,
  ListingCondition,
  PackageSize,
} from '@crosspost/shared';
import type { LbcAd } from './lbc-api.schemas.js';

interface NormalizedAttr {
  value?: string;
  label?: string;
}

type AttrMap = Map<string, NormalizedAttr>;

const CONDITION_KEYS = ['condition', 'item_condition', 'etat_objet', 'etat'];

// Pour color : LBC préfixe la clé par catégorie (home_appliance_color, clothing_color, …)
// → on scan toutes les clés qui se terminent par _color, _colors ou _couleur, ou égales à color/colors/couleur.
const COLOR_KEY_REGEX = /(?:^|_)(?:colors?|couleur)$/i;

const PACKAGE_SIZE_KEYS = [
  'estimated_parcel_size', // LBC : clé réelle observée
  'colis_taille',
  'package_size',
  'shipping_size',
  'shipping_packaging_format',
];

/**
 * Extrait les attributs typés d'une annonce LBC (condition, couleur, taille du colis).
 * Les attributs LBC arrivent sous la forme `{ key, value, value_label }` — on les
 * indexe puis on map les libellés FR vers nos enums.
 *
 * Retourne `null` quand l'info n'est pas trouvée (plutôt qu'undefined, pour avoir
 * une valeur explicite en DB).
 */
@Injectable()
export class LeboncoinAttributeMapper {
  private readonly logger = new Logger(LeboncoinAttributeMapper.name);

  parse(ad: LbcAd): {
    condition: ListingCondition | null;
    color: ListingColor | null;
    packageSize: PackageSize;
  } {
    const attrs = indexAttributes(ad);
    return {
      condition: this.matchCondition(attrs),
      color: this.matchColor(attrs),
      packageSize: this.matchPackageSize(attrs) ?? PackageSize.M,
    };
  }

  private matchCondition(attrs: AttrMap): ListingCondition | null {
    const raw = pickFirstLabel(attrs, CONDITION_KEYS);
    if (!raw) return null;
    const lc = raw.toLowerCase().trim();
    if (lc.includes('comme neuf')) return ListingCondition.NEW_WITHOUT_TAGS;
    if (/^neuf|neuf avec|neuve|tags/.test(lc))
      return ListingCondition.NEW_WITH_TAGS;
    if (/tr[èe]s bon/.test(lc)) return ListingCondition.VERY_GOOD;
    if (/^bon\b|bon [ée]tat/.test(lc)) return ListingCondition.GOOD;
    if (/correct|satisfaisant|moyen|fair|us[ée]/.test(lc))
      return ListingCondition.FAIR;
    this.logger.debug(`Condition "${raw}" non mappée → null`);
    return null;
  }

  private matchColor(attrs: AttrMap): ListingColor | null {
    const raw = pickFirstLabelByPattern(attrs, COLOR_KEY_REGEX);
    if (!raw) return null;
    const lc = raw.toLowerCase().trim();
    // Multicolore avant les couleurs simples (sinon "multicolore noir/blanc" → BLACK)
    if (/multicolore?|color[ée]|multi-couleur/.test(lc))
      return ListingColor.MULTICOLOR;
    if (/noir/.test(lc)) return ListingColor.BLACK;
    if (/blanc|[ée]cru/.test(lc)) return ListingColor.WHITE;
    if (/gris|anthracite|charbon/.test(lc)) return ListingColor.GREY;
    if (/bleu|marine|turquoise|cyan/.test(lc)) return ListingColor.BLUE;
    if (/rouge|bordeaux|grenat/.test(lc)) return ListingColor.RED;
    if (/vert|kaki|olive/.test(lc)) return ListingColor.GREEN;
    if (/jaune|moutarde/.test(lc)) return ListingColor.YELLOW;
    if (/orange|corail/.test(lc)) return ListingColor.ORANGE;
    if (/rose|fuchsia|saumon/.test(lc)) return ListingColor.PINK;
    if (/violet|mauve|lilas|parme/.test(lc)) return ListingColor.PURPLE;
    if (/marron|brun|chocolat|caf[ée]/.test(lc)) return ListingColor.BROWN;
    if (/beige|cr[ée]me|sable|ivoire/.test(lc)) return ListingColor.BEIGE;
    if (/\bor\b|dor[ée]/.test(lc)) return ListingColor.GOLD;
    if (/argent|argent[ée]/.test(lc)) return ListingColor.SILVER;
    this.logger.debug(`Couleur "${raw}" non mappée → OTHER`);
    return ListingColor.OTHER;
  }

  private matchPackageSize(attrs: AttrMap): PackageSize | null {
    const raw = pickFirstLabel(attrs, PACKAGE_SIZE_KEYS);
    if (!raw) return null;
    const lc = raw.toLowerCase().trim();
    if (/\bs\b|petit|small/.test(lc)) return PackageSize.S;
    if (/\bl\b|grand|large|gros/.test(lc)) return PackageSize.L;
    if (/\bm\b|moyen|medium/.test(lc)) return PackageSize.M;
    return null;
  }
}

function indexAttributes(ad: LbcAd): AttrMap {
  const map: AttrMap = new Map();
  for (const a of ad.attributes ?? []) {
    map.set(a.key, { value: a.value, label: a.value_label });
  }
  return map;
}

function pickFirstLabel(
  attrs: AttrMap,
  candidateKeys: string[],
): string | null {
  for (const k of candidateKeys) {
    const a = attrs.get(k);
    if (a) return a.label ?? a.value ?? null;
  }
  return null;
}

function pickFirstLabelByPattern(
  attrs: AttrMap,
  keyRegex: RegExp,
): string | null {
  for (const [key, attr] of attrs) {
    if (keyRegex.test(key)) {
      return attr.label ?? attr.value ?? null;
    }
  }
  return null;
}
