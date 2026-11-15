// E2E (Playwright): auth qua API thật (/api/auth/*).
// Cần backend đã seed + Vite chạy với VITE_DATA_SOURCE=api.
// Dùng: node scripts/e2e-auth-api.mjs [webUrl]
import { chromium } from 'playwright'

const base = process.argv[2] ?? 'http://localhost:5189'
const browser = await chromium.launch()
let failures = 0
const check = (ok, msg) => {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`)
}

const headerState = (page) =>
  page.evaluate(() => ({
    path: location.pathname + location.search,
    avatar: !!document.querySelector('header button[aria-label^="Tài khoản"]'),
    loginLink: [...document.querySelectorAll('header a')].some((a) => a.textContent.trim() === 'Đăng nhập'),
    dialog: !!document.querySelector('[role=dialog]'),
  }))

async function open(path) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  await page.goto(base + path, { waitUntil: 'networkidle' })
  return { ctx, page }
}

// 1) Đăng ký user mới → vào /dashboard
{
  const newUsername = `u_${Date.now().toString(36)}`
  const { ctx, page } = await open('/?login=register')
  await page.waitForSelector('[role=dialog]')
  await page.fill('[role=dialog] input[autocomplete="username"]', newUsername)
  await page.fill('[role=dialog] input[autocomplete="nickname"]', 'Test User')
  await page.fill('[role=dialog] input[autocomplete="new-password"]', 'customaov123')
  await page.click('[role=dialog] button[type="submit"]')
  await page.waitForURL('**/dashboard')
  await page.waitForSelector('header button[aria-label^="Tài khoản"]', { timeout: 5000 }).catch(() => {})
  let s = await headerState(page)
  check(s.path === '/dashboard' && s.avatar && !s.loginLink, `đăng ký user mới → vào /dashboard (${JSON.stringify(s)})`)

  // 2) Đăng xuất → bị chặn ở /dashboard
  await page.click('header button[aria-label^="Tài khoản"]')
  await page.click('[role=menuitem]:has-text("Đăng xuất")')
  await page.waitForURL(base + '/')
  await page.goto(base + '/dashboard', { waitUntil: 'networkidle' })
  s = await headerState(page)
  check(s.path.startsWith('/?login=login') && s.dialog && !s.avatar, `sau đăng xuất, mở /dashboard bị chặn (${JSON.stringify(s)})`)
  await ctx.close()
}

// 3) Sai mật khẩu → hiện lỗi chung
{
  const { ctx, page } = await open('/?login=login')
  await page.waitForSelector('[role=dialog]')
  await page.fill('[role=dialog] input[autocomplete="username"]', 'suthy')
  await page.fill('[role=dialog] input[autocomplete="current-password"]', 'wrongpassword1')
  await page.click('[role=dialog] button[type="submit"]')
  const alertText = await page.locator('[role=dialog] [role="alert"]').first().textContent()
  check(Boolean(alertText && alertText.includes('Tên đăng nhập hoặc mật khẩu không đúng')), `sai mật khẩu → hiện lỗi chung (${alertText})`)
  await ctx.close()
}

// 4) Khách mở /profile → đăng nhập suthy/customaov123 → quay về /profile; tải lại vẫn đăng nhập
{
  const { ctx, page } = await open('/profile')
  await page.waitForSelector('[role=dialog]')
  await page.fill('[role=dialog] input[autocomplete="username"]', 'suthy')
  await page.fill('[role=dialog] input[autocomplete="current-password"]', 'customaov123')
  await page.click('[role=dialog] button[type="submit"]')
  await page.waitForURL('**/profile')
  await page.waitForSelector('header button[aria-label^="Tài khoản"]', { timeout: 5000 }).catch(() => {})
  let s = await headerState(page)
  check(s.path === '/profile' && s.avatar, `đăng nhập suthy → quay về /profile (${JSON.stringify(s)})`)

  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector('header button[aria-label^="Tài khoản"]', { timeout: 5000 }).catch(() => {})
  s = await headerState(page)
  check(s.path === '/profile' && s.avatar, `tải lại /profile vẫn đăng nhập (${JSON.stringify(s)})`)
  await ctx.close()
}

await browser.close()
console.log(failures ? `\n${failures} kiểm tra FAIL` : '\nTất cả kiểm tra API auth đều đạt')
process.exit(failures ? 1 : 0)
