import { createContext, useContext, type ReactNode } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

/** The in-app Reduce Motion setting (SCOPE.md F10): follow the system, or force on or off. */
export type ReduceMotionSetting = 'system' | 'on' | 'off';

const ReduceMotionContext = createContext<ReduceMotionSetting>('system');

export function ReduceMotionProvider(props: { value: ReduceMotionSetting; children: ReactNode }) {
  return (
    <ReduceMotionContext.Provider value={props.value}>
      {props.children}
    </ReduceMotionContext.Provider>
  );
}

/** True when animations should be skipped and state changes shown instantly. */
export function useReduceMotion(): boolean {
  const setting = useContext(ReduceMotionContext);
  const system = useReducedMotion();
  return setting === 'system' ? system : setting === 'on';
}
