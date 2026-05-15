import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { BROWSER_QUEUE } from '@crosspost/shared';
import { AccountsController } from './accounts.controller.js';
import { AccountsService } from './accounts.service.js';
import { Account, AccountSchema } from './schemas/account.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Account.name, schema: AccountSchema },
    ]),
    BullModule.registerQueue({ name: BROWSER_QUEUE }),
  ],
  controllers: [AccountsController],
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
