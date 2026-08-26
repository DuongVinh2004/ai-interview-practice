import { create } from 'zustand';

interface FocusModeState {
  isFocusMode: boolean;
  toggleFocusMode: () => void;
  setFocusMode: (enabled: boolean) => void;
}

export const useFocusModeStore = create<FocusModeState>(set => ({
  isFocusMode: false,
  toggleFocusMode: () => set(state => ({ isFocusMode: !state.isFocusMode })),
  setFocusMode: (isFocusMode: boolean) => set({ isFocusMode }),
}));
