import { useRef, useLayoutEffect } from 'react'
import { animate } from 'animejs'

/**
 * Animate a single element on mount.
 * Returns a ref to attach to the target element.
 */
export function useAnimateIn<T extends HTMLElement>(
  from: Record<string, any>,
  to: Record<string, any>,
  opts: { duration?: number; delay?: number; ease?: string } = {},
) {
  const ref = useRef<T>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    // Set initial state synchronously
    Object.entries(from).forEach(([k, v]) => {
      if (k === 'opacity') el.style.opacity = String(v)
      else if (k === 'translateY') el.style.transform = `translateY(${v}px)`
      else if (k === 'translateX') el.style.transform = `translateX(${v}px)`
      else if (k === 'scale') el.style.transform = `scale(${v})`
    })

    const props: Record<string, any> = {}
    Object.keys(to).forEach(k => {
      props[k] = [from[k], to[k]]
    })

    animate(el, {
      ...props,
      duration: opts.duration ?? 500,
      delay: opts.delay ?? 0,
      ease: opts.ease ?? 'outExpo',
    })
  }, [])

  return ref
}
