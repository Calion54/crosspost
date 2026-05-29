import type { VintedCatalogNode } from './vinted-catalog.schemas.js';

/**
 * Helpers de navigation sur l'arbre du catalogue Vinted. Fonctions pures, pas
 * de DI — utilisées par le resolver, et pratiques pour debug/scripts.
 */

/**
 * Aplatit l'arbre et ne retourne que les feuilles (nœuds avec `catalogs` vide).
 * Seules les feuilles sont des `catalog_id` valides pour soumettre une annonce.
 */
export function flattenLeaves(
  tree: VintedCatalogNode[],
): VintedCatalogNode[] {
  const out: VintedCatalogNode[] = [];
  const walk = (node: VintedCatalogNode): void => {
    if (node.catalogs.length === 0) {
      out.push(node);
      return;
    }
    for (const child of node.catalogs) walk(child);
  };
  for (const node of tree) walk(node);
  return out;
}

/** Cherche un nœud par id n'importe où dans l'arbre. `null` si absent. */
export function findNodeById(
  tree: VintedCatalogNode[],
  id: number,
): VintedCatalogNode | null {
  for (const node of tree) {
    if (node.id === id) return node;
    const found = findNodeById(node.catalogs, id);
    if (found) return found;
  }
  return null;
}

/**
 * Compte les nœuds par profondeur dans l'arbre — utile pour comprendre la
 * structure du catalogue et estimer le nombre d'appels LLM nécessaires en
 * cascade.
 */
export function countByDepth(tree: VintedCatalogNode[]): number[] {
  const counts: number[] = [];
  const walk = (node: VintedCatalogNode, depth: number): void => {
    counts[depth] = (counts[depth] ?? 0) + 1;
    for (const child of node.catalogs) walk(child, depth + 1);
  };
  for (const node of tree) walk(node, 0);
  return counts;
}
