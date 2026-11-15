// E2E (Playwright): session mock + route guard.
// Cần dev server đang chạy. Dùng: npm run test:e2e [-- baseUrl]
import { chromium } from 'playwright'

const base = process.argv[2] ?? 'http://localhost:5174'
const KEY = 'customaov.mockLoggedIn'
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

/** Mở một context mới; session = true thì cài sẵn session mock trước khi trang chạy */
async function open(path, session) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  if (session) await ctx.addInitScript((k) => localStorage.setItem(k, '1'), KEY)
  const page = await ctx.newPage()
  await page.goto(base + path, { waitUntil: 'networkidle' })
  return { ctx, page }
}

// 1) Đã có session → mở thẳng route nội bộ: header có avatar, không có "Đăng nhập"
for (const path of ['/dashboard', '/profile', '/rooms/AOV-1024', '/rooms/new']) {
  const { ctx, page } = await open(path, true)
  const s = await headerState(page)
  check(s.path === path && s.avatar && !s.loginLink, `có session, mở thẳng ${path} → header có avatar (${JSON.stringify(s)})`)
  await ctx.close()
}

// 2) Chưa có session → bị chuyển về landing + hộp đăng nhập, next = route gốc
for (const path of ['/dashboard', '/profile', '/rooms/AOV-1024']) {
  const { ctx, page } = await open(path, false)
  const s = await headerState(page)
  const expected = `/?login=login&next=${encodeURIComponent(path)}`
  check(s.path === expected && s.dialog && !s.avatar, `khách mở ${path} → ${expected} + hộp đăng nhập (${JSON.stringify(s)})`)
  await ctx.close()
}

// 3) Khách → bị chặn → đăng nhập → quay lại đúng route; tải lại vẫn giữ session
{
  const { ctx, page } = await open('/profile', false)
  await page.click('[role=dialog] button:has-text("tài khoản mẫu")')
  await page.waitForURL('**/profile')
  // chờ trang đích render xong (header của trang nội bộ) rồi mới đo
  await page.waitForSelector('header button[aria-label^="Tài khoản"]', { timeout: 5000 }).catch(() => {})
  let s = await headerState(page)
  check(s.path === '/profile' && s.avatar, `đăng nhập xong quay lại /profile (${JSON.stringify(s)})`)
  check((await page.evaluate((k) => localStorage.getItem(k), KEY)) === '1', 'session được lưu vào localStorage')
  await page.reload({ waitUntil: 'networkidle' })
  s = await headerState(page)
  check(s.path === '/profile' && s.avatar, `tải lại /profile vẫn đăng nhập (${JSON.stringify(s)})`)

  // 4) Đăng xuất → xoá session; mở lại route nội bộ bị chặn
  await page.click('header button[aria-label^="Tài khoản"]')
  await page.click('[role=menuitem]:has-text("Đăng xuất")')
  await page.waitForURL(base + '/')
  check((await page.evaluate((k) => localStorage.getItem(k), KEY)) === null, 'đăng xuất xoá session khỏi localStorage')
  await page.goto(base + '/dashboard', { waitUntil: 'networkidle' })
  s = await headerState(page)
  check(s.path.startsWith('/?login=login') && !s.avatar, `sau đăng xuất, mở /dashboard bị chặn (${JSON.stringify(s)})`)
  await ctx.close()
}

// 5) Trang công khai: khách xem được, header ở trạng thái khách
{
  const { ctx, page } = await open('/tournaments', false)
  const s = await headerState(page)
  check(s.path === '/tournaments' && s.loginLink && !s.avatar, `khách mở /tournaments không bị chặn (${JSON.stringify(s)})`)
  await ctx.close()
}

await browser.close()
console.log(failures ? `\n${failures} kiểm tra FAIL` : '\nTất cả kiểm tra đều đạt')
process.exit(failures ? 1 : 0)
