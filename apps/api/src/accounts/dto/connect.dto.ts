import { createZodDto } from 'nestjs-zod';
import { connectAccountSchema } from '@crosspost/shared';

export class ConnectAccountDto extends createZodDto(connectAccountSchema) {}
