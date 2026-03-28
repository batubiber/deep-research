import { describe, it, expect } from 'vitest'
import { getEEATScore, parseSources } from '../lib/parseReport'

describe('getEEATScore', () => {
  it('returns high for arxiv.org', () => {
    expect(getEEATScore('https://arxiv.org/abs/2301.00001')).toBe('high')
  })
  it('returns high for nih.gov', () => {
    expect(getEEATScore('https://www.nih.gov/some-page')).toBe('high')
  })
  it('returns high for .edu domain', () => {
    expect(getEEATScore('https://cs.stanford.edu/paper')).toBe('high')
  })
  it('returns medium for wikipedia.org', () => {
    expect(getEEATScore('https://en.wikipedia.org/wiki/Quantum')).toBe('medium')
  })
  it('returns medium for github.com', () => {
    expect(getEEATScore('https://github.com/user/repo')).toBe('medium')
  })
  it('returns low for unknown domain', () => {
    expect(getEEATScore('https://example.com/article')).toBe('low')
  })
  it('returns low for invalid URL', () => {
    expect(getEEATScore('not-a-url')).toBe('low')
  })
})

describe('parseSources', () => {
  it('returns empty array when no Sources section', () => {
    expect(parseSources('# Report\nSome content here.')).toEqual([])
  })

  it('parses sources with em-dash separator', () => {
    const report = `
## Some Section

## Sources
1. Quantum Computing Overview — https://arxiv.org/abs/2301.00001
2. Wikipedia Quantum — https://en.wikipedia.org/wiki/Quantum_computing
3. https://example.com/blog
`
    const sources = parseSources(report)
    expect(sources).toHaveLength(3)
    expect(sources[0]).toMatchObject({
      title: 'Quantum Computing Overview',
      url: 'https://arxiv.org/abs/2301.00001',
      eet_score: 'high',
    })
    expect(sources[1]).toMatchObject({
      url: 'https://en.wikipedia.org/wiki/Quantum_computing',
      eet_score: 'medium',
    })
    expect(sources[2]).toMatchObject({
      url: 'https://example.com/blog',
      eet_score: 'low',
    })
  })

  it('strips trailing punctuation from URLs', () => {
    const report = `## Sources\n1. Title — https://arxiv.org/abs/123.`
    const sources = parseSources(report)
    expect(sources[0].url).toBe('https://arxiv.org/abs/123')
  })

  it('uses url as title when no title text', () => {
    const report = `## Sources\n1. https://arxiv.org/abs/999`
    const sources = parseSources(report)
    expect(sources[0].title).toBe('https://arxiv.org/abs/999')
  })
})
