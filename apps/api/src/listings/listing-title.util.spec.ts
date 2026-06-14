import { normalizeTitle } from './listing-title.util';

describe('normalizeTitle', () => {
  it('met en minuscules', () => {
    expect(normalizeTitle('Vélo de Course')).toBe('vélo de course');
  });

  it('trim les espaces en début/fin', () => {
    expect(normalizeTitle('  vélo  ')).toBe('vélo');
  });

  it('collapse les espaces internes multiples (espaces, tabs, retours ligne)', () => {
    expect(normalizeTitle('vélo   de\tcourse\ncarbone')).toBe(
      'vélo de course carbone',
    );
  });

  it('rend identiques deux libellés qui ne diffèrent que par la casse/les espaces (dédup cross-plateforme)', () => {
    expect(normalizeTitle('iPhone 13  Pro')).toBe(normalizeTitle('iphone 13 pro'));
  });

  it('laisse une chaîne déjà normalisée inchangée', () => {
    expect(normalizeTitle('canapé 3 places')).toBe('canapé 3 places');
  });

  it('gère la chaîne vide', () => {
    expect(normalizeTitle('')).toBe('');
  });
});
