// E2E (Playwright): giải 8 đội BO3 qua API thật từ tạo giải → duyệt đội → bốc thăm → nhập tỉ số → vô địch.
// Cần backend đã seed + Vite chạy với VITE_DATA_SOURCE=api.
// Dùng: node scripts/e2e-tournament-api.mjs [webUrl]
import { chromium, request } from 'playwright'

const base = process.argv[2] ?? 'http://localhost:5210'
const PASS = 'customaov123'
const runId = Date.now().toString(36)

let failures = 0
const check = (ok, msg) => {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`)
}

/**
 * Tạo client API có cookie jar + CSRF token riêng cho một tài khoản.
 * Xử lý 429 theo header `retry-after` nếu vượt rate limit đăng nhập.
 */
async function createApiClient() {
  const ctx = await request.newContext({ baseURL: base })
  let csrfToken = ''

  const refreshCsrf = async () => {
    const res = await ctx.get('/api/auth/csrf')
    if (!res.ok()) throw new Error(`GET /api/auth/csrf failed: ${res.status()}`)
    const data = await res.json()
    csrfToken = data.csrfToken
    return csrfToken
  }

  const post = async (url, data) => {
    if (!csrfToken) await refreshCsrf()
    return ctx.post(url, {
      headers: { 'x-csrf-token': csrfToken },
      data,
    })
  }

  const register = async (username, displayName, password = PASS) => {
    await refreshCsrf()
    const res = await post('/api/auth/register', { username, displayName, password })
    if (res.status() === 201) await refreshCsrf()
    return res
  }

  const login = async (username, password = PASS) => {
    await refreshCsrf()
    let res = await post('/api/auth/login', { username, password })
    if (res.status() === 429) {
      const retryAfter = Number(res.headers()['retry-after'] ?? '60')
      await new Promise((r) => setTimeout(r, (retryAfter + 1) * 1000))
      await refreshCsrf()
      res = await post('/api/auth/login', { username, password })
    }
    if (res.status() === 200) await refreshCsrf()
    return res
  }

  return { ctx, refreshCsrf, post, register, login }
}

const clientsToClose = []
let browser

try {
  // 1) Chuẩn bị 1 BTC + 40 người chơi (8 đội x 5) + 1 đội thứ 9 (5 người).
  // Do backend giới hạn registerLimit = 5/giờ/IP và loginIpLimit = 5/phút/IP:
  // đăng ký mới 5 tài khoản (1 BTC + 4 đội trưởng), đăng nhập 5 đội trưởng từ seed users,
  // và dùng 36 seed users còn lại làm thành viên đội.
  const btcUsername = `btc_${runId}`
  const btcClient = await createApiClient()
  clientsToClose.push(btcClient.ctx)
  const btcReg = await btcClient.register(btcUsername, `BTC ${runId}`)
  check(btcReg.status() === 201, `1.1) Đăng ký BTC ${btcUsername} (status=${btcReg.status()})`)

  const newCaptains = []
  for (let i = 1; i <= 4; i++) {
    const username = `cap${i}_${runId}`
    const c = await createApiClient()
    clientsToClose.push(c.ctx)
    const res = await c.register(username, `Captain ${i}`)
    if (res.status() !== 201) {
      throw new Error(`Đăng ký đội trưởng ${username} thất bại: ${res.status()} ${await res.text()}`)
    }
    newCaptains.push({ username, client: c })
  }
  check(newCaptains.length === 4, '1.2) Đăng ký mới 4 đội trưởng qua API kèm CSRF')

  const seededCaptains = ['player_01', 'player_06', 'player_11', 'player_16', 'player_21']
  const loggedInSeeded = []
  for (const username of seededCaptains) {
    const c = await createApiClient()
    clientsToClose.push(c.ctx)
    const res = await c.login(username)
    if (res.status() !== 200) {
      throw new Error(`Đăng nhập đội trưởng seed ${username} thất bại: ${res.status()} ${await res.text()}`)
    }
    loggedInSeeded.push({ username, client: c })
  }
  check(loggedInSeeded.length === 5, '1.3) Đăng nhập 5 đội trưởng seed qua API kèm CSRF')

  const pool = [
    ...Array.from({ length: 35 }, (_, idx) => `player_${String(idx + 1).padStart(2, '0')}`),
    'vanhh',
    'minz',
    'khoaneo',
    'tine',
    'hieukm',
    'rika',
    'long2k',
    'phuct',
    'nanm',
    'linh',
    'minh',
  ].filter((u) => !seededCaptains.includes(u))

  // 8 đội chính thức + 1 đội dự phòng (đội thứ 9)
  const captains = [...newCaptains, ...loggedInSeeded.slice(0, 4)]
  const extraCaptain = loggedInSeeded[4]
  const teams = captains.map((cap, idx) => ({
    teamName: `Đội E2E ${idx + 1}`,
    captain: cap.username,
    client: cap.client,
    members: [cap.username, ...pool.slice(idx * 4, idx * 4 + 4)],
  }))
  const team9 = {
    teamName: 'Đội E2E 9',
    captain: extraCaptain.username,
    client: extraCaptain.client,
    members: [extraCaptain.username, ...pool.slice(32, 36)],
  }

  // Lưu số danh hiệu ban đầu của mỗi đội trưởng để kiểm tra +1 sau chung kết
  const beforeTitles = new Map()
  for (const t of teams) {
    const profRes = await btcClient.ctx.get(`/api/users/${encodeURIComponent(t.captain)}`)
    if (!profRes.ok()) throw new Error(`GET /api/users/${t.captain} failed: ${profRes.status()}`)
    const prof = await profRes.json()
    beforeTitles.set(t.captain, prof.stats.titles ?? 0)
  }

  // 2) BTC tạo giải 8 đội BO3 qua UI /tournaments/new, rồi tới /tournaments/<slug>
  browser = await chromium.launch()
  const btcStorage = await btcClient.ctx.storageState()
  const btcBrowserCtx = await browser.newContext({ viewport: { width: 1280, height: 800 }, storageState: btcStorage })
  const page = await btcBrowserCtx.newPage()

  const tourName = `Giải E2E ${runId}`
  await page.goto(`${base}/tournaments/new`, { waitUntil: 'networkidle' })
  await page.waitForSelector('h1:has-text("Tạo giải đấu")')

  // Bước 1: Thông tin
  const nameInput = page.locator('input[maxlength="60"]').first()
  await nameInput.fill(tourName)
  await page.click('button[type="submit"]:has-text("Tiếp tục")')

  // Bước 2: Thể thức (8 đội, BO3)
  await page.click('label:has-text("8 đội")')
  await page.click('label:has-text("BO3")')
  await page.click('button[type="submit"]:has-text("Tiếp tục")')

  // Bước 3: Lịch thi đấu (đặt ngày tương lai để luôn hợp lệ)
  const pad = (n) => String(n).padStart(2, '0')
  const fmtLocal = (daysFromNow, hour, min) => {
    const d = new Date(Date.now() + daysFromNow * 86_400_000)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(hour)}:${pad(min)}`
  }
  const dateInputs = page.locator('input[type="datetime-local"]')
  await dateInputs.nth(0).fill(fmtLocal(5, 23, 59))
  await dateInputs.nth(1).fill(fmtLocal(6, 19, 0))
  await dateInputs.nth(2).fill(fmtLocal(7, 18, 0))
  await dateInputs.nth(3).fill(fmtLocal(12, 22, 0))
  await page.click('button[type="submit"]:has-text("Tiếp tục")')

  // Bước 4: Luật & giải thưởng → Tạo giải
  await page.click('button[type="submit"]:has-text("Tạo giải")')
  await page.waitForURL((url) => url.pathname.startsWith('/tournaments/') && url.pathname !== '/tournaments/new', {
    timeout: 15000,
  })
  const slug = new URL(page.url()).pathname.split('/').pop()
  await page.waitForSelector(`h1:has-text("${tourName}")`)
  check(Boolean(slug) && slug !== 'new', `2) BTC tạo giải 8 đội BO3 qua UI → /tournaments/${slug}`)

  // 3) 8 đội trưởng đăng ký 8 đội (API)
  let regOk = 0
  for (const t of teams) {
    const res = await t.client.post(`/api/tournaments/${slug}/registrations`, {
      teamName: t.teamName,
      members: t.members,
    })
    if (res.status() === 201) regOk++
    else console.log(`   reg fail ${t.teamName}: ${res.status()} ${await res.text()}`)
  }
  check(regOk === 8, `3) 8 đội trưởng đăng ký 8 đội qua API (${regOk}/8 thành công)`)

  // 4) BTC duyệt 8 đội trong RegistrationsPanel (UI), đội thứ 9 → 409, đóng đăng ký, bốc thăm (UI)
  await page.click('[role="tab"]:has-text("Danh sách đội")')
  await page.waitForSelector('ul[aria-label="Đơn chờ duyệt"]')
  for (const t of teams) {
    const approveBtn = page.locator(`button[aria-label="Duyệt đội ${t.teamName}"]`)
    await approveBtn.click()
    await approveBtn.waitFor({ state: 'detached', timeout: 10000 })
  }
  await page.waitForSelector('text=Đã duyệt 8/8')
  check(true, '4.1) BTC duyệt 8 đội trong RegistrationsPanel (UI)')

  // Đội thứ 9 đăng ký sau khi giải đã duyệt đủ 8/8 đội → 409
  const res9 = await team9.client.post(`/api/tournaments/${slug}/registrations`, {
    teamName: team9.teamName,
    members: team9.members,
  })
  check(res9.status() === 409, `4.2) Đội thứ 9 đăng ký bị từ chối 409 (status=${res9.status()})`)

  // Đóng đăng ký (UI)
  await page.click('[aria-labelledby="organizer-title"] button:has-text("Đóng đăng ký")')
  await page.click('[role="dialog"] button:has-text("Đóng đăng ký")')
  await page.waitForSelector('text=Đã đóng đăng ký · 8 đội đã duyệt · chưa bốc thăm')
  check(true, '4.3) BTC đóng đăng ký qua UI')

  // Bốc thăm (UI)
  await page.click('[aria-labelledby="organizer-title"] button:has-text("Bốc thăm")')
  await page.click('[role="dialog"] button:has-text("Bốc thăm")')
  await page.waitForSelector('button:has-text("Quản lý trận đấu")')
  const liveText = await page.locator('text=Đang diễn ra').first().isVisible()
  check(liveText, '4.4) BTC bốc thăm qua UI → giải chuyển live')

  // Kiểm tra tab Bảng đấu có đủ 8 đội
  await page.click('[role="tab"]:has-text("Bảng đấu")')
  await page.waitForSelector('text=Tứ kết')
  check(true, '4.5) Tab Bảng đấu hiển thị nhánh 8 đội (Tứ kết → Chung kết)')

  // 5) BTC nhập tỉ số cho mọi trận tới chung kết bằng ScoreDialog (UI; thử 1 tỉ số sai BO và thấy lỗi)
  let invalidChecked = false
  for (let i = 0; i < 7; i++) {
    const nextScoreBtn = page
      .locator('[aria-labelledby="organizer-title"] ul li:not(:has(span.text-gold)) button:has-text("Nhập tỉ số")')
      .first()
    await nextScoreBtn.waitFor({ state: 'visible', timeout: 10000 })
    await nextScoreBtn.click()
    await page.waitForSelector('[role="dialog"] h2:has-text("Nhập tỉ số")')

    const selects = page.locator('[role="dialog"] select')
    if (!invalidChecked) {
      await selects.nth(0).selectOption('1')
      await selects.nth(1).selectOption('1')
      const errText = await page.locator('[role="dialog"] [role="alert"]').first().textContent()
      const submitDisabled = await page.locator('[role="dialog"] button[type="submit"]').isDisabled()
      check(
        Boolean(errText && errText.includes('không hợp lệ với thể thức BO3') && submitDisabled),
        `5.1) ScoreDialog chặn tỉ số sai BO3 (1–1) và hiện lỗi (${errText?.trim()})`,
      )
      invalidChecked = true
    }

    await selects.nth(0).selectOption('2')
    await selects.nth(1).selectOption('0')
    await page.click('[role="dialog"] button[type="submit"]:has-text("Lưu tỉ số")')
    await page.waitForSelector('[role="dialog"]', { state: 'detached', timeout: 10000 })
  }
  await page.waitForSelector('[aria-labelledby="organizer-title"]:has-text("Giải đã kết thúc")')
  check(true, '5.2) BTC nhập tỉ số đủ 7 trận tới chung kết bằng ScoreDialog')

  // 6) Giải finished, tab Kết quả hiện nhà vô địch; hồ sơ thành viên đội vô địch có titles +1
  await page.click('[role="tab"]:has-text("Kết quả")')
  const championCard = page.locator(`div:has(> p:has-text("Nhà vô địch ${tourName}"))`)
  await championCard.waitFor({ state: 'visible', timeout: 10000 })
  const championName = (await championCard.locator('p').nth(1).textContent())?.trim() ?? ''
  const championTeam = teams.find((t) => t.teamName === championName)
  check(Boolean(championTeam), `6.1) Giải finished, tab Kết quả hiện nhà vô địch: ${championName}`)

  if (championTeam) {
    const prev = beforeTitles.get(championTeam.captain) ?? 0
    await page.goto(`${base}/profile/${encodeURIComponent(championTeam.captain)}`, { waitUntil: 'networkidle' })
    const titlesDd = page.locator('div:has(> dt:text-is("Danh hiệu")) dd')
    await titlesDd.waitFor({ state: 'visible', timeout: 10000 })
    const titlesText = (await titlesDd.textContent())?.trim() ?? ''
    const actualTitles = Number(titlesText)
    check(
      actualTitles === prev + 1,
      `6.2) Hồ sơ thành viên đội vô địch (${championTeam.captain}) có titles +1 (${prev} → ${actualTitles})`,
    )
  }

  await btcBrowserCtx.close()
} finally {
  if (browser) await browser.close()
  for (const ctx of clientsToClose) await ctx.dispose()
}

console.log(failures ? `\n${failures} kiểm tra FAIL` : '\nTất cả kiểm tra E2E giải đấu đều đạt')
process.exit(failures ? 1 : 0)
