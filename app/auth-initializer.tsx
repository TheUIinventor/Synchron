'use client';

import { useEffect, useState } from 'react';
import { initAuthBlocking } from './init-auth';

export default function AuthInitializer({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Initialize auth immediately when component mounts
    console.log('[AuthInitializer] Mounting, starting auth init');
    (async () => {
      await initAuthBlocking();
      setReady(true);
    })();
  }, []);

  // Render children immediately - don't wait for auth
  // Auth is fetching in the background
  return <>{children}</>;
}
