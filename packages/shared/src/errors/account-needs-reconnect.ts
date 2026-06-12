import { z } from 'zod';
import { Platform } from '../enums/platform.enum';

/** Stable code surfaced both via direct HTTP 401 and BullMQ job failure. */
export const ACCOUNT_NEEDS_RECONNECT_CODE = 'ACCOUNT_NEEDS_RECONNECT' as const;
export type AccountNeedsReconnectCode = typeof ACCOUNT_NEEDS_RECONNECT_CODE;

export const accountNeedsReconnectBodySchema = z.object({
  code: z.literal(ACCOUNT_NEEDS_RECONNECT_CODE),
  message: z.string(),
  accountId: z.string(),
  platform: z.nativeEnum(Platform),
  email: z.string(),
});

export type AccountNeedsReconnectBody = z.infer<
  typeof accountNeedsReconnectBodySchema
>;
