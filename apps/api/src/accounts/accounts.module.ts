import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccountsController } from './accounts.controller.js';
import { AccountsService } from './accounts.service.js';
import { Account, AccountSchema } from './schemas/account.schema.js';
import { LeboncoinModule } from '../leboncoin/leboncoin.module.js';
import { VintedModule } from '../vinted/vinted.module.js';
import { PlatformAuthDispatcher } from './platform-auth.dispatcher.js';
import { SyncModule } from '../sync/sync.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Account.name, schema: AccountSchema },
    ]),
    LeboncoinModule,
    VintedModule,
    forwardRef(() => SyncModule),
  ],
  controllers: [AccountsController],
  providers: [AccountsService, PlatformAuthDispatcher],
  exports: [AccountsService],
})
export class AccountsModule {}
