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

// --- Action bar ---

function ActionBar({ data }: { data: Record<string, any> }) {
  const handleCopy = () => {
    const text = data.report || data.analysis || data.gap_findings || data.full_review || ''
    if (text) navigator.clipboard.writeText(text)
  }

  return (
    <div className="flex items-center gap-0.5 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
      <button className="p-1.5 rounded-lg hover:bg-[#F0F4F8] dark:hover:bg-[#21262d] text-[#9CA3AF] dark:text-[#484f58] hover:text-[#6B7280] dark:hover:text-[#8b949e] transition-colors" title="Like">
        <ThumbsUp className="w-3.5 h-3.5" />
      </button>
      <button className="p-1.5 rounded-lg hover:bg-[#F0F4F8] dark:hover:bg-[#21262d] text-[#9CA3AF] dark:text-[#484f58] hover:text-[#6B7280] dark:hover:text-[#8b949e] transition-colors" title="Dislike">
        <ThumbsDown className="w-3.5 h-3.5" />
      </button>
      <button onClick={handleCopy} className="p-1.5 rounded-lg hover:bg-[#F0F4F8] dark:hover:bg-[#21262d] text-[#9CA3AF] dark:text-[#484f58] hover:text-[#6B7280] dark:hover:text-[#8b949e] transition-colors" title="Copy">
        <Copy className="w-3.5 h-3.5" />
      </button>
      <button className="p-1.5 rounded-lg hover:bg-[#F0F4F8] dark:hover:bg-[#21262d] text-[#9CA3AF] dark:text-[#484f58] hover:text-[#6B7280] dark:hover:text-[#8b949e] transition-colors" title="Share">
        <Share2 className="w-3.5 h-3.5" />
      </button>
      <button className="p-1.5 rounded-lg hover:bg-[#F0F4F8] dark:hover:bg-[#21262d] text-[#9CA3AF] dark:text-[#484f58] hover:text-[#6B7280] dark:hover:text-[#8b949e] transition-colors" title="More">
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>
      <button className="p-1.5 rounded-lg hover:bg-[#F0F4F8] dark:hover:bg-[#21262d] text-[#9CA3AF] dark:text-[#484f58] hover:text-[#6B7280] dark:hover:text-[#8b949e] transition-colors" title="Regenerate">
        <RefreshCw className="w-3.5 h-3.5" />
      </button>
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
        <p className="text-[#1A1A2E] dark:text-[#e6edf3] text-sm">
          <strong>Main Question:</strong> {data.main_question}
        </p>
      )}
      {complexity && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#6B7280] dark:text-[#8b949e]">Complexity:</span>
          <span className={`text-xs font-medium capitalize px-2 py-0.5 rounded-full ${
            complexity === 'simple' ? 'bg-green-50 text-green-700 dark:bg-[#1a4731] dark:text-[#3fb950]' :
            complexity === 'moderate' ? 'bg-amber-50 text-amber-700 dark:bg-[#3d2e00] dark:text-[#d29922]' :
            'bg-red-50 text-red-500 dark:bg-[#3d1218] dark:text-[#f85149]'
          }`}>
            {complexity}
          </span>
        </div>
      )}
      {subQuestions && subQuestions.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[#6B7280] dark:text-[#8b949e] uppercase tracking-wider mb-2">Subquestions:</p>
          <ol className="list-decimal list-inside space-y-1">
            {subQuestions.map(sq => (
              <li key={sq.id} className="text-sm text-[#374151] dark:text-[#c9d1d9] leading-relaxed">
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
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#F0F4F8] dark:bg-[#161b22] border border-[#E5E7EB] dark:border-[#30363d] rounded-lg text-xs">
      <span className="text-[#6B7280] dark:text-[#8b949e]">Called tool</span>
      <span className="font-mono text-green-700 dark:text-[#3fb950] bg-green-50 dark:bg-[#1a4731] px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide">
        {toolLabel}
      </span>
      {duration && <span className="text-[#4A6CF7] dark:text-[#58a6ff]">{duration}</span>}
    </div>
  )
}

function SourceCard({ source }: { source: { title: string; url: string; content: string; eet_score: EEATScore } }) {
  const hostname = (() => {
    try { return new URL(source.url).hostname } catch { return source.url }
  })()

  return (
    <li className="border border-[#E5E7EB] dark:border-[#30363d] rounded-xl p-3 bg-white dark:bg-[#0d1117]/50 shadow-sm dark:shadow-none">
      <div className="flex items-start gap-1 mb-1">
        <span className="text-sm font-medium text-[#1A1A2E] dark:text-[#e6edf3]">{source.title}</span>
      </div>
      {source.url && (
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-[#4A6CF7] dark:text-[#58a6ff] hover:text-[#3B5DE7] dark:hover:text-[#79c0ff] mb-1.5"
        >
          <span className="truncate">{hostname}</span>
          <ExternalLink className="w-3 h-3 flex-shrink-0" />
        </a>
      )}
      <div className="flex items-center gap-2 mb-2">
        <EEATBadge score={source.eet_score} />
      </div>
      {source.content && (
        <p className="text-xs text-[#6B7280] dark:text-[#8b949e] leading-relaxed line-clamp-4">{source.content}</p>
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
        <h4 className="text-sm font-semibold text-[#1A1A2E] dark:text-[#e6edf3]">
          Sub-Question {data.sub_question_id}: {data.sub_question}
        </h4>
      )}

      {analysis && (
        <div className="text-sm text-[#374151] dark:text-[#c9d1d9] leading-relaxed prose-report">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysis}</ReactMarkdown>
        </div>
      )}

      {sources && sources.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[#6B7280] dark:text-[#8b949e] uppercase tracking-wider mb-2">Sources:</p>
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
          <span className="text-xs text-[#6B7280] dark:text-[#8b949e]">Overall Quality Score:</span>
          <span className={`text-sm font-bold px-2 py-0.5 rounded ${
            score >= 8 ? 'text-green-700 bg-green-50 dark:text-[#3fb950] dark:bg-[#1a4731]' :
            score >= 5 ? 'text-amber-700 bg-amber-50 dark:text-[#d29922] dark:bg-[#3d2e00]' :
            'text-red-500 bg-red-50 dark:text-[#f85149] dark:bg-[#3d1218]'
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
          <p className="text-xs font-semibold text-[#6B7280] dark:text-[#8b949e] uppercase tracking-wider mb-2">Identified Gaps:</p>
          <ol className="list-decimal list-inside space-y-1">
            {gaps.map((gap, i) => (
              <li key={i} className="text-sm text-[#374151] dark:text-[#c9d1d9]">{gap}</li>
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
      <h4 className="text-sm font-semibold text-[#1A1A2E] dark:text-[#e6edf3]">Gap Research Results</h4>

      {gapFindings && (
        <div className="prose-report text-sm">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{gapFindings}</ReactMarkdown>
        </div>
      )}

      {gapSources && gapSources.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[#6B7280] dark:text-[#8b949e] uppercase tracking-wider mb-2">New Sources:</p>
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
      <p className="text-sm text-[#374151] dark:text-[#c9d1d9]">{verification}</p>
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
      <div ref={avatarRef} className="w-8 h-8 rounded-full bg-[#F0F4F8] dark:bg-[#21262d] border border-[#E5E7EB] dark:border-[#30363d] flex items-center justify-center flex-shrink-0 mt-0.5">
        <FlaskConical className="w-4 h-4 text-[#4A6CF7] dark:text-[#58a6ff]" />
      </div>
      <div className="flex-1 min-w-0">
        {/* Badge */}
        <div className="flex items-center gap-1.5 mb-1">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#4A6CF7]/10 dark:bg-[#1f6feb]/15 text-[10px] font-semibold text-[#4A6CF7] dark:text-[#58a6ff]">
            <FlaskConical className="w-2.5 h-2.5" />
            DeepResearch
          </span>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 mb-1">
          {status === 'running' && <Loader2 className="w-3.5 h-3.5 text-[#4A6CF7] dark:text-[#58a6ff] animate-spin" />}
          {status === 'done'    && <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-[#3fb950]" />}
          {status === 'error'   && <XCircle className="w-3.5 h-3.5 text-red-500 dark:text-[#f85149]" />}
          <span className={`text-xs font-medium ${
            status === 'running' ? 'text-[#4A6CF7] dark:text-[#58a6ff]' :
            status === 'error'   ? 'text-red-500 dark:text-[#f85149]' :
            'text-green-600 dark:text-[#3fb950]'
          }`}>
            {status === 'done'  ? 'Finished' :
             status === 'error' ? 'Interrupted' :
             (RUNNING_LABELS[agentName ?? ''] ?? 'Processing...')}
            {elapsed && ` in ${elapsed}`}
          </span>
        </div>

        {/* Agent name */}
        {(displayName || isWriterDone) && (
          <p className="text-xs text-[#6B7280] dark:text-[#8b949e] mb-2">
            {displayName ?? 'Writer'}
          </p>
        )}

        {/* Content */}
        {hasContent && (
          <div className="mt-2 pb-2">
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
