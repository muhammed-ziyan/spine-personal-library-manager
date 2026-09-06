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
 * Then in .env:
 *   VITE_APPS_SCRIPT_URL=http://localhost:8787
 *   VITE_GOOGLE_CLIENT_ID=local-dev
 *
 * With that client ID the sign-in screen offers a "local development session"
 * (development builds only) that mints an unsigned token this server accepts.
 * The deployed backend rejects such tokens because Google cannot verify them.
 *
 * Data lives in memory and is lost when the process exits.
 */
import { createServer } from 'node:http'
import { createBackend, type TokenInfo } from '../apps-script/__tests__/harness.ts'

const PORT = Number(process.env.PORT || 8787)
const CLIENT_ID = 'local-dev'
const ALLOWED = process.env.DEV_ALLOWED_EMAILS || 'you@example.com'

function decodeUnsignedJwt(token: string): TokenInfo | null {
  try {
    const [, payload] = token.split('.')
    const json = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
    return {
      aud: String(json.aud ?? ''),
      iss: String(json.iss ?? ''),
      email: String(json.email ?? ''),
      email_verified: String(json.email_verified ?? 'false'),
      exp: Number(json.exp ?? 0),
    }
  } catch {
    return null
  }
}

const backend = createBackend({ clientId: CLIENT_ID, allowedEmails: ALLOWED, resolveToken: decodeUnsignedJwt })

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
  console.log(`Allowed dev accounts: ${ALLOWED}`)
})
