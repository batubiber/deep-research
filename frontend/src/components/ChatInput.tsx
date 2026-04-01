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
    <div className="px-4 py-3">
      <form
        onSubmit={handleSubmit}
        className="max-w-3xl mx-auto flex items-center gap-2 bg-white dark:bg-[#161b22] border border-[#E5E7EB] dark:border-[#30363d] rounded-2xl px-3 py-1.5 shadow-sm dark:shadow-none transition-colors"
      >
        <textarea
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What's in your mind?..."
          disabled={isRunning}
          rows={1}
          className="flex-1 bg-transparent border-none px-2 py-2 text-sm text-[#1A1A2E] dark:text-[#e6edf3] placeholder-[#9CA3AF] dark:placeholder-[#484f58] resize-none focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
        />

        {isRunning ? (
          <button
            type="button"
            onClick={onStop}
            className="flex items-center justify-center w-9 h-9 bg-red-500 hover:bg-red-600 dark:bg-[#da3633] dark:hover:bg-[#f85149] text-white rounded-full transition-colors flex-shrink-0"
          >
            <Square className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!value.trim()}
            className="flex items-center justify-center w-9 h-9 bg-[#4A6CF7] hover:bg-[#3B5DE7] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-full transition-colors flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        )}
      </form>
    </div>
  )
}
