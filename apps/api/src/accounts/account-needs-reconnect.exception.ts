import { HttpException, HttpStatus } from '@nestjs/common';
import {
  ACCOUNT_NEEDS_RECONNECT_CODE,
  type AccountNeedsReconnectBody,
} from '@crosspost/shared';
import type { AccountDocument } from './schemas/account.schema.js';

/**
 * Thrown when an account's credentials are no longer usable and a manual
 * reconnect from the user is required (revoked refresh token, killed
 * datadome, 401/403 with no proactive refresh available). The HTTP body
 * carries a stable `code` so the frontend can surface a "Reconnect" CTA
 * instead of a generic auth error.
 */
export class AccountNeedsReconnectException extends HttpException {
  constructor(account: AccountDocument, cause?: string) {
    const body: AccountNeedsReconnectBody = {
      code: ACCOUNT_NEEDS_RECONNECT_CODE,
      message: cause
        ? `Compte ${account.platform} (${account.email}) à reconnecter : ${cause}`
        : `Compte ${account.platform} (${account.email}) à reconnecter.`,
      accountId: account._id.toString(),
      platform: account.platform,
      email: account.email,
    };
    super(body, HttpStatus.UNAUTHORIZED);
  }
}
