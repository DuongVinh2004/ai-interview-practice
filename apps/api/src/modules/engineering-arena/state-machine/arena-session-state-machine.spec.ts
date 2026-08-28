import { ArenaSessionState, ErrorCode } from '@ai-interview/contracts';
import { ArenaSessionStateMachine } from './arena-session-state-machine';
import { DomainException } from '../../platform/filters/all-exceptions.filter';

describe('ArenaSessionStateMachine', () => {
  describe('Legal Transitions', () => {
    it('allows CREATED -> PROVISIONING', () => {
      expect(() =>
        ArenaSessionStateMachine.validateTransition(
          ArenaSessionState.CREATED,
          ArenaSessionState.PROVISIONING,
        ),
      ).not.toThrow();
      expect(
        ArenaSessionStateMachine.canTransition(
          ArenaSessionState.CREATED,
          ArenaSessionState.PROVISIONING,
        ),
      ).toBe(true);
    });

    it('allows PROVISIONING -> READY', () => {
      expect(() =>
        ArenaSessionStateMachine.validateTransition(
          ArenaSessionState.PROVISIONING,
          ArenaSessionState.READY,
        ),
      ).not.toThrow();
    });

    it('allows READY -> ACTIVE', () => {
      expect(() =>
        ArenaSessionStateMachine.validateTransition(
          ArenaSessionState.READY,
          ArenaSessionState.ACTIVE,
        ),
      ).not.toThrow();
    });

    it('allows ACTIVE -> SUBMITTING', () => {
      expect(() =>
        ArenaSessionStateMachine.validateTransition(
          ArenaSessionState.ACTIVE,
          ArenaSessionState.SUBMITTING,
        ),
      ).not.toThrow();
    });

    it('allows SUBMITTING -> EVALUATING', () => {
      expect(() =>
        ArenaSessionStateMachine.validateTransition(
          ArenaSessionState.SUBMITTING,
          ArenaSessionState.EVALUATING,
        ),
      ).not.toThrow();
    });

    it('allows EVALUATING -> COMPLETED', () => {
      expect(() =>
        ArenaSessionStateMachine.validateTransition(
          ArenaSessionState.EVALUATING,
          ArenaSessionState.COMPLETED,
        ),
      ).not.toThrow();
    });

    it('allows ACTIVE -> EXPIRED when TTL expires', () => {
      expect(() =>
        ArenaSessionStateMachine.validateTransition(
          ArenaSessionState.ACTIVE,
          ArenaSessionState.EXPIRED,
        ),
      ).not.toThrow();
    });

    it('allows any active state -> CANCELLED', () => {
      expect(() =>
        ArenaSessionStateMachine.validateTransition(
          ArenaSessionState.CREATED,
          ArenaSessionState.CANCELLED,
        ),
      ).not.toThrow();
      expect(() =>
        ArenaSessionStateMachine.validateTransition(
          ArenaSessionState.ACTIVE,
          ArenaSessionState.CANCELLED,
        ),
      ).not.toThrow();
    });
  });

  describe('Illegal Transitions & Terminal States (No Resurrection)', () => {
    it('forbids resurrection from COMPLETED', () => {
      expect(ArenaSessionStateMachine.isTerminalState(ArenaSessionState.COMPLETED)).toBe(true);
      expect(
        ArenaSessionStateMachine.canTransition(
          ArenaSessionState.COMPLETED,
          ArenaSessionState.ACTIVE,
        ),
      ).toBe(false);

      expect(() =>
        ArenaSessionStateMachine.validateTransition(
          ArenaSessionState.COMPLETED,
          ArenaSessionState.ACTIVE,
        ),
      ).toThrow(DomainException);
    });

    it('forbids resurrection from CANCELLED', () => {
      expect(ArenaSessionStateMachine.isTerminalState(ArenaSessionState.CANCELLED)).toBe(true);
      expect(
        ArenaSessionStateMachine.canTransition(
          ArenaSessionState.CANCELLED,
          ArenaSessionState.ACTIVE,
        ),
      ).toBe(false);

      expect(() =>
        ArenaSessionStateMachine.validateTransition(
          ArenaSessionState.CANCELLED,
          ArenaSessionState.ACTIVE,
        ),
      ).toThrow(DomainException);
    });

    it('forbids resurrection from EXPIRED', () => {
      expect(ArenaSessionStateMachine.isTerminalState(ArenaSessionState.EXPIRED)).toBe(true);
      expect(
        ArenaSessionStateMachine.canTransition(
          ArenaSessionState.EXPIRED,
          ArenaSessionState.ACTIVE,
        ),
      ).toBe(false);

      expect(() =>
        ArenaSessionStateMachine.validateTransition(
          ArenaSessionState.EXPIRED,
          ArenaSessionState.ACTIVE,
        ),
      ).toThrow(DomainException);
    });

    it('forbids invalid skips like CREATED -> COMPLETED', () => {
      expect(
        ArenaSessionStateMachine.canTransition(
          ArenaSessionState.CREATED,
          ArenaSessionState.COMPLETED,
        ),
      ).toBe(false);

      expect(() =>
        ArenaSessionStateMachine.validateTransition(
          ArenaSessionState.CREATED,
          ArenaSessionState.COMPLETED,
        ),
      ).toThrow(DomainException);
    });
  });
});
