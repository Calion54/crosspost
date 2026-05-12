import { z } from 'zod';
import { Platform } from '../enums/platform.enum';

export const publishSchema = z.object({
  listingId: z.string().uuid(),
  platforms: z.array(z.nativeEnum(Platform)).min(1),
});

export type PublishDto = z.infer<typeof publishSchema>;
