/**
 * Local development backend.
 *
 * Runs the *real* Apps Script code (apps-script/*.gs) inside Node with an
 * in-memory spreadsheet, exposed over HTTP with the same request/response
 * envelope as the deployed web app. Nothing here ships to production; it
 * exists so the UI can be developed and tested without a Google deployment.
 *
 *   npm run dev:backend            # http://localhost:8787
 *
 * The Vite dev server proxies `/api` here (see vite.config.ts), which is what
 * VITE_APPS_SCRIPT_URL=/api in `.env` points the app at. Development builds
 * accept plain-http localhost/LAN URLs; production builds only talk to
 * script.google.com.
 *
 * Sign-in mirrors the deployed script: the credentials live outside the code,
 * in SPINE_AUTH_USERNAME and SPINE_AUTH_PASSWORD (npm run dev:backend loads
 * them from the git-ignored `.env`). Without them the backend refuses every
 * request, exactly as a freshly deployed script does.
 *
 * Data lives in memory and is lost when the process exits.
 */
import { createServer } from 'node:http'
import { createBackend } from '../apps-script/__tests__/harness.ts'

const PORT = Number(process.env.PORT || 8787)
const username = (process.env.SPINE_AUTH_USERNAME || '').trim()
const password = process.env.SPINE_AUTH_PASSWORD || ''

if (!username || !password) {
  console.error('Set SPINE_AUTH_USERNAME and SPINE_AUTH_PASSWORD (in .env) before starting the dev backend.')
  console.error('They are the username and password the app will sign in with, and match what you put in Script Properties when you deploy.')
  process.exit(1)
}

const backend = createBackend({ credentials: { username, password } })

const server = createServer((req, res) => {
  // Mirror Apps Script: permissive CORS, POST only, JSON envelope in a text body.
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'content-type')
  if (req.method === 'OPTIONS') {
    res.writeHead(204).end()
    return
  }
  if (req.method !== 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: { code: 'BAD_REQUEST', message: 'Spine dev API: use POST.' } }))
    return
  }
  let body = ''
  req.on('data', (chunk) => {
    body += chunk
  })
  req.on('end', () => {
    // Simulate Apps Script latency so loading states are visible.
    setTimeout(() => {
      const result = backend.handle(body)
      let action = '?'
      try {
        action = String(JSON.parse(body).action ?? '?')
      } catch {
        /* malformed body — the backend reports it */
      }
      console.log(`${new Date().toISOString()}  ${action.padEnd(12)} → ${result.ok ? 'ok' : result.error?.code}`)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(result))
    }, 250)
  })
})

server.listen(PORT, () => {
  console.log(`Spine dev backend listening on http://localhost:${PORT}`)
  console.log(`Sign in as ${username} (password from SPINE_AUTH_PASSWORD).`)
})
