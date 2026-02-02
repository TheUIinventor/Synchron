# Synchron Performance Optimization Guide

## Quick Wins Implemented ✅

### 1. **Fast Bootstrap API** (`/api/fast-bootstrap`)
- Returns ONLY critical data (timetable for today) in parallel
- Ignores calendar, awards, notices (loaded lazily)
- **Target: < 5 seconds**

### 2. **Timetable API Timeout Optimization**  
- Added aggressive request timeouts (5 seconds per endpoint)
- Changed from `Promise.all` to `Promise.allSettled` to prevent one slow request from blocking others
- Faster fallback mechanism when SBHS API is slow

### 3. **In-Memory Cache for Anonymous Requests**
- Public timetable requests cached for 30 seconds to reduce upstream load
- Significant reduction in duplicate requests from users hitting home page simultaneously

## High-Impact Changes to Implement

### A. **Lazy Load Non-Critical Data**
Current: Bootstrap loads ALL data (timetable + calendar + awards + notices)
Proposed: Load only timetable immediately, load others in background

**Files to modify:**
- `app/client-layout.tsx` - Remove heavy bootstrap, use lightweight version
- Add background refresh interval that loads calendar/awards/notices AFTER timetable renders
- Show "Notices loading..." skeleton instead of blocking on full data

### B. **Implement Skeleton/Placeholder UI**
Current: Blank loading spinner until data arrives
Proposed: Show structure with skeletons so page renders in <100ms

**Files to create:**
- `components/timetable-skeleton.tsx` - Render empty period boxes
- `components/home-skeleton.tsx` - Render next period card structure

**Impact:** User sees interactive UI in <500ms instead of waiting 30+ seconds

### C. **Reduce Timetable API Processing Time**
Current: `/api/timetable` does heavy JSON transformations (1-2 seconds processing)
Proposed: Return minimalist payload, let client process

**Optimization:**
```typescript
// Instead of returning fully normalized timetable, return raw upstream
// Client-side processor applies only needed transformations
return {
  raw: upstreamPayload,      // Raw SBHS API response
  belltimes: extracted,       // Pre-computed bell times only
  weekType: detected,
  // Skip: normalization, substitutions, color mapping
}
```

### D. **Browser Cache Headers Optimization**
Current: `max-age=0` (always revalidate)
Proposed: Longer cache for public timetables

```typescript
// For anonymous requests (no auth cookie)
'Cache-Control': 'public, s-maxage=60, max-age=300'  // 5 minute browser cache

// For authenticated requests  
'Cache-Control': 'private, max-age=60'  // 1 minute
```

### E. **Implement Streaming Responses**
For large calendar/awards responses, send data incrementally:

```typescript
// Instead of waiting for full payload
const chunks = [
  { type: 'timetable', data: ... },
  { type: 'belltimes', data: ... },
  { type: 'calendar', data: ... }  // Stream this separately
]

for (const chunk of chunks) {
  response.write(JSON.stringify(chunk) + '\n')
  await flush()  // Don't wait for all data
}
```

## Performance Targets

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Time to Home Load | 5-10 min | < 10s | 🔄 In Progress |
| Time to First Paint | 2-3 min | < 1s | 🟡 Blocked by API |
| Interactive Elements | 3-5 min | < 5s | 🟡 Blocked by API |
| Timetable Display | 5-10 min | < 10s | 🔄 In Progress |
| Background Refresh | Concurrent | Sequential | ✅ Done |

## Quick Configuration Options

### Enable Aggressive Mode (for demo/dev)
```javascript
// In browser console:
localStorage.setItem('synchron-aggressive-refresh', 'true')
localStorage.setItem('synchron:dev-logs', 'true')
```

### Force Cache Clear
```javascript
sessionStorage.setItem('synchron:do-emergency', 'true')
// Page will clear all caches and reload
```

### Monitor Performance
```javascript
// Check latest fetch times
localStorage.getItem('synchron-last-timetable')  // Check timestamp
performance.measure('timetable-load')  // Check browser metrics
```

## Deployment Checklist

- [ ] Deploy optimized `/api/fast-bootstrap` endpoint
- [ ] Deploy timeout-aware `/api/timetable` changes  
- [ ] Verify cache headers are applied correctly
- [ ] Test with network throttling (3G slow)
- [ ] Monitor upstream API response times
- [ ] Implement CDN caching for static timetables
- [ ] Add monitoring/alerting for p95 load times

## Next Steps

1. **Immediate (this sprint):**
   - Implement lazy loading of non-critical data
   - Add skeleton screens for instant UI feedback
   - Reduce API response payloads

2. **Short-term (next sprint):**
   - Implement streaming responses  
   - Add HTTP/2 push for frequently accessed endpoints
   - Optimize client-side JSON parsing (use more compact format)

3. **Long-term:**
   - Migrate to GraphQL for flexible payload selection
   - Implement service worker with aggressive offline-first caching
   - Add predictive prefetching based on time of day

## Debug Commands

```bash
# Check API response times
curl -w '@curl-format.txt' -o /dev/null -s https://api.sbhs.net.au/api/timetable/daytimetable.json

# Monitor network waterfall
Chrome DevTools → Network → WaterFall view

# Check cache effectiveness
localStorage.keys() | grep synchron-
```

## Key Metrics to Monitor

- **TTFB (Time to First Byte):** Should be < 500ms
- **FCP (First Contentful Paint):** Should be < 1s  
- **LCP (Largest Contentful Paint):** Should be < 3s
- **TTI (Time to Interactive):** Should be < 5s
- **API Response P95:** Should be < 3s (currently 5-10s)

---

**Status:** 🔄 In Active Development
**Last Updated:** Feb 2, 2026
