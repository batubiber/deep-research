import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { Search, Loader2 } from 'lucide-react'

interface Props {
  onSearch: (query: string) => void
  isRunning: boolean
}

export function SearchBar({ onSearch, isRunning }: Props) {
  const [value, setValue] = useState('')

  const submit = () => {
    const q = value.trim()
    if (!q || isRunning) return
    onSearch(q)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    submit()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-end">
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-[#484f58] pointer-events-none" />
        <textarea
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What do you want to research? (Enter to submit, Shift+Enter for new line)"
          disabled={isRunning}
          rows={2}
          className="w-full bg-[#161b22] border border-[#30363d] rounded-lg pl-9 pr-3 py-2.5 text-sm text-[#e6edf3] placeholder-[#484f58] resize-none focus:outline-none focus:border-[#388bfd] focus:ring-1 focus:ring-[#388bfd]/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        />
      </div>
      <button
        type="submit"
        disabled={!value.trim() || isRunning}
        className="flex items-center gap-2 px-4 py-2.5 bg-[#1f6feb] hover:bg-[#388bfd] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex-shrink-0"
      >
        {isRunning ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Running</span>
          </>
        ) : (
          <>
            <Search className="w-4 h-4" />
            <span>Research</span>
          </>
        )}
      </button>
    </form>
  )
}
