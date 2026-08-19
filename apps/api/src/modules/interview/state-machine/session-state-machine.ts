import { SessionState, ErrorCode } from '@ai-interview/contracts';
import { DomainException } from '../../platform/filters/all-exceptions.filter';
import { HttpStatus } from '@nestjs/common';

export class SessionStateMachine {
  private static readonly VALID_TRANSITIONS: Record<SessionState, SessionState[]> = {
    [SessionState.CREATED]: [SessionState.ACTIVE, SessionState.CANCELLED, SessionState.FAILED],
    [SessionState.ACTIVE]: [SessionState.EVALUATING, SessionState.CANCELLED, SessionState.FAILED],
    [SessionState.EVALUATING]: [
      SessionState.ACTIVE,
      SessionState.COMPLETED,
      SessionState.CANCELLED,
      SessionState.FAILED,
    ],
    [SessionState.COMPLETED]: [],
    [SessionState.CANCELLED]: [],
    [SessionState.FAILED]: [SessionState.ACTIVE], // allows retry recovery if needed
  };

  /**
   * Validates if transition from currentState to targetState is permitted.
   * Throws DomainException with INVALID_STATE_TRANSITION code if not allowed.
   */
  static validateTransition(currentState: SessionState, targetState: SessionState): void {
    const allowed = this.VALID_TRANSITIONS[currentState] || [];
    if (!allowed.includes(targetState)) {
      throw new DomainException(
        ErrorCode.INVALID_STATE_TRANSITION,
        `Cannot transition interview session state from [${currentState}] to [${targetState}]`,
        HttpStatus.CONFLICT,
      );
    }
  }

  static canTransition(currentState: SessionState, targetState: SessionState): boolean {
    const allowed = this.VALID_TRANSITIONS[currentState] || [];
    return allowed.includes(targetState);
  }
}
