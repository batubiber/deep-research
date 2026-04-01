import { useRef, useEffect, useCallback, useLayoutEffect } from 'react'
import { animate, stagger } from 'animejs'
import {
  FlaskConical, FileText, FileDown, RefreshCw, PlusCircle,
  GraduationCap, BarChart3, Cpu, BookOpen, ShieldCheck, TrendingUp,
} from 'lucide-react'
import { UserMessage } from './UserMessage'
import { AgentMessage } from './AgentMessage'
import { ChatInput } from './ChatInput'
import type { ChatMessage } from '../types'

interface Props {
  messages: ChatMessage[]
  error: string | null
  onSendMessage: (query: string) => void
  onStop: () => void
  onNew: () => void
  isRunning: boolean
}

// --- Export helpers ---

const PRINT_STYLES = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; line-height: 1.7; }
  h1 { font-size: 2em; border-bottom: 2px solid #eee; padding-bottom: 0.3em; margin-top: 1em; }
  h2 { font-size: 1.5em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; margin-top: 1em; }
  h3 { font-size: 1.25em; margin-top: 1em; }
  h4 { font-size: 1.1em; margin-top: 0.8em; }
  p { margin: 0.75em 0; }
  pre { background: #f6f8fa; padding: 16px; border-radius: 6px; overflow-x: auto; }
  code { background: #f0f0f0; padding: 2px 6px; border-radius: 4px; font-size: 0.88em; font-family: 'SFMono-Regular', Consolas, monospace; }
  pre code { background: none; padding: 0; }
  a { color: #0969da; }
  ul, ol { padding-left: 1.5em; margin: 0.5em 0; }
  li { margin: 0.25em 0; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid #d0d7de; padding: 8px 12px; text-align: left; }
  th { background: #f6f8fa; font-weight: 600; }
  blockquote { border-left: 4px solid #d0d7de; margin: 1em 0; padding-left: 16px; color: #57606a; }
  hr { border: none; border-top: 1px solid #eee; margin: 1.5em 0; }
  .section-label { font-size: 0.7em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #888; margin-bottom: 4px; }
  @media print { body { margin: 0 20px; } }
`

function buildFullMarkdown(messages: ChatMessage[]): string {
  const parts: string[] = []

  for (const msg of messages) {
    if (msg.role === 'user') {
      parts.push(`# Research Query\n\n> ${msg.data.query}`)
      continue
    }

    if (msg.status !== 'done' || !msg.data || Object.keys(msg.data).length <= 1) continue

    const { agentName, data } = msg

    if (!agentName && data?.node === '__done__') continue

    switch (agentName) {
      case 'planner': {
        const sqs = (data.sub_questions ?? []) as Array<{ id: number; question: string; suggested_tool: string }>
        parts.push(
          `---\n\n## Planner\n\n` +
          (data.main_question ? `**Main Question:** ${data.main_question}\n\n` : '') +
          (data.complexity ? `**Complexity:** ${data.complexity}\n\n` : '') +
          (sqs.length > 0
            ? `**Sub-Questions:**\n${sqs.map(sq => `${sq.id}. ${sq.question} *(${sq.suggested_tool})*`).join('\n')}`
            : '')
        )
        break
      }
      case 'research_assistant': {
        const sources = (data.sources ?? []) as Array<{ title: string; url: string }>
        parts.push(
          `---\n\n## Researcher — Sub-Question ${data.sub_question_id ?? ''}\n\n` +
          (data.sub_question ? `**Question:** ${data.sub_question}\n\n` : '') +
          (data.analysis ? `${data.analysis}\n\n` : '') +
          (sources.length > 0
            ? `**Sources:**\n${sources.map(s => `- [${s.title}](${s.url})`).join('\n')}`
            : '')
        )
        break
      }
      case 'analyst': {
        if (data.analysis) parts.push(`---\n\n## Analyst\n\n${data.analysis}`)
        break
      }
      case 'reviewer': {
        const gaps = (data.gaps ?? []) as string[]
        parts.push(
          `---\n\n## Reviewer\n\n` +
          (data.score != null ? `**Quality Score:** ${data.score}/10\n\n` : '') +
          (data.full_review ? `${data.full_review}\n\n` : '') +
          (gaps.length > 0
            ? `**Identified Gaps:**\n${gaps.map((g, i) => `${i + 1}. ${g}`).join('\n')}`
            : '')
        )
        break
      }
      case 'gap_researcher': {
        const gapSources = (data.gap_sources ?? []) as Array<{ title: string; url: string }>
        parts.push(
          `---\n\n## Gap Researcher\n\n` +
          (data.gap_findings ? `${data.gap_findings}\n\n` : '') +
          (gapSources.length > 0
            ? `**New Sources:**\n${gapSources.map(s => `- [${s.title}](${s.url})`).join('\n')}`
            : '')
        )
        break
      }
      case 'writer': {
        if (data.report) parts.push(`---\n\n## Final Report\n\n${data.report}`)
        break
      }
    }
  }

  const doneMsg = messages.find(m => !m.agentName && m.data?.node === '__done__' && m.data?.report)
  if (doneMsg && !messages.some(m => m.agentName === 'writer' && m.data?.report)) {
    parts.push(`---\n\n## Final Report\n\n${doneMsg.data.report}`)
  }

  return parts.join('\n\n')
}

function mdToBasicHtml(md: string): string {
  return md
    .replace(/^---$/gm, '<hr>')
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/```[\w]*\n([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/\n\n+/g, '</p><p>')
    .replace(/^([^<\n].*)$/gm, (line) => line.trim() ? line : '')
    .replace(/^<p>(<h[1-6]|<hr|<pre|<blockquote|<li)/gm, '$1')
    .replace(/(<\/h[1-6]>|<\/pre>|<\/blockquote>)<\/p>/g, '$1')
}

function ExportButtons({ messages }: { messages: ChatMessage[] }) {
  const isDone = messages.some(m => m.data?.node === '__done__' && m.data?.report)
  if (!isDone) return null

  const handleDownloadMd = () => {
    const md = buildFullMarkdown(messages)
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'research-report.md'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadPdf = () => {
    const md = buildFullMarkdown(messages)
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Research Report</title>
  <style>${PRINT_STYLES}</style>
</head>
<body><p>${mdToBasicHtml(md)}</p></body>
</html>`)
    printWindow.document.close()
    setTimeout(() => { printWindow.print() }, 250)
  }

  return (
    <div className="flex gap-2 px-4 pb-2 pt-1 border-t border-[#E5E7EB] dark:border-[#30363d]">
      <button
        onClick={handleDownloadMd}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-white dark:bg-[#161b22] border border-[#E5E7EB] dark:border-[#30363d] text-[#374151] dark:text-[#c9d1d9] hover:bg-[#F5F5F5] dark:hover:bg-[#21262d] hover:border-[#9CA3AF] dark:hover:border-[#8b949e] transition-colors shadow-sm dark:shadow-none"
      >
        <FileText className="w-3.5 h-3.5" />
        Export MD
      </button>
      <button
        onClick={handleDownloadPdf}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-white dark:bg-[#161b22] border border-[#E5E7EB] dark:border-[#30363d] text-[#374151] dark:text-[#c9d1d9] hover:bg-[#F5F5F5] dark:hover:bg-[#21262d] hover:border-[#9CA3AF] dark:hover:border-[#8b949e] transition-colors shadow-sm dark:shadow-none"
      >
        <FileDown className="w-3.5 h-3.5" />
        Export PDF
      </button>
    </div>
  )
}

// --- Capability cards ---

const CAPABILITIES = [
  {
    icon: GraduationCap,
    title: 'Academic Research',
    description: 'Find peer-reviewed papers on quantum computing advances',
    dark: false,
  },
  {
    icon: BarChart3,
    title: 'Market Analysis',
    description: 'Analyze the competitive landscape of EV battery manufacturers',
    dark: false,
  },
  {
    icon: Cpu,
    title: 'Technical Deep Dive',
    description: 'How does transformer architecture handle long-context inference?',
    dark: true,
  },
  {
    icon: BookOpen,
    title: 'Literature Review',
    description: 'Summarize recent findings on CRISPR gene therapy safety',
    dark: false,
  },
  {
    icon: ShieldCheck,
    title: 'Fact Checking',
    description: 'Verify claims about renewable energy cost trends',
    dark: false,
  },
  {
    icon: TrendingUp,
    title: 'Trend Analysis',
    description: 'What are the emerging trends in edge AI deployment?',
    dark: true,
  },
]

function EmptyState({ onCardClick }: { onCardClick: (query: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return

    const badge = el.querySelector('[data-anim="badge"]') as HTMLElement
    const greeting = el.querySelector('[data-anim="greeting"]') as HTMLElement
    const cards = el.querySelectorAll('[data-anim="card"]')

    // Set initial hidden state synchronously to prevent flash
    if (badge) { badge.style.opacity = '0'; badge.style.transform = 'scale(0.5)' }
    if (greeting) { greeting.style.opacity = '0'; greeting.style.transform = 'translateY(20px)' }
    cards.forEach(c => {
      const card = c as HTMLElement
      card.style.opacity = '0'
      card.style.transform = 'translateY(30px) scale(0.95)'
    })

    // Badge — elastic scale-in
    animate(badge, {
      opacity: [0, 1],
      scale: [0.5, 1],
      duration: 500,
      ease: 'outElastic(1, 0.6)',
    })

    // Greeting — fade up
    animate(greeting, {
      opacity: [0, 1],
      translateY: [20, 0],
      duration: 600,
      ease: 'outExpo',
      delay: 200,
    })

    // Cards — staggered entrance
    animate(cards, {
      opacity: [0, 1],
      translateY: [30, 0],
      scale: [0.95, 1],
      duration: 500,
      ease: 'outExpo',
      delay: stagger(80, { start: 450 }),
    })
  }, [])

  return (
    <div ref={containerRef} className="flex-1 flex flex-col items-center justify-center gap-6 text-center p-8">
      {/* Badge */}
      <span data-anim="badge" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#4A6CF7]/10 dark:bg-[#1f6feb]/15 text-xs font-semibold text-[#4A6CF7] dark:text-[#58a6ff]">
        <FlaskConical className="w-3.5 h-3.5" />
        DeepResearch
      </span>

      {/* Greeting */}
      <h1 data-anim="greeting" className="text-2xl md:text-3xl font-bold text-[#1A1A2E] dark:text-[#e6edf3]">
        Good day! How may I assist you today?
      </h1>

      {/* Capability cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-3xl w-full mt-2">
        {CAPABILITIES.map(cap => (
          <button
            key={cap.title}
            data-anim="card"
            onClick={() => onCardClick(cap.description)}
            className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
              cap.dark
                ? 'bg-[#1A1A2E] dark:bg-[#161b22] border-[#1A1A2E] dark:border-[#30363d] text-white hover:bg-[#2a2a3e] dark:hover:bg-[#21262d]'
                : 'bg-white dark:bg-[#0d1117] border-[#E5E7EB] dark:border-[#30363d] hover:shadow-md dark:hover:border-[#388bfd]/30 hover:border-[#4A6CF7]/30'
            }`}
          >
            <cap.icon className={`w-5 h-5 mb-2 ${
              cap.dark ? 'text-white' : 'text-[#4A6CF7] dark:text-[#58a6ff]'
            }`} />
            <p className={`text-sm font-semibold mb-1 ${
              cap.dark ? 'text-white' : 'text-[#1A1A2E] dark:text-[#e6edf3]'
            }`}>
              {cap.title}
            </p>
            <p className={`text-xs leading-relaxed ${
              cap.dark ? 'text-gray-300' : 'text-[#6B7280] dark:text-[#8b949e]'
            }`}>
              {cap.description}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}

export function ChatArea({ messages, error, onSendMessage, onStop, onNew, isRunning }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const isNearBottom = useRef(true)

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    isNearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100
  }, [])

  const lastMsgStatus = messages.length > 0 ? messages[messages.length - 1].status : undefined
  useEffect(() => {
    if (isNearBottom.current && scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [messages.length, lastMsgStatus])

  const hasMessages = messages.length > 0

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Message list */}
      {hasMessages ? (
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto"
        >
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {messages.map(msg => {
              if (msg.role === 'user') {
                return <UserMessage key={msg.id} query={msg.data.query ?? ''} />
              }
              if (!msg.agentName && msg.data?.node === '__done__' && !msg.data?.report) {
                return null
              }
              if (msg.agentName === 'writer' && msg.status === 'done' && !msg.data?.report) {
                return null
              }
              return <AgentMessage key={msg.id} message={msg} />
            })}

            {error && (
              <div className="flex gap-3 animate-message-enter">
                <div className="w-8 h-8 rounded-full bg-red-50 dark:bg-[#3d1218] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <FlaskConical className="w-4 h-4 text-red-500 dark:text-[#f85149]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-red-500 dark:text-[#f85149] font-medium">Research failed</p>
                  <p className="text-xs text-[#6B7280] dark:text-[#8b949e] mt-1">{error}</p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => {
                        const userMsg = messages.find(m => m.role === 'user')
                        if (userMsg?.data?.query) onSendMessage(userMsg.data.query)
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-[#4A6CF7] hover:bg-[#3B5DE7] text-white transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Try Again
                    </button>
                    <button
                      onClick={onNew}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-[#E5E7EB] dark:border-[#30363d] text-[#374151] dark:text-[#c9d1d9] bg-white dark:bg-[#161b22] hover:bg-[#F5F5F5] dark:hover:bg-[#21262d] transition-colors"
                    >
                      <PlusCircle className="w-3 h-3" />
                      New Research
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <EmptyState onCardClick={onSendMessage} />
      )}

      {/* Export buttons */}
      <ExportButtons messages={messages} />

      {/* Input */}
      <ChatInput onSend={onSendMessage} onStop={onStop} isRunning={isRunning} />
    </div>
  )
}
