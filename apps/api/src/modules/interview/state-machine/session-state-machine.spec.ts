import { SessionStateMachine } from './session-state-machine';
import { SessionState, ErrorCode } from '@ai-interview/contracts';
import { DomainException } from '../../../modules/platform/filters/all-exceptions.filter';

describe('SessionStateMachine', () => {
  it('allows valid main-flow transitions', () => {
    expect(() => {
      SessionStateMachine.validateTransition(SessionState.CREATED, SessionState.ACTIVE);
    }).not.toThrow();

    expect(() => {
      SessionStateMachine.validateTransition(SessionState.ACTIVE, SessionState.EVALUATING);
    }).not.toThrow();

    expect(() => {
      SessionStateMachine.validateTransition(SessionState.EVALUATING, SessionState.ACTIVE);
    }).not.toThrow();

    expect(() => {
      SessionStateMachine.validateTransition(SessionState.EVALUATING, SessionState.COMPLETED);
    }).not.toThrow();
  });

  it('rejects invalid transitions and throws DomainException with INVALID_STATE_TRANSITION', () => {
    expect(() => {
      SessionStateMachine.validateTransition(SessionState.CREATED, SessionState.COMPLETED);
    }).toThrow(DomainException);

    try {
      SessionStateMachine.validateTransition(SessionState.COMPLETED, SessionState.ACTIVE);
    } catch (error: any) {
      expect(error.code).toBe(ErrorCode.INVALID_STATE_TRANSITION);
      expect(error.status).toBe(409);
    }
  });

  it('canTransition returns boolean correctly', () => {
    expect(SessionStateMachine.canTransition(SessionState.CREATED, SessionState.ACTIVE)).toBe(true);
    expect(SessionStateMachine.canTransition(SessionState.COMPLETED, SessionState.ACTIVE)).toBe(
      false,
    );
  });
});
