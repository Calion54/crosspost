import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service.js';
import type { AuthUser } from './current-user.decorator.js';

@Injectable()
export class AuthGuard implements CanActivate {
  private defaultUserId: string | null = null;

  constructor(private readonly usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // TODO: Replace with real auth (JWT, session, etc.)
    // For now, always resolve to the default user
    if (!this.defaultUserId) {
      const user = await this.usersService.findFirst();
      if (!user) return false;
      this.defaultUserId = user._id.toString();
    }

    request.user = {
      userId: this.defaultUserId,
    } satisfies AuthUser;

    return true;
  }
}
