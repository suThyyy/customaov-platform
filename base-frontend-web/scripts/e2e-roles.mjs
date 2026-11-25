// Mock-only browser acceptance; blocks and fails on every Supabase request.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
const base = process.argv[2] ?? 'http://127.0.0.1:5174'
if (!['localhost','127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local Mock server required')
const browser = await chromium.launch()
let checks = 0
try {
  for (const width of [390,768,1280,1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } })
    const supabase = [], errors = []
    await context.route(/supabase\.(co|in)/, route => { supabase.push(route.request().url()); return route.abort() })
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(base, { waitUntil: 'networkidle' })
    const persona = page.getByRole('combobox', { name: /Vai trò kiểm thử/ })
    assert.equal(await persona.count(),1,'Mock selector required')
    for (const role of ['user','admin','super_admin']) {
      await persona.selectOption(role)
      await page.waitForURL('**/dashboard')
      await page.goto(base + '/rooms/new', { waitUntil: 'networkidle' })
      if (role === 'user') assert.match(await page.getByRole('alert').innerText(),/không có quyền/)
      else assert.match(await page.locator('h1').innerText(),/Tạo phòng/)
      checks++
      await page.reload({ waitUntil: 'networkidle' })
      assert.equal(await persona.inputValue(),role); checks++
      await page.goto(base + '/platform-admin', { waitUntil: 'networkidle' })
      if (role === 'super_admin') assert.match(await page.locator('h1').innerText(),/Quản trị nền tảng/)
      else assert.match(await page.getByRole('alert').innerText(),/không có quyền/)
      checks++
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false,`${role} ${width}px overflow`); checks++
    }
    // Community workflows intentionally excluded. Room ownership remains covered by unit tests.
    for (const role of ['user','admin','super_admin']) {
      await persona.selectOption(role)
      await page.goto(base + '/quick-team', { waitUntil: 'networkidle' })
      assert.match(await page.locator('h1').innerText(),/Chia đội nhanh/); checks++
    }
    await persona.selectOption('guest')
    await page.goto(base + '/rooms/new', { waitUntil: 'networkidle' })
    assert.equal(new URL(page.url()).searchParams.get('next'),'/rooms/new'); checks++
    assert.equal(supabase.length,0,'Mock contacted Supabase'); checks++
    assert.deepEqual(errors,[]); checks++
    await context.close()
  }
  console.log(`PASS ${checks} Mock browser role/navigation/ownership checks at 390/768/1280/1440px; zero Supabase requests.`)
} finally { await browser.close() }
