import { Component, type ReactNode } from 'react'
import { FlaskConical, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: string
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: '' }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error.message }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: '' })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center bg-[#F5F5F5] dark:bg-[#0d1117]">
          <div className="max-w-md text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-[#3d1218] flex items-center justify-center mx-auto mb-5">
              <FlaskConical className="w-8 h-8 text-red-500 dark:text-[#f85149]" />
            </div>
            <h1 className="text-xl font-bold text-[#1A1A2E] dark:text-[#e6edf3] mb-2">
              Something went wrong
            </h1>
            <p className="text-sm text-[#6B7280] dark:text-[#8b949e] mb-1">
              The application encountered an unexpected error.
            </p>
            <p className="text-xs text-[#9CA3AF] dark:text-[#484f58] mb-6 font-mono break-all">
              {this.state.error}
            </p>
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#4A6CF7] hover:bg-[#3B5DE7] text-white text-sm font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reload App
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
