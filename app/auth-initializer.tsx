'use client';

import { useEffect } from 'react';
import { initAuthBlocking } from './init-auth';

export default function AuthInitializer({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize auth BEFORE anything else
    initAuthBlocking();
  }, []);

  return <>{children}</>;
}
