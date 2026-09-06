import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    // A hash addresses a section of the page the landing page links to. The
    // browser's own anchor jump happens before React has rendered the target,
    // so honour it here instead of scrolling back to the top over it.
    if (hash) {
      let target: Element | null = null
      try {
        target = document.querySelector(hash)
      } catch {
        /* not a usable selector (e.g. "#1"); fall through to the top */
      }
      if (target) {
        target.scrollIntoView()
        return
      }
    }
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname, hash])
  return null
}
