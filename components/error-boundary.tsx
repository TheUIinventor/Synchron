"use client"

import React from "react"

type State = { hasError: boolean; error?: Error | null }

export default class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: any) {
    try { console.error("ErrorBoundary caught:", error, info) } catch (e) {}
  }

  handleClearCaches = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        for (const r of regs) {
          try { await r.unregister() } catch (e) {}
        }
      }
      if (typeof caches !== 'undefined') {
        const keys = await caches.keys()
        for (const k of keys) {
          try { await caches.delete(k) } catch (e) {}
        }
      }
      try { sessionStorage.setItem('synchron:sw-unregistered', 'true') } catch (e) {}
      // reload to fetch fresh assets
      location.reload()
    } catch (e) {
      try { console.error(e) } catch (e) {}
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children as React.ReactElement

    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-xl w-full bg-surface rounded-md p-6 shadow">
          <h2 className="text-lg font-semibold">Application error</h2>
          <p className="mt-3 text-sm text-on-surface-variant">A client-side exception occurred. We attempted to catch it so you can continue using the app.</p>
          <pre className="mt-4 p-3 bg-surface-container-high rounded text-xs overflow-auto">{String(this.state.error)}</pre>
          <div className="mt-4 flex gap-3">
            <button className="px-3 py-2 bg-primary text-on-primary rounded" onClick={this.handleClearCaches}>Clear caches & reload</button>
            <button className="px-3 py-2 bg-surface text-on-surface rounded" onClick={() => location.reload()}>Reload</button>
          </div>
          <p className="mt-2 text-xs text-on-surface-variant">If clearing caches doesn't help, run the app locally with `pnpm dev` and check the console for the full stack trace.</p>
        </div>
      </div>
    )
  }
}
