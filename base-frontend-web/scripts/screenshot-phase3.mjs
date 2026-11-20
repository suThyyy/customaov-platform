// Offline component/browser QA using the actual room UI and a fake SDK.
// Requires the mock Vite dev server. No Supabase network or Production writes.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const base = process.argv[2] ?? 'http://localhost:5174'
const output = 'docs/screenshots/phase3-integration'
mkdirSync(output, { recursive: true })
const browser = await chromium.launch()
let failures = 0
try {
  for (const phase of ['preparing', 'active']) for (const width of [375, 768, 1280, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort())
    await page.goto(base, { waitUntil: 'networkidle' })
    await page.evaluate(async phase => {
      const React = await import('/node_modules/.vite/deps/react.js')
      const { createRoot } = await import('/node_modules/.vite/deps/react-dom_client.js')
      const { SupabaseRoomSnapshot } = await import('/src/components/domain/SupabaseRoomView.tsx')
      const { phase3Fixture } = await import('/src/mocks/phase3.ts')
      const { setSupabaseClientForUnitTests } = await import('/src/api/supabase/client.ts')
      const { configFromRoom } = await import('/src/api/supabase/configuration.ts')
      const query = { select: () => query, order: () => query, returns: async () => ({ data: [{ hero: 'Krixi' }, { hero: 'Valhein' }], error: null }) }
      setSupabaseClientForUnitTests({ from: () => query })
      document.getElementById('root').style.display = 'none'
      const container = document.createElement('main')
      container.className = 'mx-auto max-w-wide px-4 pb-8'
      document.body.append(container)
      const snapshot = phase3Fixture(phase)
      createRoot(container).render(React.createElement(SupabaseRoomSnapshot, { snapshot, connection: 'live', userId: 'host', roomConfig: configFromRoom(snapshot.room), configPersisted: true }))
    }, phase)
    await page.getByRole('heading', { name: 'Phòng kiểm tra cục bộ', exact: true }).first().waitFor()
    await page.waitForTimeout(300)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
    await page.screenshot({ path: `${output}/supabase-${phase}-${width}.png`, fullPage: true })
    const ok = !overflow && !errors.length
    if (!ok) failures++
    console.log(`${ok ? 'ok' : 'FAIL'} offline Supabase ${phase} ${width}px ${errors.join('; ')}`)
    await page.close()
  }
} finally { await browser.close() }
process.exitCode = failures ? 1 : 0
