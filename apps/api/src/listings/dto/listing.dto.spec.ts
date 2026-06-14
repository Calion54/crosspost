import {
  createListingSchema,
  listingQuerySchema,
  ListingStatusFilter,
  PackageSize,
  Platform,
} from '@crosspost/shared';

/** Annonce valide minimale réutilisée et dérivée dans les cas d'erreur. */
const validListing = {
  title: 'Vélo de course',
  description: 'Très bon état, peu servi, cadre carbone.',
  price: 350,
  packageSize: PackageSize.L,
};

describe('createListingSchema', () => {
  it('accepte une annonce minimale valide et applique media: [] par défaut', () => {
    const parsed = createListingSchema.parse(validListing);
    expect(parsed.media).toEqual([]);
  });

  it.each([
    ['titre trop court', { ...validListing, title: 'ab' }],
    ['description trop courte', { ...validListing, description: 'court' }],
    ['prix négatif', { ...validListing, price: -1 }],
    ['prix zéro', { ...validListing, price: 0 }],
    ['packageSize manquant', { title: validListing.title, description: validListing.description, price: 10 }],
    ['packageSize invalide', { ...validListing, packageSize: 'HUGE' }],
  ])('rejette : %s', (_label, input) => {
    expect(createListingSchema.safeParse(input).success).toBe(false);
  });

  it('rejette un media sans key', () => {
    const bad = { ...validListing, media: [{ contentType: 'image/jpeg' }] };
    expect(createListingSchema.safeParse(bad).success).toBe(false);
  });
});

describe('listingQuerySchema', () => {
  it('applique les defaults sur un objet vide', () => {
    expect(listingQuerySchema.parse({})).toMatchObject({
      page: 1,
      limit: 20,
      sort: 'createdAt:desc',
      statusFilter: ListingStatusFilter.ALL,
    });
  });

  it('coerce les nombres venant de la query string', () => {
    const parsed = listingQuerySchema.parse({ page: '3', limit: '50' });
    expect(parsed.page).toBe(3);
    expect(parsed.limit).toBe(50);
  });

  it('rejette limit > 100', () => {
    expect(listingQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
  });

  it('normalise une valeur unique de platforms en tableau (?p=a)', () => {
    expect(listingQuerySchema.parse({ platforms: Platform.LEBONCOIN }).platforms).toEqual([
      Platform.LEBONCOIN,
    ]);
  });

  it('conserve un tableau de platforms (?p=a&p=b)', () => {
    const parsed = listingQuerySchema.parse({
      platforms: [Platform.LEBONCOIN, Platform.VINTED],
    });
    expect(parsed.platforms).toEqual([Platform.LEBONCOIN, Platform.VINTED]);
  });

  it('laisse platforms undefined si absent', () => {
    expect(listingQuerySchema.parse({}).platforms).toBeUndefined();
  });

  it('rejette une plateforme inconnue dans platforms', () => {
    expect(listingQuerySchema.safeParse({ platforms: 'myspace' }).success).toBe(false);
  });
});
