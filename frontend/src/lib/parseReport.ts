import type { EEATScore, Source } from '../types'

const HIGH_DOMAINS = [
  'arxiv.org', 'nature.com', 'science.org', 'ieee.org', 'acm.org',
  'nih.gov', 'who.int', 'un.org', 'springer.com', 'wiley.com', 'sciencedirect.com',
]

const HIGH_SUFFIXES = ['.gov', '.edu']

const MEDIUM_DOMAINS = [
  'wikipedia.org', 'reuters.com', 'apnews.com', 'bbc.com', 'bbc.co.uk',
  'nytimes.com', 'theguardian.com', 'washingtonpost.com', 'bloomberg.com',
  'techcrunch.com', 'arstechnica.com', 'medium.com', 'github.com', 'stackoverflow.com',
]

export function getEEATScore(url: string): EEATScore {
  try {
    const { hostname } = new URL(url)
    if (HIGH_SUFFIXES.some(s => hostname.endsWith(s))) return 'high'
    if (HIGH_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d))) return 'high'
    if (MEDIUM_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d))) return 'medium'
  } catch {
    // invalid URL → low
  }
  return 'low'
}

export function parseSources(report: string): Source[] {
  // Find ## Sources (or # Sources or ### Sources) section heading
  const headingIdx = report.search(/^#{1,3}\s+Sources?\s*$/m)
  if (headingIdx === -1) return []

  // Slice from the heading onward, strip the heading line itself
  const fromHeading = report.slice(headingIdx)
  const bodyStart = fromHeading.indexOf('\n') + 1
  const body = fromHeading.slice(bodyStart)

  // Find end of section (next heading), or use entire remaining text
  const nextHeadingIdx = body.search(/^#{1,3}\s/m)
  const sectionContent = nextHeadingIdx === -1 ? body : body.slice(0, nextHeadingIdx)

  const sources: Source[] = []
  const lineRe = /^\d+\.\s+(.+)/gm
  let m: RegExpExecArray | null

  while ((m = lineRe.exec(sectionContent)) !== null) {
    const line = m[1].trim()
    const urlMatch = line.match(/https?:\/\/[^\s)>\]]+/)
    if (!urlMatch) continue

    const url = urlMatch[0].replace(/[.,;)]+$/, '')
    const title =
      line
        .replace(urlMatch[0], '')
        .replace(/\s*[—–\-]+\s*/g, ' ')
        .trim() || url

    sources.push({ title, url, eet_score: getEEATScore(url) })
  }

  return sources
}
