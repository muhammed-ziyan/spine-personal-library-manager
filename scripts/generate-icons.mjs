/**
 * Generates the PWA icon PNGs (192, 512, 512-maskable, apple-touch-icon)
 * with zero dependencies — a tiny PNG encoder drawing the Spine mark.
 *
 * Usage: node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'icons')
mkdirSync(outDir, { recursive: true })

const ACCENT = [0xc6, 0x71, 0x39]
const PAPER = [0xf5, 0xea, 0xd8]
const SAGE = [0xcc, 0xdb, 0xb2]
const PEACH = [0xff, 0xe1, 0xd0]

function crc32(buf) {
  let c
  const table = crc32.table || (crc32.table = Array.from({ length: 256 }, (_, n) => {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  }))
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crc])
}

function encodePng(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y)
      const o = y * (size * 4 + 1) + 1 + x * 4
      raw[o] = r
      raw[o + 1] = g
      raw[o + 2] = b
      raw[o + 3] = a
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** Signed distance to a rounded rectangle centred at (cx, cy). */
function roundedRect(px, py, cx, cy, hw, hh, r) {
  const dx = Math.abs(px - cx) - hw + r
  const dy = Math.abs(py - cy) - hh + r
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0))
  return outside + Math.min(Math.max(dx, dy), 0) - r
}

function coverage(d) {
  // Anti-alias over ~1px.
  return Math.min(1, Math.max(0, 0.5 - d))
}

function mix(a, b, t) {
  return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)]
}

/**
 * Draw the mark: three book spines on a terracotta tile.
 * `inset` scales the artwork so maskable icons keep it in the safe zone.
 */
function makeIcon(size, { maskable = false, radiusRatio = 0.24 } = {}) {
  const s = size
  const artScale = maskable ? 0.62 : 0.78
  const unit = (s * artScale) / 64 // artwork is designed on a 64-unit grid
  const ox = s / 2 - 32 * unit
  const oy = s / 2 - 32 * unit

  return encodePng(s, (x, y) => {
    const px = x + 0.5
    const py = y + 0.5

    // Background tile
    let bg
    if (maskable) {
      bg = ACCENT
    } else {
      const d = roundedRect(px, py, s / 2, s / 2, s / 2, s / 2, s * radiusRatio)
      const a = coverage(d)
      if (a <= 0) return [0, 0, 0, 0]
      bg = ACCENT
      if (a < 1) return [...bg, Math.round(a * 255)]
    }

    // Spines
    const u = (v) => v * unit
    // Three book spines of different heights, bottom-aligned, as on the launch screen.
    const shapes = [
      { d: roundedRect(px, py, ox + u(17.5), oy + u(32), u(4.5), u(20), u(1.6)), color: PAPER },
      { d: roundedRect(px, py, ox + u(32), oy + u(36), u(4.5), u(16), u(1.6)), color: SAGE },
      { d: roundedRect(px, py, ox + u(46.5), oy + u(33.5), u(4.5), u(18.5), u(1.6)), color: PEACH },
    ]
    let color = bg
    for (const shape of shapes) {
      const a = coverage(shape.d)
      if (a > 0) color = mix(color, shape.color, a)
    }
    return [...color, 255]
  })
}

writeFileSync(join(outDir, 'icon-192.png'), makeIcon(192))
writeFileSync(join(outDir, 'icon-512.png'), makeIcon(512))
writeFileSync(join(outDir, 'icon-512-maskable.png'), makeIcon(512, { maskable: true }))
writeFileSync(join(root, 'public', 'apple-touch-icon.png'), makeIcon(180, { maskable: true }))
console.log('Icons written to public/icons and public/apple-touch-icon.png')
