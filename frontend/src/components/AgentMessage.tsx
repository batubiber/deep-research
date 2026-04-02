import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { animate } from 'animejs'
import {
  CheckCircle2, Loader2, XCircle, FlaskConical, ExternalLink,
  ThumbsUp, ThumbsDown, Copy, Share2, MoreHorizontal, RefreshCw,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { EEATBadge } from './EEATBadge'
import type { ChatMessage, AgentName, EEATScore } from '../types'

// --- Elapsed time hook ---

function useElapsed(startedAt?: number, finishedAt?: number): string {
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    if (!startedAt || finishedAt) return
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [startedAt, finishedAt])

  if (!startedAt) return ''
  const ms = (finishedAt ?? now) - startedAt
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

// --- Running labels ---

const RUNNING_LABELS: Record<string, string> = {
  planner: 'Decomposing query...',
  research_assistant: 'Searching...',
  summarizer: 'Summarizing sources...',
  analyst: 'Synthesizing sources...',
  reviewer: 'Reviewing analysis...',
  gap_researcher: 'Filling knowledge gaps...',
  gap_integrator: 'Integrating gap findings...',
  writer: 'Writing final report...',
  citation_verifier: 'Verifying citations...',
}

// --- Agent display colors ---

const AGENT_COLORS: Record<string, { badge: string; icon: string }> = {
  planner: { badge: 'bg-violet-500/10 text-violet-600 dark:text-violet-400', icon: 'text-violet-500' },
  research_assistant: { badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', icon: 'text-blue-500' },
  summarizer: { badge: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400', icon: 'text-cyan-500' },
  analyst: { badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', icon: 'text-emerald-500' },
  reviewer: { badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', icon: 'text-amber-500' },
  gap_researcher: { badge: 'bg-red-500/10 text-red-600 dark:text-red-400', icon: 'text-red-500' },
  gap_integrator: { badge: 'bg-pink-500/10 text-pink-600 dark:text-pink-400', icon: 'text-pink-500' },
  writer: { badge: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400', icon: 'text-indigo-500' },
  citation_verifier: { badge: 'bg-teal-500/10 text-teal-600 dark:text-teal-400', icon: 'text-teal-500' },
}

// --- Action bar ---

function ActionBar({ data }: { data: Record<string, any> }) {
  const handleCopy = () => {
    const text = data.report || data.analysis || data.gap_findings || data.full_review || ''
    if (text) navigator.clipboard.writeText(text)
  }

  return (
    <div className="flex items-center gap-0.5 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
      {[
        { icon: ThumbsUp, title: 'Like', onClick: undefined },
        { icon: ThumbsDown, title: 'Dislike', onClick: undefined },
        { icon: Copy, title: 'Copy', onClick: handleCopy },
        { icon: Share2, title: 'Share', onClick: undefined },
        { icon: MoreHorizontal, title: 'More', onClick: undefined },
        { icon: RefreshCw, title: 'Regenerate', onClick: undefined },
      ].map(({ icon: Icon, title, onClick }) => (
        <button
          key={title}
          onClick={onClick}
          className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-colors"
          title={title}
        >
          <Icon className="w-3.5 h-3.5" />
        </button>
      ))}
    </div>
  )
}

// --- Agent content renderers ---

function PlannerContent({ data }: { data: Record<string, any> }) {
  const subQuestions = data.sub_questions as Array<{ id: number; question: string; suggested_tool: string }> | undefined
  const complexity = data.complexity as string | undefined

  return (
    <div className="space-y-3">
      {data.main_question && (
        <p className="text-[var(--color-text-primary)] text-sm">
          <strong>Main Question:</strong> {data.main_question}
        </p>
      )}
      {complexity && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-text-tertiary)]">Complexity:</span>
          <span className={`text-xs font-semibold capitalize px-2.5 py-0.5 rounded-full backdrop-blur-sm ${
            complexity === 'simple' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
            complexity === 'moderate' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
            'bg-red-500/10 text-red-500 dark:text-red-400'
          }`}>
            {complexity}
          </span>
        </div>
      )}
      {subQuestions && subQuestions.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">Subquestions:</p>
          <ol className="list-decimal list-inside space-y-1.5">
            {subQuestions.map(sq => (
              <li key={sq.id} className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                {sq.question}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

function ToolCallBadge({ tool, duration }: { tool: string; duration?: string }) {
  const toolLabel = tool === 'web_search' ? 'PERFORM_SEARCH' :
                    tool === 'arxiv' ? 'ARXIV_SEARCH' :
                    tool === 'wikipedia' ? 'WIKI_SEARCH' :
                    tool === 'twitter' ? 'TWITTER_SEARCH' :
                    tool === 'reddit' ? 'REDDIT_SEARCH' :
                    tool === 'youtube' ? 'YOUTUBE_SEARCH' :
                    tool === 'jina_read' ? 'JINA_READ' : tool.toUpperCase()
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 glass-sm text-xs">
      <span className="text-[var(--color-text-tertiary)]">Called tool</span>
      <span className="font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide">
        {toolLabel}
      </span>
      {duration && <span className="text-[var(--color-primary)]">{duration}</span>}
    </div>
  )
}

function SourceCard({ source }: { source: { title: string; url: string; content: string; eet_score: EEATScore } }) {
  const hostname = (() => {
    try { return new URL(source.url).hostname } catch { return source.url }
  })()

  return (
    <li className="glass-sm p-3 hover:shadow-[0_4px_16px_var(--color-primary-glow)] transition-all duration-200">
      <div className="flex items-start gap-1 mb-1">
        <span className="text-sm font-medium text-[var(--color-text-primary)]">{source.title}</span>
      </div>
      {source.url && (
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-[var(--color-link)] hover:text-[var(--color-link-hover)] mb-1.5"
        >
          <span className="truncate">{hostname}</span>
          <ExternalLink className="w-3 h-3 flex-shrink-0" />
        </a>
      )}
      <div className="flex items-center gap-2 mb-2">
        <EEATBadge score={source.eet_score} />
      </div>
      {source.content && (
        <p className="text-xs text-[var(--color-text-tertiary)] leading-relaxed line-clamp-4">{source.content}</p>
      )}
    </li>
  )
}

function ResearcherContent({ data }: { data: Record<string, any> }) {
  const sources = data.sources as Array<{ title: string; url: string; content: string; eet_score: EEATScore }> | undefined
  const analysis = data.analysis as string | undefined

  return (
    <div className="space-y-3">
      <ToolCallBadge tool={data.tool_used ?? 'web_search'} />

      {data.sub_question && (
        <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
          Sub-Question {data.sub_question_id}: {data.sub_question}
        </h4>
      )}

      {analysis && (
        <div className="text-sm text-[var(--color-text-secondary)] leading-relaxed prose-report">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysis}</ReactMarkdown>
        </div>
      )}

      {sources && sources.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">Sources:</p>
          <ul className="space-y-2">
            {sources.map((s, i) => <SourceCard key={s.url + i} source={s} />)}
          </ul>
        </div>
      )}
    </div>
  )
}

function AnalystContent({ data }: { data: Record<string, any> }) {
  const analysis = data.analysis as string | undefined
  if (!analysis) return null
  return (
    <div className="prose-report text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysis}</ReactMarkdown>
    </div>
  )
}

function ReviewerContent({ data }: { data: Record<string, any> }) {
  const score = data.score as number | undefined
  const gaps = data.gaps as string[] | undefined
  const review = data.full_review as string | undefined

  return (
    <div className="space-y-3">
      {score != null && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-text-tertiary)]">Overall Quality Score:</span>
          <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full backdrop-blur-sm ${
            score >= 8 ? 'text-emerald-600 bg-emerald-500/10 dark:text-emerald-400' :
            score >= 5 ? 'text-amber-600 bg-amber-500/10 dark:text-amber-400' :
            'text-red-500 bg-red-500/10 dark:text-red-400'
          }`}>
            {score}/10
          </span>
        </div>
      )}

      {review && (
        <div className="prose-report text-sm">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{review}</ReactMarkdown>
        </div>
      )}

      {gaps && gaps.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">Identified Gaps:</p>
          <ol className="list-decimal list-inside space-y-1.5">
            {gaps.map((gap, i) => (
              <li key={i} className="text-sm text-[var(--color-text-secondary)]">{gap}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

function GapResearcherContent({ data }: { data: Record<string, any> }) {
  const gapFindings = data.gap_findings as string | undefined
  const gapSources = data.gap_sources as Array<{ title: string; url: string; content: string; eet_score: EEATScore; gap_query: string }> | undefined

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">Gap Research Results</h4>

      {gapFindings && (
        <div className="prose-report text-sm">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{gapFindings}</ReactMarkdown>
        </div>
      )}

      {gapSources && gapSources.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">New Sources:</p>
          <ul className="space-y-2">
            {gapSources.map((s, i) => (
              <SourceCard key={s.url + i} source={s} />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function SummarizerContent({ data }: { data: Record<string, any> }) {
  const summary = data.summarized_sources as string | undefined
  if (!summary) return null
  return (
    <div className="prose-report text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
    </div>
  )
}

function GapIntegratorContent({ data }: { data: Record<string, any> }) {
  const enhanced = data.enhanced_analysis as string | undefined
  if (!enhanced) return null
  return (
    <div className="prose-report text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{enhanced}</ReactMarkdown>
    </div>
  )
}

function CitationVerifierContent({ data }: { data: Record<string, any> }) {
  const verification = data.citation_verification as string | undefined
  if (!verification) return null
  return (
    <div className="space-y-2">
      <p className="text-sm text-[var(--color-text-secondary)]">{verification}</p>
    </div>
  )
}

function WriterContent({ data }: { data: Record<string, any> }) {
  const report = data.report as string | undefined
  if (!report) return null
  return (
    <div className="prose-report text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
    </div>
  )
}

// --- Content router ---

const CONTENT_RENDERERS: Record<AgentName, React.ComponentType<{ data: Record<string, any> }>> = {
  planner: PlannerContent,
  research_assistant: ResearcherContent,
  summarizer: SummarizerContent,
  analyst: AnalystContent,
  reviewer: ReviewerContent,
  gap_researcher: GapResearcherContent,
  gap_integrator: GapIntegratorContent,
  writer: WriterContent,
  citation_verifier: CitationVerifierContent,
}

// --- Main component ---

interface Props {
  message: ChatMessage
}

export function AgentMessage({ message }: Props) {
  const { agentName, displayName, status, startedAt, finishedAt, data } = message
  const elapsed = useElapsed(startedAt, finishedAt)

  const isWriterDone = !agentName && data?.node === '__done__'
  const ContentComponent = agentName ? CONTENT_RENDERERS[agentName] : null
  const hasContent = status === 'done' && (ContentComponent || isWriterDone) && Object.keys(data).length > 1

  const agentColor = AGENT_COLORS[agentName ?? ''] ?? AGENT_COLORS.writer
  const borderClass = `agent-border-${agentName ?? 'writer'}`

  const msgRef = useRef<HTMLDivElement>(null)
  const avatarRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = msgRef.current
    const av = avatarRef.current
    if (!el) return
    el.style.opacity = '0'
    el.style.transform = 'translateX(-20px)'
    animate(el, {
      opacity: [0, 1],
      translateX: [-20, 0],
      duration: 450,
      ease: 'outExpo',
    })
    if (av) {
      av.style.transform = 'scale(0)'
      animate(av, {
        scale: [0, 1],
        duration: 400,
        ease: 'outElastic(1, 0.6)',
        delay: 100,
      })
    }
  }, [])

  return (
    <div ref={msgRef} className="flex gap-3 group">
      {/* Avatar — neumorphic circle */}
      <div ref={avatarRef} className={`w-9 h-9 rounded-full neu-flat flex items-center justify-center flex-shrink-0 mt-0.5 ${status === 'running' ? 'animate-pulse-glow' : ''}`}>
        <FlaskConical className={`w-4 h-4 ${agentColor.icon}`} />
      </div>

      {/* Message body — glass panel with agent-colored border */}
      <div className={`flex-1 min-w-0 glass p-4 ${borderClass}`}>
        {/* Header row */}
        <div className="flex items-center gap-2 mb-2">
          {/* Agent badge */}
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold backdrop-blur-sm ${agentColor.badge}`}>
            <FlaskConical className="w-2.5 h-2.5" />
            DeepResearch
          </span>

          {/* Status */}
          <div className="flex items-center gap-1.5">
            {status === 'running' && <Loader2 className="w-3 h-3 text-[var(--color-primary)] animate-spin" />}
            {status === 'done'    && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
            {status === 'error'   && <XCircle className="w-3 h-3 text-red-500" />}
            <span className={`text-[10px] font-medium ${
              status === 'running' ? 'text-[var(--color-primary)]' :
              status === 'error'   ? 'text-red-500' :
              'text-emerald-500'
            }`}>
              {status === 'done'  ? 'Finished' :
               status === 'error' ? 'Interrupted' :
               (RUNNING_LABELS[agentName ?? ''] ?? 'Processing...')}
              {elapsed && ` in ${elapsed}`}
            </span>
          </div>
        </div>

        {/* Agent name */}
        {(displayName || isWriterDone) && (
          <p className="text-xs text-[var(--color-text-tertiary)] mb-2 font-medium">
            {displayName ?? 'Writer'}
          </p>
        )}

        {/* Content */}
        {hasContent && (
          <div className="mt-1 pb-1">
            {isWriterDone ? (
              <WriterContent data={data} />
            ) : ContentComponent ? (
              <ContentComponent data={data} />
            ) : null}
          </div>
        )}

        {/* Action bar */}
        {hasContent && <ActionBar data={data} />}
      </div>
    </div>
  )
}
