// Initialize authentication as the very first thing
// This runs BEFORE any other code and blocks all subsequent API calls until done

export async function initAuthBlocking() {
  // If we're on the server, skip
  if (typeof window === 'undefined') return;

  // Check if already initialized
  if (sessionStorage.getItem('synchron:userinfo-ready') === 'true') {
    return;
  }

  // Fetch userinfo FIRST and WAIT
  try {
    console.log('[init-auth] Fetching /api/portal/userinfo FIRST');
    const res = await fetch('/api/portal/userinfo', {
      method: 'GET',
      credentials: 'include',
    });
    const data = await res.json();
    const isLoggedIn = data?.success === true;

    console.log('[init-auth] ✓ Auth initialized:', isLoggedIn);

    // Cache the result
    sessionStorage.setItem('synchron:user-logged-in', isLoggedIn ? 'true' : 'false');
    if (isLoggedIn && data?.data?.givenName) {
      sessionStorage.setItem('synchron:user-name', data.data.givenName);
    }
    sessionStorage.setItem('synchron:userinfo-ready', 'true');
  } catch (err) {
    console.error('[init-auth] Error:', err);
    sessionStorage.setItem('synchron:user-logged-in', 'false');
    sessionStorage.setItem('synchron:userinfo-ready', 'true');
  }
}
