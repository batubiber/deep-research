import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { Send, Square } from 'lucide-react'

interface Props {
  onSend: (query: string) => void
  onStop: () => void
  isRunning: boolean
}

export function ChatInput({ onSend, onStop, isRunning }: Props) {
  const [value, setValue] = useState('')

  const submit = () => {
    const q = value.trim()
    if (!q || isRunning) return
    onSend(q)
    setValue('')
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (isRunning) {
      onStop()
    } else {
      submit()
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="border-t border-[#30363d] bg-[#161b22]/80 backdrop-blur-sm px-4 py-3">
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex items-center gap-2">
        <textarea
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Send a message..."
          disabled={isRunning}
          rows={1}
          className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-xl px-4 py-2.5 text-sm text-[#e6edf3] placeholder-[#484f58] resize-none focus:outline-none focus:border-[#388bfd] focus:ring-1 focus:ring-[#388bfd]/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        />
        {isRunning ? (
          <button
            type="button"
            onClick={onStop}
            className="flex items-center justify-center w-9 h-9 bg-[#da3633] hover:bg-[#f85149] text-white rounded-lg transition-colors flex-shrink-0"
          >
            <Square className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!value.trim()}
            className="flex items-center justify-center w-9 h-9 bg-[#1f6feb] hover:bg-[#388bfd] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        )}
      </form>
    </div>
  )
}
