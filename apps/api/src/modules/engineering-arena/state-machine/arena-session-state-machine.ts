import { ArenaSessionState, ErrorCode } from '@ai-interview/contracts';
import { DomainException } from '../../platform/filters/all-exceptions.filter';
import { HttpStatus } from '@nestjs/common';

export class ArenaSessionStateMachine {
  private static readonly VALID_TRANSITIONS: Record<ArenaSessionState, ArenaSessionState[]> = {
    [ArenaSessionState.CREATED]: [
      ArenaSessionState.PROVISIONING,
      ArenaSessionState.CANCELLED,
      ArenaSessionState.FAILED,
    ],
    [ArenaSessionState.PROVISIONING]: [
      ArenaSessionState.READY,
      ArenaSessionState.CANCELLED,
      ArenaSessionState.FAILED,
    ],
    [ArenaSessionState.READY]: [
      ArenaSessionState.ACTIVE,
      ArenaSessionState.CANCELLED,
      ArenaSessionState.EXPIRED,
      ArenaSessionState.FAILED,
    ],
    [ArenaSessionState.ACTIVE]: [
      ArenaSessionState.SUBMITTING,
      ArenaSessionState.CANCELLED,
      ArenaSessionState.EXPIRED,
      ArenaSessionState.FAILED,
    ],
    [ArenaSessionState.SUBMITTING]: [ArenaSessionState.EVALUATING, ArenaSessionState.FAILED],
    [ArenaSessionState.EVALUATING]: [ArenaSessionState.COMPLETED, ArenaSessionState.FAILED],
    [ArenaSessionState.COMPLETED]: [],
    [ArenaSessionState.CANCELLED]: [],
    [ArenaSessionState.EXPIRED]: [],
    [ArenaSessionState.FAILED]: [ArenaSessionState.PROVISIONING, ArenaSessionState.ACTIVE],
  };

  /**
   * Checks whether a state is terminal.
   */
  static isTerminalState(state: ArenaSessionState): boolean {
    return (
      state === ArenaSessionState.COMPLETED ||
      state === ArenaSessionState.CANCELLED ||
      state === ArenaSessionState.EXPIRED
    );
  }

  /**
   * Validates if transition from currentState to targetState is permitted.
   * Throws DomainException with INVALID_STATE_TRANSITION code if not allowed.
   */
  static validateTransition(currentState: ArenaSessionState, targetState: ArenaSessionState): void {
    if (this.isTerminalState(currentState)) {
      throw new DomainException(
        ErrorCode.INVALID_STATE_TRANSITION,
        `Cannot transition from terminal arena session state [${currentState}] to [${targetState}]`,
        HttpStatus.CONFLICT,
      );
    }

    const allowed = this.VALID_TRANSITIONS[currentState] || [];
    if (!allowed.includes(targetState)) {
      throw new DomainException(
        ErrorCode.INVALID_STATE_TRANSITION,
        `Cannot transition arena session state from [${currentState}] to [${targetState}]`,
        HttpStatus.CONFLICT,
      );
    }
  }

  /**
   * Returns true if transition is legal, false otherwise.
   */
  static canTransition(currentState: ArenaSessionState, targetState: ArenaSessionState): boolean {
    if (this.isTerminalState(currentState)) {
      return false;
    }
    const allowed = this.VALID_TRANSITIONS[currentState] || [];
    return allowed.includes(targetState);
  }
}
