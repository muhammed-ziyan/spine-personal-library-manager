import { beforeEach, describe, expect, it, vi } from 'vitest'

const STORAGE_KEY = 'spine.session'
const HOUR = 60 * 60 * 1000

function makeSession(overrides: Record<string, unknown> = {}) {
  return { token: 'v1|reader%40spine.test|1|2|sig', expiresAt: Date.now() + 24 * HOUR, username: 'reader@spine.test', library: 'Home shelf', ...overrides }
}

/** The module reads localStorage once on import, so each test needs a fresh copy. */
async function load(stored?: unknown) {
  localStorage.clear()
  if (stored !== undefined) localStorage.setItem(STORAGE_KEY, typeof stored === 'string' ? stored : JSON.stringify(stored))
  vi.resetModules()
  return (await import('./session')).session
}

describe('session store', () => {
  beforeEach(() => localStorage.clear())

  it('starts signed out when nothing is stored', async () => {
    const session = await load()
    expect(session.get()).toBeNull()
    expect(session.getToken()).toBeNull()
  })

  it('restores a stored session and its token', async () => {
    const stored = makeSession()
    const session = await load(stored)
    expect(session.get()).toEqual(stored)
    expect(session.getToken()).toBe(stored.token)
  })

  it('discards an expired session instead of letting the first request fail', async () => {
    const session = await load(makeSession({ expiresAt: Date.now() - HOUR }))
    expect(session.get()).toBeNull()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('ignores junk and half-written records', async () => {
    for (const junk of ['not json', '{}', JSON.stringify({ token: '' }), JSON.stringify({ token: 'a', expiresAt: 'soon', username: 'x' }), JSON.stringify([1, 2])]) {
      expect((await load(junk)).get()).toBeNull()
    }
  })

  it('persists a session that was started, and notifies subscribers', async () => {
    const session = await load()
    const listener = vi.fn()
    session.subscribe(listener)

    const started = session.start(makeSession())
    expect(session.get()).toEqual(started)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(started)
    expect(listener).toHaveBeenCalledWith(started)
  })

  it('clears storage and notifies on sign-out', async () => {
    const session = await load(makeSession())
    const listener = vi.fn()
    session.subscribe(listener)

    session.end()
    expect(session.get()).toBeNull()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(listener).toHaveBeenCalledWith(null)

    // Signing out twice must not churn: there is nothing left to clear.
    session.end()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('updates the library name without touching the token', async () => {
    const session = await load(makeSession())
    session.rename('Renamed shelf')
    expect(session.get()).toMatchObject({ library: 'Renamed shelf', token: makeSession().token })
    // No-ops stay no-ops.
    const listener = vi.fn()
    session.subscribe(listener)
    session.rename('Renamed shelf')
    session.rename('')
    expect(listener).not.toHaveBeenCalled()
  })

  it('stops notifying after unsubscribe', async () => {
    const session = await load()
    const listener = vi.fn()
    session.subscribe(listener)()
    session.start(makeSession())
    expect(listener).not.toHaveBeenCalled()
  })
})
