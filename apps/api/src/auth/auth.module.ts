import { Module, type OnModuleInit, Logger } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { UsersService } from '../users/users.service.js';
import { AuthGuard } from './auth.guard.js';

@Module({
  imports: [UsersModule],
  providers: [AuthGuard],
  exports: [AuthGuard],
})
export class AuthModule implements OnModuleInit {
  private readonly logger = new Logger(AuthModule.name);

  constructor(private readonly usersService: UsersService) {}

  async onModuleInit() {
    await this.usersService.seedDefaultIfEmpty();
  }
}
