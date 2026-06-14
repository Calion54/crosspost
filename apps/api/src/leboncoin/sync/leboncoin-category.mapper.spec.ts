import { Test } from '@nestjs/testing';
import { ListingCategory } from '@crosspost/shared';
import { LeboncoinCategoryMapper } from './leboncoin-category.mapper';
import { LlmService } from '../../common/llm/llm.service.js';

/**
 * Fabrique une réponse Anthropic minimale contenant un tool_use `set_category`,
 * suffisant pour ce que lit le mapper (`res.content`).
 */
const llmCategoryResponse = (category: string) =>
  ({
    content: [{ type: 'tool_use', name: 'set_category', input: { category } }],
  }) as any;

describe('LeboncoinCategoryMapper', () => {
  let mapper: LeboncoinCategoryMapper;
  let createMessage: jest.Mock;

  beforeEach(async () => {
    createMessage = jest.fn();
    const moduleRef = await Test.createTestingModule({
      providers: [
        LeboncoinCategoryMapper,
        { provide: LlmService, useValue: { createMessage } },
      ],
    }).compile();
    mapper = moduleRef.get(LeboncoinCategoryMapper);
  });

  describe('fast-path par règles (déterministe, sans LLM)', () => {
    it.each<[string, ListingCategory]>([
      ['Chaussures', ListingCategory.CLOTHING],
      ['Manteaux & Vestes', ListingCategory.CLOTHING],
      ['Téléphones & Objets connectés', ListingCategory.ELECTRONICS],
      ['Jeux vidéo & Consoles', ListingCategory.ELECTRONICS],
      ['Ameublement', ListingCategory.HOME],
      ['Équipement bébé', ListingCategory.BABY],
      ['Vélos', ListingCategory.SPORTS],
      ['Jeux & Jouets', ListingCategory.TOYS_GAMES],
      ['Livres', ListingCategory.BOOKS_MEDIA],
      ['Bricolage', ListingCategory.DIY],
      ['Cosmétiques & Parfums', ListingCategory.BEAUTY],
    ])('mappe "%s" → %s', async (input, expected) => {
      await expect(mapper.toUniversal(input)).resolves.toBe(expected);
      expect(createMessage).not.toHaveBeenCalled();
    });

    it('priorité bébé avant vêtements pour "Vêtements bébé"', async () => {
      await expect(mapper.toUniversal('Vêtements bébé')).resolves.toBe(
        ListingCategory.BABY,
      );
    });

    it('priorité jeux vidéo (ELECTRONICS) sur jouets', async () => {
      await expect(mapper.toUniversal('Jeux vidéo')).resolves.toBe(
        ListingCategory.ELECTRONICS,
      );
    });
  });

  describe('trou connu : orthographe à circonflexe non couverte par les règles', () => {
    // La regex CLOTHING est `v[ée]tement` : la classe [ée] ne contient pas `ê`.
    // Or le libellé réel LBC s'écrit « Vêtements » → il n'est PAS pris par le
    // fast-path et tombe sur le LLM. Ce test documente/garde ce comportement.
    // Si la regex est élargie au circonflexe, ce test devra être inversé.
    it('"Vêtements" (circonflexe) ne matche aucune règle → fallback LLM', async () => {
      createMessage.mockResolvedValue(llmCategoryResponse('clothing'));
      await expect(mapper.toUniversal('Vêtements')).resolves.toBe(
        ListingCategory.CLOTHING,
      );
      expect(createMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe('valeurs vides', () => {
    it.each([null, undefined, ''])('%p → OTHER sans appel LLM', async (input) => {
      await expect(mapper.toUniversal(input as any)).resolves.toBe(
        ListingCategory.OTHER,
      );
      expect(createMessage).not.toHaveBeenCalled();
    });
  });

  describe('fallback LLM (aucune règle ne matche)', () => {
    it('utilise la catégorie renvoyée par le LLM', async () => {
      createMessage.mockResolvedValue(llmCategoryResponse('collectibles'));
      await expect(mapper.toUniversal('Numismatique rare')).resolves.toBe(
        ListingCategory.COLLECTIBLES,
      );
      expect(createMessage).toHaveBeenCalledTimes(1);
    });

    it('retombe sur OTHER si le LLM renvoie une catégorie inconnue', async () => {
      createMessage.mockResolvedValue(llmCategoryResponse('not-a-category'));
      await expect(mapper.toUniversal('Libellé exotique')).resolves.toBe(
        ListingCategory.OTHER,
      );
    });

    it('retombe sur OTHER si le LLM throw', async () => {
      createMessage.mockRejectedValue(new Error('timeout'));
      await expect(mapper.toUniversal('Autre libellé exotique')).resolves.toBe(
        ListingCategory.OTHER,
      );
    });

    it('met en cache : un 2e appel sur le même libellé ne rappelle pas le LLM', async () => {
      createMessage.mockResolvedValue(llmCategoryResponse('home'));
      await mapper.toUniversal('Libellé inédit à cacher');
      await mapper.toUniversal('Libellé inédit à cacher');
      expect(createMessage).toHaveBeenCalledTimes(1);
    });
  });
});
