import { createZodDto } from 'nestjs-zod';
import { updateSettingsSchema } from '@crosspost/shared';

export class UpdateSettingsDto extends createZodDto(updateSettingsSchema) {}
