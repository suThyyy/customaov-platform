// Chụp màn hình từng route ở nhiều khổ rộng, kiểm tra tràn ngang và ghi lỗi console.
// Dùng: node scripts/screenshot.mjs <phase> [baseUrl] [--widths=375,1440] [tên-route...]
// Ảnh lưu tại docs/screenshots/<phase>/<route>-<width>.png
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const args = process.argv.slice(2)
const flags = args.filter((a) => a.startsWith('--'))
const pos = args.filter((a) => !a.startsWith('--'))
const phase = pos[0] ?? 'current'
const base = pos[1] ?? 'http://localhost:5174'
const only = pos.slice(2)
const widthsFlag = flags.find((f) => f.startsWith('--widths='))
const WIDTHS = widthsFlag ? widthsFlag.split('=')[1].split(',').map(Number) : [375, 768, 1280, 1440]
const fullPage = !flags.includes('--viewport-only')

const outDir = join(root, 'docs', 'screenshots', phase)
mkdirSync(outDir, { recursive: true })

const ROUTES = [
  { name: 'landing', path: '/', loggedIn: false },
  { name: 'dashboard', path: '/dashboard', loggedIn: true },
  { name: 'room-detail', path: '/rooms/AOV-1024', loggedIn: true },
  { name: 'room-new', path: '/rooms/new', loggedIn: true },
  { name: 'tournaments', path: '/tournaments', loggedIn: true },
  { name: 'tournament-new', path: '/tournaments/new', loggedIn: true },
  { name: 'tournament-detail', path: '/tournaments/ngu-kiet-cup-mua-1', loggedIn: true },
  { name: 'tournament-live', path: '/tournaments/custom-league-3', loggedIn: true },
  { name: 'profile', path: '/profile', loggedIn: true },
  { name: 'activities', path: '/activities', loggedIn: true },
]

const browser = await chromium.launch()
let failures = 0
for (const r of ROUTES) {
  if (only.length && !only.includes(r.name)) continue
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 })
    await ctx.addInitScript((v) => localStorage.setItem('customaov.mockLoggedIn', v), r.loggedIn ? '1' : '0')
    await ctx.addInitScript(() => sessionStorage.setItem('customaov.mockRole', 'admin'))
    const page = await ctx.newPage()
    const errors = []
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto(base + r.path, { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(300)
    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }))
    const overflow = scrollWidth > innerWidth
    await page.screenshot({ path: join(outDir, `${r.name}-${width}.png`), fullPage })
    const bad = overflow || errors.length > 0
    if (bad) failures++
    console.log(
      `${bad ? 'FAIL' : 'ok  '} ${r.name.padEnd(18)} ${String(width).padStart(4)}px  scrollWidth=${scrollWidth}` +
        (overflow ? `  (tràn ${scrollWidth - innerWidth}px)` : '') +
        (errors.length ? '\n   ' + errors.join('\n   ') : ''),
    )
    await ctx.close()
  }
}
await browser.close()
process.exit(failures ? 1 : 0)
