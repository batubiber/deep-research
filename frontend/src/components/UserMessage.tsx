import { User } from 'lucide-react'

interface Props {
  query: string
}

export function UserMessage({ query }: Props) {
  return (
    <div className="flex gap-3 animate-message-enter">
      <div className="w-8 h-8 rounded-full bg-[#1f6feb] flex items-center justify-center flex-shrink-0 mt-0.5">
        <User className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0 pt-1">
        <p className="text-[#e6edf3] text-sm leading-relaxed whitespace-pre-wrap">{query}</p>
      </div>
    </div>
  )
}
