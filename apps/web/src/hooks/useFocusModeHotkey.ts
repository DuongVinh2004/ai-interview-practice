import { useEffect } from 'react';
import { useFocusModeStore } from '../stores/focus-mode.store';

/**
 * Focus Mode Hotkey Hook (Task 2.3)
 * - Press 'F' (when not focused on input / textarea / contenteditable) to toggle focus mode
 * - Press 'Escape' (when focus mode is active) to turn off focus mode
 */
export function useFocusModeHotkey() {
  const { isFocusMode, toggleFocusMode, setFocusMode } = useFocusModeStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore modifier combinations (Ctrl+F for browser search, Cmd+F, Alt+F, etc.)
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      const activeElement = document.activeElement;
      const target = e.target as HTMLElement | null;
      const isInputFocused =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        (activeElement instanceof HTMLElement && activeElement.isContentEditable) ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable);

      if (e.key === 'f' || e.key === 'F') {
        if (!isInputFocused) {
          e.preventDefault();
          toggleFocusMode();
        }
        return;
      }

      if (e.key === 'Escape') {
        if (useFocusModeStore.getState().isFocusMode) {
          e.preventDefault();
          setFocusMode(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleFocusMode, setFocusMode]);

  return { isFocusMode, toggleFocusMode, setFocusMode };
}
