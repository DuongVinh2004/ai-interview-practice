import { describe, it, expect, beforeEach } from 'vitest';
import { useFocusModeStore } from '../focus-mode.store';

describe('useFocusModeStore', () => {
  beforeEach(() => {
    useFocusModeStore.setState({ isFocusMode: false });
  });

  it('should toggle focus mode state', () => {
    const { toggleFocusMode } = useFocusModeStore.getState();
    expect(useFocusModeStore.getState().isFocusMode).toBe(false);

    toggleFocusMode();
    expect(useFocusModeStore.getState().isFocusMode).toBe(true);

    toggleFocusMode();
    expect(useFocusModeStore.getState().isFocusMode).toBe(false);
  });

  it('should set focus mode explicitly', () => {
    const { setFocusMode } = useFocusModeStore.getState();

    setFocusMode(true);
    expect(useFocusModeStore.getState().isFocusMode).toBe(true);

    setFocusMode(false);
    expect(useFocusModeStore.getState().isFocusMode).toBe(false);
  });
});
