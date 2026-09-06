import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveBackendUrl } from './config'

describe('resolveBackendUrl', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('returns null when the build has no VITE_APPS_SCRIPT_URL', () => {
    vi.stubEnv('VITE_APPS_SCRIPT_URL', '')
    expect(resolveBackendUrl()).toBeNull()
    vi.stubEnv('VITE_APPS_SCRIPT_URL', '   ')
    expect(resolveBackendUrl()).toBeNull()
  })

  it('accepts an Apps Script deployment URL and drops a trailing slash', () => {
    vi.stubEnv('VITE_APPS_SCRIPT_URL', 'https://script.google.com/macros/s/AKfy123/exec')
    expect(resolveBackendUrl()).toBe('https://script.google.com/macros/s/AKfy123/exec')
    vi.stubEnv('VITE_APPS_SCRIPT_URL', 'https://script.google.com/macros/s/AKfy123/exec/')
    expect(resolveBackendUrl()).toBe('https://script.google.com/macros/s/AKfy123/exec')
  })

  it('resolves the relative dev-proxy path against this origin', () => {
    vi.stubEnv('VITE_APPS_SCRIPT_URL', '/api')
    expect(resolveBackendUrl()).toBe(`${location.origin}/api`)
  })

  it('refuses anything that is not Apps Script in a production build', () => {
    vi.stubEnv('DEV', false)
    for (const url of ['https://evil.example/exec', 'http://localhost:8787', 'javascript:alert(1)', 'not a url']) {
      vi.stubEnv('VITE_APPS_SCRIPT_URL', url)
      expect(resolveBackendUrl()).toBeNull()
    }
  })

  it('allows a local backend in development builds only', () => {
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_APPS_SCRIPT_URL', 'http://192.168.1.20:8787')
    expect(resolveBackendUrl()).toBe('http://192.168.1.20:8787')
  })
})
