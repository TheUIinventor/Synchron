"use client"

import React from "react"

type Props = { children: React.ReactNode }
type State = { hasError: boolean; error?: Error | null }

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log error for diagnostics — keep this minimal and safe for CI
    try {
      // eslint-disable-next-line no-console
      console.error('[ErrorBoundary] caught error', error, info)
    } catch (e) {}
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" style={{ padding: 24, borderRadius: 12, background: 'linear-gradient(180deg, #fff, #f8fafc)', color: '#111' }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Something went wrong</h2>
          <p style={{ marginTop: 8, marginBottom: 0, color: '#374151' }}>An unexpected error occurred while rendering the app. Try refreshing the page.</p>
        </div>
      )
    }

    return this.props.children
  }
}
