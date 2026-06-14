import { bumpConfigSchema, updateSettingsSchema } from '@crosspost/shared';

const validBump = {
  enabled: true,
  intervalDays: 2,
  priceReductionPercent: 5,
};

describe('bumpConfigSchema', () => {
  it('accepte une config valide', () => {
    expect(bumpConfigSchema.parse(validBump)).toEqual(validBump);
  });

  it.each([
    ['intervalDays < 1', { ...validBump, intervalDays: 0 }],
    ['intervalDays non entier', { ...validBump, intervalDays: 1.5 }],
    ['priceReductionPercent < 0', { ...validBump, priceReductionPercent: -1 }],
    ['priceReductionPercent > 100', { ...validBump, priceReductionPercent: 101 }],
    ['enabled manquant', { intervalDays: 2, priceReductionPercent: 5 }],
  ])('rejette : %s', (_label, input) => {
    expect(bumpConfigSchema.safeParse(input).success).toBe(false);
  });

  it('accepte les bornes 0 et 100 pour priceReductionPercent', () => {
    expect(bumpConfigSchema.safeParse({ ...validBump, priceReductionPercent: 0 }).success).toBe(true);
    expect(bumpConfigSchema.safeParse({ ...validBump, priceReductionPercent: 100 }).success).toBe(true);
  });
});

describe('updateSettingsSchema', () => {
  it('accepte un objet vide (tous les champs optionnels)', () => {
    expect(updateSettingsSchema.parse({})).toEqual({});
  });

  it('accepte une location en string libre (géocodée côté backend)', () => {
    expect(updateSettingsSchema.parse({ location: 'Paris 11e' }).location).toBe('Paris 11e');
  });

  it('accepte une location structurée déjà géocodée', () => {
    const location = { city: 'Paris', zipcode: '75011', country: 'FR', lat: 48.85, lng: 2.37 };
    expect(updateSettingsSchema.parse({ location }).location).toEqual(location);
  });

  it('rejette une location structurée incomplète (lat/lng manquants)', () => {
    const bad = { location: { city: 'Paris', zipcode: '75011', country: 'FR' } };
    // Note : la string passe toujours, donc seul un objet malformé est rejeté.
    expect(updateSettingsSchema.safeParse(bad).success).toBe(false);
  });

  it('valide le sous-objet bump', () => {
    expect(updateSettingsSchema.safeParse({ bump: { ...validBump, intervalDays: 0 } }).success).toBe(
      false,
    );
  });
});
