import { z } from 'zod';
import { Platform } from '../enums/platform.enum.js';

export const connectAccountSchema = z.object({
  platform: z.nativeEnum(Platform),
  email: z.string().email(),
  password: z.string().min(1),
});
export type ConnectAccountInput = z.infer<typeof connectAccountSchema>;
