import { useEffect, useState } from 'react';

/**
 * Re-render every minute so anything using relative timestamps
 * (`fmtRelative`) stays fresh without manual refresh.
 */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}
