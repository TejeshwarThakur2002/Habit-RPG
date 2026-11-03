import { useEffect, useState } from 'react';

/** The time, moved on each minute, so "5 min ago" text stays current while a screen is open. */
export function useMinuteClock(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
