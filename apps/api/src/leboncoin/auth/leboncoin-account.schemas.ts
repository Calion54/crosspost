import { z } from 'zod';

/**
 * Réponse de GET /api/account/v2/members/me/account
 * Appelée juste après le login pour récupérer le profil utilisateur côté LBC
 * (notamment le téléphone, utilisé au publish).
 */
export const LbcPhoneNumberSchema = z
  .object({
    full_phone_number: z.string().optional(),
    number: z.string().optional(),
    country_code: z.string().optional(),
    is_verified: z.boolean().optional(),
  })
  .passthrough();

export const LbcMeAccountResponseSchema = z
  .object({
    account: z
      .object({
        account_id: z.string(),
        type: z.string().optional(),
        status: z.string().optional(),
      })
      .passthrough(),
    member: z
      .object({
        member_id: z.string(),
        first_name: z.string().optional(),
        last_name: z.string().optional(),
        contact: z
          .object({
            email: z.string().optional(),
            phone_number: LbcPhoneNumberSchema.optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough(),
  })
  .passthrough();

export type LbcMeAccountResponse = z.infer<typeof LbcMeAccountResponseSchema>;

/**
 * Extrait le téléphone au format LBC submit (`+{country}{number}` sans espaces)
 * depuis la réponse de /me/account. Retourne `undefined` si absent.
 */
export function extractPhoneNumber(
  body: LbcMeAccountResponse,
): string | undefined {
  const phone = body.member?.contact?.phone_number;
  if (!phone) return undefined;
  // Préférer le full_phone_number nettoyé des espaces
  if (phone.full_phone_number) {
    const cleaned = phone.full_phone_number.replace(/\s+/g, '');
    if (cleaned) return cleaned;
  }
  // Fallback : reconstruire depuis country_code + number
  if (phone.country_code && phone.number) {
    return `+${phone.country_code}${phone.number}`;
  }
  return undefined;
}
