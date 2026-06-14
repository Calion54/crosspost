import {
  countByDepth,
  findNodeById,
  flattenLeaves,
} from './vinted-catalog.utils';
import type { VintedCatalogNode } from './vinted-catalog.schemas';

/** Petit helper de construction de nœud (les autres champs sont optionnels). */
const node = (
  id: number,
  title: string,
  catalogs: VintedCatalogNode[] = [],
): VintedCatalogNode => ({ id, title, catalogs });

/**
 * Arbre de test :
 *   1 Femmes
 *     10 Vêtements
 *       100 Robes        (feuille)
 *       101 Manteaux     (feuille)
 *     11 Chaussures      (feuille)
 *   2 Hommes
 *     20 Vêtements
 *       200 Pantalons    (feuille)
 */
const tree: VintedCatalogNode[] = [
  node(1, 'Femmes', [
    node(10, 'Vêtements', [node(100, 'Robes'), node(101, 'Manteaux')]),
    node(11, 'Chaussures'),
  ]),
  node(2, 'Hommes', [node(20, 'Vêtements', [node(200, 'Pantalons')])]),
];

describe('flattenLeaves', () => {
  it('ne retourne que les feuilles (catalogs vide), dans l’ordre de parcours', () => {
    expect(flattenLeaves(tree).map((n) => n.id)).toEqual([100, 101, 11, 200]);
  });

  it('traite un nœud racine sans enfant comme une feuille', () => {
    expect(flattenLeaves([node(5, 'Seul')]).map((n) => n.id)).toEqual([5]);
  });

  it('retourne un tableau vide pour un arbre vide', () => {
    expect(flattenLeaves([])).toEqual([]);
  });
});

describe('findNodeById', () => {
  it('trouve un nœud racine', () => {
    expect(findNodeById(tree, 2)?.title).toBe('Hommes');
  });

  it('trouve un nœud profondément imbriqué', () => {
    expect(findNodeById(tree, 200)?.title).toBe('Pantalons');
  });

  it('retourne null pour un id absent', () => {
    expect(findNodeById(tree, 999)).toBeNull();
  });
});

describe('countByDepth', () => {
  it('compte les nœuds par profondeur', () => {
    // profondeur 0: Femmes, Hommes (2)
    // profondeur 1: Vêtements, Chaussures, Vêtements (3)
    // profondeur 2: Robes, Manteaux, Pantalons (3)
    expect(countByDepth(tree)).toEqual([2, 3, 3]);
  });

  it('retourne un tableau vide pour un arbre vide', () => {
    expect(countByDepth([])).toEqual([]);
  });
});
