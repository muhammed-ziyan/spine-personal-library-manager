import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const EXEC = 'https://script.google.com/macros/s/AKfycbxyz1234567890/exec'

/** The store keeps module-level state, so every test gets a fresh import. */
async function load() {
  vi.resetModules()
  return import('./connections')
}

describe('normalizeAppsScriptUrl', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('tidies a pasted deployment URL', async () => {
    const { normalizeAppsScriptUrl } = await load()
    expect(normalizeAppsScriptUrl(`  ${EXEC}?usp=sharing#x  `)).toBe(EXEC)
    expect(normalizeAppsScriptUrl(EXEC.replace('https://', ''))).toBe(EXEC)
    expect(normalizeAppsScriptUrl(`${EXEC}/`)).toBe(EXEC)
  })

  it('rejects things that are not URLs at all', async () => {
    const { normalizeAppsScriptUrl } = await load()
    expect(normalizeAppsScriptUrl('')).toBeNull()
    expect(normalizeAppsScriptUrl('not a url')).toBeNull()
    expect(normalizeAppsScriptUrl('   ')).toBeNull()
    // Chromium turns "not a url" into a percent-encoded hostname instead of throwing.
    expect(normalizeAppsScriptUrl('https://not%20a%20url/')).toBeNull()
  })

  it('resolves a bare path against the app origin (dev proxy) in development builds', async () => {
    const { normalizeAppsScriptUrl } = await load()
    expect(normalizeAppsScriptUrl('/api')).toBe(`${location.origin}/api`)
    expect(normalizeAppsScriptUrl('/api/')).toBe(`${location.origin}/api`)
  })

  it('accepts local dev backends only in development builds; production is script.google.com only', async () => {
    const dev = await load()
    expect(dev.normalizeAppsScriptUrl('http://localhost:8787')).toBe('http://localhost:8787')
    vi.stubEnv('DEV', false)
    const prod = await load()
    expect(prod.normalizeAppsScriptUrl('http://localhost:8787')).toBeNull()
    expect(prod.normalizeAppsScriptUrl('https://evil.example/exec')).toBeNull()
    expect(prod.normalizeAppsScriptUrl('https://script.google.com.evil.example/exec')).toBeNull()
    expect(prod.normalizeAppsScriptUrl(EXEC)).toBe(EXEC)
  })
})

describe('describeConnectionUrl', () => {
  it('shortens deployment URLs for list rows', async () => {
    const { describeConnectionUrl } = await load()
    expect(describeConnectionUrl(EXEC)).toBe('script.google.com · AKfycb…7890')
    expect(describeConnectionUrl('http://localhost:8787')).toBe('localhost:8787')
  })
})

describe('connections store', () => {
  beforeEach(() => localStorage.clear())

  const sample = { url: EXEC, accessKey: '', label: '', sheetName: 'Home shelf' }

  it('starts empty', async () => {
    const { connections } = await load()
    expect(connections.list()).toEqual([])
    expect(connections.getActive()).toBeNull()
    expect(connections.getActiveTarget()).toBeNull()
  })

  it('adds a connection, makes it active and persists it across reloads', async () => {
    const first = await load()
    const created = first.connections.add({ ...sample, accessKey: 'shh' })
    expect(created.label).toBe('Home shelf')
    expect(first.connections.getActiveTarget()).toEqual({ url: EXEC, accessKey: 'shh' })

    const reloaded = await load()
    expect(reloaded.connections.getActive()?.id).toBe(created.id)
    expect(reloaded.connections.list()).toHaveLength(1)
  })

  it('falls back to a generic label when neither a name nor a sheet title is known', async () => {
    const { connections } = await load()
    expect(connections.add({ ...sample, sheetName: '' }).label).toBe('My library')
    expect(connections.add({ ...sample, url: 'http://localhost:8787', label: '  Work   shelf  ' }).label).toBe('Work shelf')
  })

  it('re-connecting the same URL updates the entry instead of duplicating it', async () => {
    const { connections } = await load()
    const a = connections.add(sample)
    connections.add({ ...sample, url: 'http://localhost:8787', label: 'Dev' })
    const again = connections.add({ ...sample, accessKey: 'new-key', label: 'Renamed' })
    expect(again.id).toBe(a.id)
    expect(connections.list()).toHaveLength(2)
    expect(connections.getActive()).toMatchObject({ id: a.id, label: 'Renamed', accessKey: 'new-key' })
  })

  it('switches, edits and forgets connections', async () => {
    const { connections } = await load()
    const a = connections.add(sample)
    const b = connections.add({ ...sample, url: 'http://localhost:8787', label: 'Dev' })
    expect(connections.getActive()?.id).toBe(b.id)

    connections.setActive(a.id)
    expect(connections.getActive()?.id).toBe(a.id)
    connections.setActive('nope')
    expect(connections.getActive()?.id).toBe(a.id)

    connections.update(a.id, { label: '', accessKey: ' k ' })
    expect(connections.getActive()).toMatchObject({ label: 'Home shelf', accessKey: 'k' })

    connections.remove(a.id)
    expect(connections.getActive()?.id).toBe(b.id)
    connections.remove(b.id)
    expect(connections.getActive()).toBeNull()
    expect(JSON.parse(localStorage.getItem('spine.connections') ?? '{}')).toMatchObject({ activeId: null, connections: [] })
  })

  it('notifies subscribers with the new snapshot', async () => {
    const { connections } = await load()
    const listener = vi.fn()
    const unsubscribe = connections.subscribe(listener)
    const created = connections.add(sample)
    expect(listener).toHaveBeenCalledWith({ connections: [created], active: created })
    unsubscribe()
    connections.remove(created.id)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('ignores corrupt storage', async () => {
    localStorage.setItem('spine.connections', '{"connections": [1, {"id": "x"}], "activeId": "x"')
    const { connections } = await load()
    expect(connections.list()).toEqual([])
    localStorage.setItem('spine.connections', JSON.stringify({ connections: [1, { id: 'x' }], activeId: 'x' }))
    const again = await load()
    expect(again.connections.list()).toEqual([])
  })
})
