import { Injectable, CanActivate, ExecutionContext, HttpStatus } from '@nestjs/common';
import { DomainException } from '../../platform/filters/all-exceptions.filter';
import { ErrorCode, UserRole } from '@ai-interview/contracts';

@Injectable()
export class MfaStepUpGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new DomainException(
        ErrorCode.UNAUTHORIZED,
        'Authentication required',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Step-up is strictly required: user must have verified multi-factor auth (mfaVerified === true)
    if (!user.mfaVerified) {
      throw new DomainException(
        ErrorCode.MFA_STEP_UP_REQUIRED,
        'This sensitive action requires verified multi-factor authentication (Step-Up)',
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }
}
