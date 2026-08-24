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

    // Step-up is required for Admins or users with MFA enabled
    if (user.role === UserRole.ADMIN && user.mfaVerified === false) {
      throw new DomainException(
        ErrorCode.MFA_STEP_UP_REQUIRED,
        'This sensitive action requires verified multi-factor authentication (Step-Up)',
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }
}
