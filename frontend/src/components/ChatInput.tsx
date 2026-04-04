import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { Send } from 'lucide-react'
import Loader from '@/components/ui/loader-4'

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
    <div className="px-4 py-4">
      <form
        onSubmit={handleSubmit}
        className="max-w-3xl mx-auto flex items-center gap-3"
      >
        {/* Neumorphic inset input — 50px height */}
        <div className="flex-1 neu-pressed-deep px-5 h-[50px] flex items-center bg-[var(--neu-bg)]">
          <textarea
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What would you like to research?..."
            disabled={isRunning}
            rows={1}
            className="w-full bg-transparent border-none text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] resize-none focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed leading-normal"
          />
        </div>

        {/* Neumorphic send/stop button — 50x50 square */}
        {isRunning ? (
          <button
            type="button"
            onClick={onStop}
            className="neu-btn flex items-center justify-center w-[50px] h-[50px] transition-colors flex-shrink-0"
          >
            <Loader />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!value.trim()}
            className="btn-primary-glow flex items-center justify-center w-[50px] h-[50px] disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none flex-shrink-0"
          >
            <Send className="w-5 h-5" />
          </button>
        )}
      </form>
    </div>
  )
}
