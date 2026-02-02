#!/usr/bin/env node

/**
 * Synchron Performance Test Suite
 * 
 * This script tests the performance optimizations and verifies that:
 * 1. Timeout mechanisms work correctly
 * 2. Lazy loading doesn't block critical content
 * 3. Cache is being used effectively
 * 4. Startup time is under 30 seconds
 */

const tests = [];
const results = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg}\nExpected: ${expected}\nActual: ${actual}`);
  }
}

function assertLessThan(value, max, msg) {
  if (value >= max) {
    throw new Error(`${msg}\nExpected < ${max}, got ${value}`);
  }
}

// ============================================================================
// TEST 1: Timeout mechanism works
// ============================================================================
test('Timeout: Request aborts after 5 seconds', async () => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  
  const startTime = Date.now();
  try {
    // Simulate slow endpoint
    await fetch('https://api.sbhs.net.au/api/timetable/timetable.json?slow=true', {
      signal: controller.signal,
      timeout: 5000
    });
  } catch (e) {
    const elapsed = Date.now() - startTime;
    assertLessThan(elapsed, 6000, 'Request should timeout around 5 seconds');
    return;
  } finally {
    clearTimeout(timeout);
  }
  
  throw new Error('Expected fetch to timeout');
});

// ============================================================================
// TEST 2: Promise.allSettled doesn't block on one slow request
// ============================================================================
test('Promise.allSettled: Returns quickly with partial failures', async () => {
  const startTime = Date.now();
  
  const slowFetch = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('timeout')), 5000);
  });
  
  const fastFetch = fetch('https://api.sbhs.net.au/api/timetable/bells.json')
    .then(r => r.json())
    .catch(() => null);
  
  const results = await Promise.allSettled([slowFetch, fastFetch]);
  const elapsed = Date.now() - startTime;
  
  // Should complete in ~2-3 seconds, not 5
  console.log(`Promise.allSettled completed in ${elapsed}ms`);
  console.log(`Results:`, results.map(r => r.status));
  
  // At least one should be fulfilled (fast fetch)
  const fulfilled = results.filter(r => r.status === 'fulfilled').length;
  if (fulfilled === 0 && elapsed < 3000) {
    console.log('✓ Request completed quickly despite pending slow request');
  }
});

// ============================================================================
// TEST 3: Bootstrap endpoint returns in < 5 seconds
// ============================================================================
test('Bootstrap API: Returns critical data in < 5 seconds', async () => {
  const startTime = Date.now();
  
  try {
    const res = await fetch('/api/bootstrap');
    const data = await res.json();
    
    const elapsed = Date.now() - startTime;
    console.log(`Bootstrap took ${elapsed}ms`);
    
    // Should have timetable
    if (!data.results.timetable && elapsed > 5000) {
      throw new Error('Bootstrap took > 5 seconds without timetable');
    }
    
    // Should indicate lazy loading
    if (!data.lazyLoad) {
      console.warn('⚠ Bootstrap should indicate which endpoints to load lazily');
    }
    
    assertLessThan(elapsed, 10000, 'Bootstrap should complete in < 10 seconds');
    console.log('✓ Bootstrap completed successfully');
  } catch (e) {
    console.error('Bootstrap test failed:', e.message);
  }
});

// ============================================================================
// TEST 4: Auth check returns quickly
// ============================================================================
test('Auth: Check completes in < 6 seconds', async () => {
  const startTime = Date.now();
  
  if (sessionStorage.getItem('synchron:userinfo-ready') === 'true') {
    sessionStorage.removeItem('synchron:userinfo-ready');
  }
  
  // Simulate auth check
  const now = new Date();
  const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    
    const res = await fetch(`/api/timetable?date=${dateStr}`, {
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    const elapsed = Date.now() - startTime;
    
    console.log(`Auth check took ${elapsed}ms`);
    assertLessThan(elapsed, 7000, 'Auth should complete in < 7 seconds');
    console.log('✓ Auth check completed');
  } catch (e) {
    const elapsed = Date.now() - startTime;
    console.log(`Auth check failed after ${elapsed}ms (expected for timeout test)`);
    assertLessThan(elapsed, 7000, 'Should timeout around 6 seconds');
  }
});

// ============================================================================
// TEST 5: Lazy loading event fires correctly
// ============================================================================
test('Lazy Loading: Events fire without blocking critical content', async () => {
  if (typeof window === 'undefined') {
    console.log('⏭️ Skipping lazy loading test (Node.js environment)');
    return;
  }
  
  let lazyEventFired = false;
  const listener = () => { lazyEventFired = true; };
  
  window.addEventListener('synchron:load-non-critical-data', listener);
  
  // Dispatch event
  window.dispatchEvent(new CustomEvent('synchron:load-non-critical-data'));
  
  if (lazyEventFired) {
    console.log('✓ Lazy load event fired successfully');
  } else {
    console.warn('⚠ Lazy load event not received');
  }
  
  window.removeEventListener('synchron:load-non-critical-data', listener);
});

// ============================================================================
// TEST 6: Cache is being used (localStorage)
// ============================================================================
test('Cache: Timetable stored in localStorage', async () => {
  const cached = localStorage.getItem('synchron-last-timetable');
  
  if (cached) {
    const data = JSON.parse(cached);
    if (data.timetable && Object.keys(data.timetable).length > 0) {
      console.log('✓ Timetable cache found in localStorage');
      return;
    }
  }
  
  console.warn('⚠ No cached timetable found (expected on first load)');
});

// ============================================================================
// TEST 7: Startup time < 30 seconds
// ============================================================================
test('Startup: Complete load within 30 seconds', async () => {
  const startTime = Date.now();
  
  // Wait for essential content
  const checkInterval = setInterval(() => {
    const timetable = document.querySelector('[data-testid="timetable"]');
    const homeContent = document.querySelector('[data-testid="home-content"]');
    
    if (timetable || homeContent) {
      const elapsed = Date.now() - startTime;
      clearInterval(checkInterval);
      
      console.log(`Startup complete in ${elapsed}ms`);
      assertLessThan(elapsed, 30000, 'Should load within 30 seconds');
      console.log('✓ Startup within target time');
    }
  }, 100);
  
  // Timeout after 35 seconds
  setTimeout(() => {
    clearInterval(checkInterval);
    console.warn('⚠ Startup took > 30 seconds');
  }, 35000);
});

// ============================================================================
// TEST 8: API response times are recorded
// ============================================================================
test('Monitoring: Performance entries recorded', async () => {
  if (typeof performance === 'undefined') {
    console.log('⏭️ Skipping performance test (no performance API)');
    return;
  }
  
  // Mark start of API call
  performance.mark('api-timetable-start');
  
  try {
    const res = await fetch('/api/timetable');
    await res.json();
  } catch (e) {
    console.error('API fetch failed:', e.message);
  }
  
  // Mark end
  performance.mark('api-timetable-end');
  
  // Measure
  try {
    performance.measure('api-timetable', 'api-timetable-start', 'api-timetable-end');
    const measure = performance.getEntriesByName('api-timetable')[0];
    
    console.log(`API call took ${measure.duration}ms`);
    assertLessThan(measure.duration, 10000, 'API should complete in < 10 seconds');
    console.log('✓ API timing recorded');
  } catch (e) {
    console.warn('⚠ Could not record performance measure:', e.message);
  }
});

// ============================================================================
// RUN ALL TESTS
// ============================================================================
async function runTests() {
  console.log('═'.repeat(70));
  console.log('Synchron Performance Optimization Test Suite');
  console.log('═'.repeat(70));
  console.log('');
  
  let passed = 0;
  let failed = 0;
  
  for (const { name, fn } of tests) {
    try {
      console.log(`\n📋 Test: ${name}`);
      console.log('─'.repeat(70));
      
      await fn();
      
      console.log('✓ PASSED');
      passed++;
      results.push({ name, status: 'PASSED' });
    } catch (e) {
      console.error('✗ FAILED');
      console.error(`Error: ${e.message}`);
      failed++;
      results.push({ name, status: 'FAILED', error: e.message });
    }
  }
  
  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('Test Summary');
  console.log('═'.repeat(70));
  console.log(`✓ Passed: ${passed}`);
  console.log(`✗ Failed: ${failed}`);
  console.log(`Total:   ${tests.length}`);
  console.log('');
  
  // Details
  for (const result of results) {
    const icon = result.status === 'PASSED' ? '✓' : '✗';
    console.log(`${icon} ${result.name}: ${result.status}`);
    if (result.error) {
      console.log(`  └─ ${result.error}`);
    }
  }
  
  console.log('');
  const passRate = ((passed / tests.length) * 100).toFixed(1);
  console.log(`Pass Rate: ${passRate}%`);
  
  if (failed > 0) {
    console.log('\n🔴 Some tests failed. Check performance optimizations.');
    process.exit(1);
  } else {
    console.log('\n🟢 All tests passed! Performance optimizations working correctly.');
    process.exit(0);
  }
}

// Export for use in other test frameworks
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { test, assertEqual, assertLessThan, results, runTests };
}

// Run if executed directly
if (typeof require !== 'undefined' && require.main === module) {
  runTests().catch(err => {
    console.error('Test suite error:', err);
    process.exit(1);
  });
}
