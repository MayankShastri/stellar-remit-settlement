import { Component } from 'react'

/**
 * React error boundary — a rendering crash degrades to a recoverable
 * panel instead of a blank page (production-architecture requirement).
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Unknown error' }
  }

  componentDidCatch(error, info) {
    console.error('Unhandled render error:', error, info)
  }

  handleReload = () => window.location.reload()

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4">
        <div className="relative max-w-md rounded-md border border-zinc-800 bg-black p-8 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.18rem] text-red-500">
            Something went wrong
          </p>
          <h1 className="mt-3 text-lg font-semibold tracking-tight text-white">
            The console hit an unexpected state
          </h1>
          <p className="mt-2 break-all font-mono text-xs leading-5 text-zinc-500">
            {this.state.message}
          </p>
          <button
            onClick={this.handleReload}
            className="mt-6 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black transition-colors duration-150 hover:bg-zinc-200"
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}
