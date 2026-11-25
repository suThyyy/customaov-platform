// Local Mock browser regression with an intercepted in-memory RPC client.
// This is not hosted Supabase acceptance. No request reaches Production.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
const base = process.argv[2] ?? 'http://127.0.0.1:5186'
if (!['localhost','127.0.0.1'].includes(new URL(base).hostname)) throw Error('Local server required')
const browser = await chromium.launch()
try {
  for (const width of [390,1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } })
    const requests = []
    await context.route(/supabase\.(co|in)/, r => { requests.push(r.request().url()); return r.abort() })
    await context.addInitScript(() => localStorage.setItem('customaov.mockLoggedIn','1'))
    const page = await context.newPage()
    await page.goto(base + '/join/discovery')
    await page.getByRole('alert').filter({ hasText: /Kh\u00f4ng t\u00ecm th\u1ea5y l\u1eddi m\u1eddi/ }).waitFor()
    assert.equal(await page.getByRole('button',{ name:'V\u00e0o ph\u00f2ng' }).count(),0)
    await page.goto(base + '/join/fixture-invite')
    await page.getByLabel('T\u00ean hi\u1ec3n th\u1ecb').fill('Browser fixture')
    await page.evaluate(async () => {
      const { setSupabaseClientForUnitTests } = await import('/src/api/supabase/client.ts')
      window.inviteCalls = 0
      setSupabaseClientForUnitTests({
        auth: { getSession: async () => ({ data: { session: { user: { id: 'fixture-user' } } } }) },
        rpc: async () => { window.inviteCalls++; return new Promise(resolve => { window.finishInvite = () => resolve({ data: { room_id:'AOV-1024' }, error:null }) }) },
      })
    })
    await page.getByRole('button',{ name:'V\u00e0o ph\u00f2ng' }).click()
    await page.waitForFunction(() => window.inviteCalls === 1)
    assert.equal(await page.getByText('\u0110\u00e3 tham gia ph\u00f2ng',{ exact:true }).count(),0)
    assert.equal(await page.getByRole('button',{ name:'\u0110ang v\u00e0o ph\u00f2ng\u2026' }).isDisabled(),true)
    await page.evaluate(() => window.finishInvite())
    await page.waitForURL('**/rooms/AOV-1024')
    await page.getByText('\u0110\u00e3 tham gia ph\u00f2ng',{ exact:true }).waitFor()
    assert.equal(await page.evaluate(() => window.inviteCalls),1)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false)
    assert.equal(requests.length,0)
    console.log(`PASS ${width}px: discovery fallback, explicit pending join, success only after RPC, correct Room, zero Supabase requests`)
    await context.close()
  }
} finally { await browser.close() }
