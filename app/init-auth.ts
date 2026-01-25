// Initialize authentication as the very first thing
// Uses /api/timetable endpoint which is faster and already performs auth checks
// Returns quickly regardless of whether it's a school day or not

export async function initAuthBlocking() {
  // If we're on the server, skip
  if (typeof window === 'undefined') return;

  // If another script already set the auth state (e.g. head-script after OAuth), skip re-fetching
  if (sessionStorage.getItem('synchron:userinfo-ready') === 'true') {
    console.log('[init-auth] userinfo-ready already set, skipping fetch to avoid overwrite');
    return;
  }

  // Get today's date in YYYY/MM/DD format
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}/${month}/${day}`;

  // Fetch timetable for today - this checks auth faster than /api/portal/userinfo
  try {
    const startTime = Date.now();
    console.log(`[init-auth] ⏳ Fetching /api/timetable?date=${dateStr}`);
    
    const res = await fetch(`/api/timetable?date=${dateStr}`, {
      method: 'GET',
      credentials: 'include',
    });
    
    const data = await res.json();
    
    // Check if authenticated by looking for "Unauthorized" error message
    // Authenticated: returns timetable data (even if noTimetable=true for non-school days)
    // Not authenticated: returns {"upstream":{"day":{"status":"error","message":"Unauthorized"},...}}
    const isLoggedIn = !(data?.upstream?.day?.message === 'Unauthorized');
    const elapsed = Date.now() - startTime;

    console.log(`[init-auth] ✓ Auth check in ${elapsed}ms:`, isLoggedIn);

    // Cache the result
    sessionStorage.setItem('synchron:user-logged-in', isLoggedIn ? 'true' : 'false');
    sessionStorage.setItem('synchron:userinfo-ready', 'true');
  } catch (err) {
    console.error('[init-auth] ✗ Error checking auth:', err);
    sessionStorage.setItem('synchron:user-logged-in', 'false');
    sessionStorage.setItem('synchron:userinfo-ready', 'true');
  }
}
