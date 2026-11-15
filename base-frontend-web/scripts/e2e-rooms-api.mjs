// E2E (Playwright): luồng phòng 10 người qua API thật + WebSocket (/api/rooms/*, /api/ws).
// Cần backend đã seed + Vite chạy với VITE_DATA_SOURCE=api.
// Dùng: node scripts/e2e-rooms-api.mjs [webUrl]
import { chromium } from 'playwright'

const base = (process.argv[2] ?? 'http://localhost:5209').replace(/\/+$/, '')
const DEMO_PASSWORD = 'customaov123'
const SEEDED_POOL = [
  { username: 'linh', leaveRoom: null },
  { username: 'minh', leaveRoom: null },
  { username: 'player_11', leaveRoom: 'AOV-1026' },
  { username: 'player_12', leaveRoom: 'AOV-1026' },
  { username: 'player_13', leaveRoom: 'AOV-1026' },
]

let failures = 0
const check = (ok, msg) => {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

class ApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl
    this.cookies = new Map()
    this.user = null
  }

  captureCookies(res) {
    const rawList = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
    for (const raw of rawList) {
      const [pair] = raw.split(';')
      const eq = pair.indexOf('=')
      if (eq > 0) this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim())
    }
  }

  cookieHeader() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
  }

  async ensureCsrf() {
    if (this.cookies.has('csrf')) return decodeURIComponent(this.cookies.get('csrf'))
    const res = await fetch(`${this.baseUrl}/api/auth/csrf`, {
      headers: this.cookies.size ? { cookie: this.cookieHeader() } : undefined,
    })
    this.captureCookies(res)
    const body = await res.json().catch(() => ({}))
    const raw = this.cookies.get('csrf')
    return raw ? decodeURIComponent(raw) : body.csrfToken
  }

  async request(method, path, body) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const headers = {}
      if (method !== 'GET' && method !== 'HEAD') {
        headers['x-csrf-token'] = await this.ensureCsrf()
      }
      if (this.cookies.size) headers.cookie = this.cookieHeader()
      if (body !== undefined) headers['content-type'] = 'application/json'

      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
      this.captureCookies(res)
      if (res.status === 429 && attempt < 2) {
        const retryAfter = Number(res.headers.get('retry-after') ?? '60')
        console.log(`info 429 tại ${method} ${path}, chờ ${retryAfter + 1}s rồi thử lại...`)
        await sleep((retryAfter + 1) * 1000)
        continue
      }
      const text = await res.text()
      let data = text
      try {
        data = JSON.parse(text)
      } catch {
        // giữ nguyên text nếu không phải JSON
      }
      if (!res.ok) {
        const msg = data?.error?.message ?? data?.message ?? `${res.status}`
        throw new Error(`${method} ${path} -> ${res.status}: ${msg}`)
      }
      return data
    }
    throw new Error(`${method} ${path} vượt quá số lần thử`)
  }
}

async function prepareTenUsers() {
  const clients = []
  const tag = Date.now().toString(36)

  // Đăng ký tối đa 5 tài khoản mới (theo rate limit 5/giờ/IP), phần còn lại dùng tài khoản seed
  for (let i = 0; i < 5; i++) {
    const client = new ApiClient(base)
    const username = `e2e_${tag}_${i}`
    const data = await client.request('POST', '/api/auth/register', {
      username,
      displayName: `E2E User ${i + 1}`,
      password: DEMO_PASSWORD,
    })
    client.user = data.user
    clients.push(client)
  }

  for (const seed of SEEDED_POOL) {
    const client = new ApiClient(base)
    const data = await client.request('POST', '/api/auth/login', {
      username: seed.username,
      password: DEMO_PASSWORD,
    })
    client.user = data.user
    if (seed.leaveRoom) {
      await client.request('POST', `/api/rooms/${seed.leaveRoom}/leave`)
    }
    clients.push(client)
  }

  return clients
}

async function openAuthedContext(browser, client, permissions = []) {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    permissions,
  })
  await ctx.addCookies(
    [...client.cookies.entries()].map(([name, value]) => ({
      name,
      value,
      url: base,
    })),
  )
  const page = await ctx.newPage()
  return { ctx, page }
}

const regionMembers = async (page, regionLabel) => {
  const region = page.getByRole('region', { name: regionLabel })
  return region.locator('[data-player-id]').evaluateAll((els) =>
    els.map((el) => ({
      id: el.getAttribute('data-player-id'),
      text: el.textContent ?? '',
    })),
  )
}

const browser = await chromium.launch()
try {
  // 1) Chuẩn bị 10 tài khoản (5 đăng ký mới kèm CSRF + 5 tài khoản seed)
  const users = await prepareTenUsers()
  const host = users[0]
  const player2 = users[1]
  check(users.length === 10 && users.every((u) => Boolean(u.user?.id)), `1) chuẩn bị 10 tài khoản (5 đăng ký mới + 5 seed)`)

  // 2) Host tạo phòng 5v5 công khai qua UI /rooms/new
  const { ctx: hostCtx, page: hostPage } = await openAuthedContext(browser, host, ['clipboard-read', 'clipboard-write'])
  const roomTitle = `Phòng E2E ${Date.now().toString(36)}`
  await hostPage.goto(`${base}/rooms/new`, { waitUntil: 'networkidle' })
  await hostPage.getByRole('textbox', { name: /Tên phòng/ }).fill(roomTitle)
  await hostPage.getByText('Giao hữu', { exact: true }).click()
  await hostPage.getByText('Công khai', { exact: true }).click()
  await hostPage.getByRole('button', { name: 'Tiếp tục' }).click()
  await hostPage.getByRole('button', { name: 'Tiếp tục' }).click()
  await hostPage.getByRole('button', { name: 'Tiếp tục' }).click()
  await hostPage.getByRole('button', { name: 'Tạo phòng' }).click()
  await hostPage.waitForURL(/\/rooms\/AOV-[A-Z0-9]+/)
  const roomCode = new URL(hostPage.url()).pathname.split('/').pop()
  await hostPage.getByRole('heading', { level: 1, name: new RegExp(roomTitle) }).waitFor()
  check(Boolean(roomCode && roomCode.startsWith('AOV-')), `2) host tạo phòng 5v5 công khai qua UI (${roomCode})`)

  // 3) 9 người vào phòng (API). Mở 2 context (host + 1 người chơi) ở /rooms/<code>
  for (const memberClient of users.slice(1)) {
    await memberClient.request('POST', `/api/rooms/${roomCode}/join`, { as: 'player' })
  }
  const { ctx: playerCtx, page: playerPage } = await openAuthedContext(browser, player2)
  await playerPage.goto(`${base}/rooms/${roomCode}`, { waitUntil: 'networkidle' })
  await playerPage.getByRole('heading', { level: 1, name: new RegExp(roomTitle) }).waitFor()
  await hostPage.getByText('10/10').waitFor()
  await playerPage.getByText('10/10').waitFor()
  const hostBlue3 = await regionMembers(hostPage, 'Team Xanh')
  const hostRed3 = await regionMembers(hostPage, 'Team Đỏ')
  const playerBlue3 = await regionMembers(playerPage, 'Team Xanh')
  const playerRed3 = await regionMembers(playerPage, 'Team Đỏ')
  check(
    hostBlue3.length === 5 && hostRed3.length === 5 && playerBlue3.length === 5 && playerRed3.length === 5,
    `3) 9 người vào phòng, cả 2 browser thấy đủ 10/10 (5-5)`,
  )

  // 4) Host bấm "Chia lại" (random): cả 2 trình duyệt thấy đội 5-5 cập nhật qua WS, không tải lại
  await hostPage.getByRole('button', { name: 'Chia lại' }).click()
  await hostPage.getByText('Đã chia đội').waitFor()
  const hostBlue4 = await regionMembers(hostPage, 'Team Xanh')
  const hostRed4 = await regionMembers(hostPage, 'Team Đỏ')
  const expectedBlueIds = hostBlue4.map((m) => m.id).join(',')
  const expectedRedIds = hostRed4.map((m) => m.id).join(',')
  let playerBlue4 = []
  let playerRed4 = []
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    playerBlue4 = await regionMembers(playerPage, 'Team Xanh')
    playerRed4 = await regionMembers(playerPage, 'Team Đỏ')
    if (
      playerBlue4.map((m) => m.id).join(',') === expectedBlueIds &&
      playerRed4.map((m) => m.id).join(',') === expectedRedIds
    ) {
      break
    }
    await sleep(200)
  }
  check(
    hostBlue4.length === 5 &&
      hostRed4.length === 5 &&
      playerBlue4.length === 5 &&
      playerRed4.length === 5 &&
      expectedBlueIds === playerBlue4.map((m) => m.id).join(',') &&
      expectedRedIds === playerRed4.map((m) => m.id).join(','),
    `4) host bấm "Chia lại" → cả 2 browser cập nhật đội 5-5 qua WebSocket`,
  )

  // 5) Người chơi chat: host thấy tin realtime
  const chatMsg = `Xin chào E2E ${Date.now()}`
  const chatInput = playerPage.getByLabel('Nhập tin nhắn')
  await chatInput.fill(chatMsg)
  await chatInput.press('Enter')
  await hostPage.getByRole('log', { name: 'Tin nhắn trong phòng' }).getByText(chatMsg).waitFor()
  check(true, `5) người chơi gửi chat → host thấy tin realtime`)

  // 6) Host mời ra 1 người (player2) + đổi chỗ 1 người sang đội vừa trống: người bị mời ra về /dashboard
  const p2InBlue = hostBlue4.some((m) => m.id === player2.user.username)
  const p2SideLabel = p2InBlue ? 'Team Xanh' : 'Team Đỏ'
  const otherSideLabel = p2InBlue ? 'Team Đỏ' : 'Team Xanh'

  await hostPage.getByRole('button', { name: `Tuỳ chọn cho ${player2.user.displayName}` }).click()
  await hostPage.getByRole('menuitem', { name: /Mời ra khỏi phòng/ }).click()

  await playerPage.waitForURL('**/dashboard')
  await playerPage.getByText('Bạn đã bị mời ra khỏi phòng').waitFor()
  await hostPage.getByText('9/10').waitFor()

  // Chọn 1 người chơi (không phải host) ở đội còn đủ 5 người để chuyển sang đội vừa bị kick (4 người)
  const otherMembers = await regionMembers(hostPage, otherSideLabel)
  const moveCandidate = users.find(
    (u) => u.user.username !== host.user.username && otherMembers.some((m) => m.id === u.user.username),
  )
  await hostPage.getByRole('button', { name: `Tuỳ chọn cho ${moveCandidate.user.displayName}` }).click()
  await hostPage.getByRole('menuitem', { name: new RegExp(`Chuyển sang ${p2SideLabel}`) }).click()
  await hostPage.getByText(`Đã chuyển ${moveCandidate.user.displayName} sang ${p2SideLabel}`).waitFor()
  const afterMoveDest = await regionMembers(hostPage, p2SideLabel)
  check(
    afterMoveDest.some((m) => m.id === moveCandidate.user.username),
    `6) host mời ${player2.user.displayName} ra (/dashboard) và chuyển ${moveCandidate.user.displayName} sang ${p2SideLabel}`,
  )

  // Người bị kick bị cooldown 10 phút nên dùng 1 tài khoản seed khác (player_14) vào bù để đủ 10/10 ghi kết quả
  const subPlayer = new ApiClient(base)
  const subLogin = await subPlayer.request('POST', '/api/auth/login', {
    username: 'player_14',
    password: DEMO_PASSWORD,
  })
  subPlayer.user = subLogin.user
  await subPlayer.request('POST', '/api/rooms/AOV-1026/leave')
  await subPlayer.request('POST', `/api/rooms/${roomCode}/join`, { as: 'player' })
  await hostPage.getByText('10/10').waitFor()

  // Đọc dữ liệu phòng và số trận trước khi ghi kết quả của 1 người thắng ở Team Xanh
  const roomBeforeResult = await host.request('GET', `/api/rooms/${roomCode}`)
  const winnerUser = roomBeforeResult.teams.blue[0].user
  const winnerProfileBefore = await host.request('GET', `/api/users/${encodeURIComponent(winnerUser.username)}`)

  // 7) Host "Xuất kết quả" (clipboard) rồi ghi kết quả Team Xanh thắng
  await hostPage.getByRole('button', { name: 'Xuất kết quả chia đội' }).click()
  await hostPage.getByText('Đã sao chép kết quả chia đội').waitFor()
  const clipboardText = await hostPage.evaluate(() => navigator.clipboard.readText())
  const hasClipboard = clipboardText.includes('Team Xanh') && clipboardText.includes('Team Đỏ')

  await hostPage.getByRole('button', { name: 'Team Xanh thắng' }).click()
  await hostPage.getByText('Đã kết thúc · Team Xanh thắng').waitFor()

  const roomAfterResult = await host.request('GET', `/api/rooms/${roomCode}`)
  const winnerProfileAfter = await host.request('GET', `/api/users/${encodeURIComponent(winnerUser.username)}`)
  const customMatchesPlusOne =
    winnerProfileAfter.stats.customMatches === winnerProfileBefore.stats.customMatches + 1

  // Kiểm tra trên UI hồ sơ người thắng và /dashboard
  await hostPage.goto(`${base}/profile/${encodeURIComponent(winnerUser.username)}`, { waitUntil: 'networkidle' })
  const profileHasStat = await hostPage.getByText('Trận Custom').isVisible()

  await hostPage.goto(`${base}/dashboard`, { waitUntil: 'networkidle' })
  await hostPage.getByText(`Trận đấu phòng "${roomTitle}" đã kết thúc`).waitFor()
  const activities = await host.request('GET', '/api/activities')
  const hasResultActivity = activities.items.some(
    (a) => a.kind === 'result' && a.text.includes(roomTitle),
  )

  check(
    hasClipboard &&
      roomAfterResult.status === 'finished' &&
      customMatchesPlusOne &&
      profileHasStat &&
      hasResultActivity,
    `7) xuất clipboard (${hasClipboard}), phòng finished (${roomAfterResult.status}), customMatches +1 (${winnerProfileBefore.stats.customMatches}->${winnerProfileAfter.stats.customMatches}), dashboard có hoạt động "result"`,
  )

  await playerCtx.close()
  await hostCtx.close()
} finally {
  await browser.close()
}

console.log(failures ? `\n${failures} kiểm tra FAIL` : '\nTất cả kiểm tra E2E phòng 10 người đều đạt')
process.exit(failures ? 1 : 0)
