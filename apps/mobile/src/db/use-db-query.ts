import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';

/**
 * Runs a synchronous query on the first render and again after every database change, so a
 * screen is complete on its first frame and repaints right after each write (D18, D20).
 */
export function useDbQuery<T>(read: () => T): T {
  const [value, setValue] = useState(read);
  const latestRead = useRef(read);
  useEffect(() => {
    latestRead.current = read;
  });
  useEffect(() => {
    const subscription = addDatabaseChangeListener(() => setValue(latestRead.current()));
    return () => subscription.remove();
  }, []);
  return value;
}
