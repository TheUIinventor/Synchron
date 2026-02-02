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

  // OPTIMIZATION: Use aggressive timeout to fail fast if SBHS API is slow
  // This prevents auth check from blocking the page for 5-10 minutes
  const abortController = new AbortController();
  const timeoutMs = 6000; // 6 second timeout
  const timeout = setTimeout(() => abortController.abort(), timeoutMs);

  // Fetch timetable for today - this checks auth faster than /api/portal/userinfo
  try {
    const startTime = Date.now();
    console.log(`[init-auth] ⏳ Fetching /api/timetable?date=${dateStr}`);
    
    const res = await fetch(`/api/timetable?date=${dateStr}`, {
      method: 'GET',
      credentials: 'include',
      signal: abortController.signal,
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
    try {
      // Notify other parts of the app in the same window that auth cache is ready
      window.dispatchEvent(new CustomEvent('synchron:userinfo-ready'))
    } catch (e) {}
  } catch (err) {
    console.error('[init-auth] ✗ Error checking auth:', err);
    // On timeout or error, assume not logged in
    sessionStorage.setItem('synchron:user-logged-in', 'false');
    sessionStorage.setItem('synchron:userinfo-ready', 'true');
    try {
      window.dispatchEvent(new CustomEvent('synchron:userinfo-ready'))
    } catch (e) {}
  } finally {
    clearTimeout(timeout);
  }
}
