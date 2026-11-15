# API & schema – customAOV MVP (E2-T01)

> Lead thiết kế ngày 15/11/2026. Nguồn: PRD.md, `base-frontend-web/src/mocks/types.ts`, `src/lib/room.ts`, `src/lib/tournament.ts`, `packages/team-core`.
> Đây là **hợp đồng**: `packages/contracts` (E2-T03) mã hoá đúng tài liệu này bằng zod. Muốn đổi thì sửa tài liệu này trước (Lead), ghi DECISIONS.md.

## 1. Quy ước chung

- Gốc: `/api`. JSON UTF-8. Thời gian gửi/nhận là chuỗi ISO 8601 có múi giờ. Frontend hiển thị theo `Asia/Ho_Chi_Minh`.
- Lỗi: luôn có dạng `{"error": {"code": "<CODE>", "message": "<tiếng Việt cho người dùng>", "details"?: any}}`.

| HTTP | code | Khi nào |
|---|---|---|
| 400 | `VALIDATION` | Body/query sai schema (`details` = lỗi zod đã làm phẳng) |
| 401 | `UNAUTHENTICATED` | Cần đăng nhập |
| 403 | `FORBIDDEN` | Không đủ quyền (vd. không phải chủ phòng/BTC) |
| 403 | `CSRF` | Thiếu hoặc sai CSRF token |
| 404 | `NOT_FOUND` | Không có tài nguyên |
| 409 | `CONFLICT` | Trùng (username, tên đội) hoặc sai trạng thái (phòng đã đầy, giải đã đóng đăng ký…) |
| 429 | `RATE_LIMITED` | Vượt giới hạn tần suất |
| 500 | `INTERNAL` | Lỗi khác (không lộ stack ở production) |

- Phân trang: query `page` (≥1, mặc định 1), `pageSize` (1–50, mặc định 10). Trả về `{items, total, page, pageSize}`.
- Tìm kiếm `q`: so khớp **không dấu, không phân biệt hoa thường**. Server lưu cột `search_text` đã chuẩn hoá bằng cùng thuật toán với `normalizeVi` của frontend (chuyển hàm này vào `packages/contracts` để dùng chung).

## 2. Auth, phiên, CSRF (Owner chốt)

- Cookie phiên `sid`: giá trị ngẫu nhiên 32 byte (base64url). DB chỉ lưu **SHA-256 của token**. `HttpOnly; SameSite=Lax; Path=/`; thêm `Secure` khi `NODE_ENV=production`. Hạn 30 ngày, trượt: gia hạn khi còn dưới 15 ngày.
- Cookie CSRF `csrf`: ngẫu nhiên 32 byte, **không** HttpOnly (JS đọc được), `SameSite=Lax; Path=/`.
  - **Mọi request ghi** (POST/PUT/PATCH/DELETE) phải gửi header `X-CSRF-Token` bằng đúng cookie `csrf` (so sánh `timingSafeEqual`). Sai hoặc thiếu → 403 `CSRF`.
  - Áp dụng cả cho login/register: client gọi `GET /api/auth/csrf` trước.
- Mật khẩu: `crypto.scrypt` (N=2^15, r=8, p=1, keylen 64, salt 16 byte), lưu `scrypt$N$r$p$salt$hash`. So sánh bằng `timingSafeEqual`.
- Rate limit (`@fastify/rate-limit`):
  - login/register: 5 lần/phút theo IP **và** 10 lần/15 phút theo username;
  - gửi chat: 10 tin/10 giây/người;
  - các request ghi khác: 60/phút/người.
- Logger **redact**: `cookie`, `set-cookie`, `authorization`, `x-csrf-token`, mọi field `password`, `token`, `csrf`. Không log body của các route `/api/auth/*`.
- WebSocket chỉ **đẩy dữ liệu server → client**. Mọi thao tác ghi đi qua REST (nên đã có CSRF). Khi upgrade, kiểm tra `Origin` thuộc danh sách cho phép (`ALLOWED_ORIGINS`, mặc định là origin của dev server) và cookie `sid` hợp lệ (khách xem phòng công khai được phép).

| Method | Path | Body | Trả về |
|---|---|---|---|
| GET | `/api/auth/csrf` | – | `{csrfToken}` + đặt cookie `csrf` |
| POST | `/api/auth/register` | `{username, password, displayName}` | 201 `{user: Me}` + cookie `sid` |
| POST | `/api/auth/login` | `{username, password}` | `{user: Me}` + cookie `sid` (sai thông tin → 401 `UNAUTHENTICATED`, thông báo chung, không nói sai field nào) |
| POST | `/api/auth/logout` | – | 204, xoá phiên + cookie |
| GET | `/api/auth/me` | – | `{user: Me \| null, csrfToken}` (luôn 200; khách thì `user: null`) |

Ràng buộc:
- `username`: 3–20 ký tự `[a-z0-9_]`, viết thường, duy nhất. Đây cũng là `publicId` (hiển thị `@username`).
- `password`: 8–72 ký tự.
- `displayName`: 1–24 ký tự, đã trim.

`Me` = `UserSummary & { uid }`.

## 3. Người dùng / hồ sơ

`UserSummary = {id, username, displayName, avatarUrl: string|null, level: number, crowned: boolean}`. Ánh xạ sang `Player` của frontend: `id`, `name=displayName`, `avatar=avatarUrl ?? ''` (Avatar tự hiện chữ cái đầu).

| Method | Path | Ghi chú |
|---|---|---|
| GET | `/api/users/:username` | `UserProfile`: `{user, uid, bio, bioExtra, roleBadge, playerBadge, stats: {customMatches, wins, losses, winRate, tournamentsJoined, titles}, achievements: Achievement[], history: RoomMatchSummary[]}`. Không có tướng/KDA/vai trò (empty state, PRD 3.2). |
| PATCH | `/api/users/me` | `{displayName?, bio? (≤280), bioExtra? (≤280), avatarUrl? (https URL ≤300, hoặc null)}` |

Thành tích suy từ dữ liệu: vô địch giải, tham gia giải, đạt 10/50 trận custom.

## 4. Phòng custom

`code` dạng `AOV-<4–6 chữ số>`, duy nhất, server sinh. URL frontend vẫn là `/rooms/:code`.

`RoomSummary = {code, title, highlight|null, thumbnail, host: UserSummary, mode: RoomMode, modeLabel, visibility, playerCount, capacity, status: 'waiting'|'live'|'finished', isMember}`.
- `RoomMode` = `'normal'|'tournament'|'friendly'|'other'`.
- `modeLabel` server ghép sẵn, ví dụ `"5v5 · Custom"`.

`RoomDetail = RoomSummary & {config: RoomConfig, teams: {blue: RoomMember[], red: RoomMember[]}, spectators: UserSummary[], myRole: 'host'|'player'|'spectator'|null, lastSplit: {mode, balanceLevel|null, warning, at}|null, result: {winner:'blue'|'red', at}|null}`.
- `RoomMember = {user: UserSummary, lane: Lane|null, ready, captain, tier: 1..5|null}`.
- `RoomConfig` = dữ liệu 4 bước của `/rooms/new`: `{format:'5v5', pickMode:'draft'|'blind'|'random', series:'BO1'|'BO3'|'BO5', tools: ('balance'|'lane'|'champion'|'mystery'|'chat')[], notes}`.
- MVP chỉ chấp nhận `format: '5v5'`. 3v3/1v1 → 400 kèm thông báo "Sắp có".

| Method | Path | Ai | Ghi chú |
|---|---|---|---|
| GET | `/api/rooms` | mọi người | query `q`, `mode`, `status`, `mine=1` (cần đăng nhập), phân trang. Chỉ trả phòng `public`, cộng với phòng mình là thành viên. |
| POST | `/api/rooms` | đăng nhập | `{title, highlight?, mode, visibility, config}`. Người tạo = host, vào Team Xanh, đội trưởng. 201 `RoomDetail`. |
| GET | `/api/rooms/:code` | mọi người | Phòng `private`: người ngoài vẫn xem được thông tin cơ bản (giống hiện nay), nhưng `teams`/chat chỉ hiện khi là thành viên hoặc có `?key=<joinKey>` từ link chia sẻ. |
| POST | `/api/rooms/:code/join` | đăng nhập | `{as:'player'|'spectator', key?}`. Người chơi vào đội ít người hơn (bằng nhau → Xanh). Đủ 10 → 409. Một người chỉ là **người chơi** ở 1 phòng `waiting` tại một thời điểm (409 kèm mã phòng hiện tại). |
| POST | `/api/rooms/:code/leave` | thành viên | Host rời → chuyển host cho thành viên vào sớm nhất; không còn ai → phòng `finished`. |
| PATCH | `/api/rooms/:code/me` | thành viên | `{lane?, ready?, tier?}` |
| POST | `/api/rooms/:code/split` | host | `{mode:'random'\|'tier', balanceLevel?:'50-50'\|'60-40'\|'70-30'}`. Đúng 10 người chơi, nếu không → 409. Gọi `splitTeams5v5` của team-core. `tier` thiếu → coi là 3 (ghi chú trong UI). Trả `RoomDetail` (có `lastSplit.warning`). |
| POST | `/api/rooms/:code/move` | host | `{userId, to:'blue'\|'red', targetUserId?}`. Dùng đúng luật `moveMember` (chuyển hàm thuần này sang contracts hoặc dùng chung). |
| POST | `/api/rooms/:code/kick` | host | `{userId}` |
| POST | `/api/rooms/:code/random-lanes` | host | Gán lane ngẫu nhiên, không trùng trong mỗi đội. |
| POST | `/api/rooms/:code/result` | host | `{winner:'blue'\|'red'}`. Ghi `room_matches`, đổi phòng sang `finished`, sinh activity. |
| GET | `/api/rooms/:code/export` | thành viên | `text/plain`, đúng định dạng `formatTeamsText`. |
| GET | `/api/rooms/:code/messages` | thành viên | 50 tin gần nhất (`?before=<id>` để lấy thêm). |
| POST | `/api/rooms/:code/messages` | host, người chơi | `{text}` 1–500 ký tự. Khán giả → 403 (theo `ROOM_PERMISSIONS`). |

**Realtime** `GET /api/ws` (upgrade):
- Client gửi `{"type":"subscribe","room":"AOV-1024"}` / `{"type":"unsubscribe","room":...}`.
- Server đẩy:
  - `{"type":"room.updated","room": RoomDetail}` sau mọi thay đổi phòng;
  - `{"type":"chat.message","room":code,"message": ChatMessage}`;
  - `{"type":"room.kicked","room":code}` gửi riêng cho người bị mời ra.
- Ping 25 giây. Client tự kết nối lại với backoff.

`ChatMessage = {id, author: UserSummary|null, text, system: boolean, at}`. Tin hệ thống: vào/rời phòng, chia đội, kết quả.

## 5. Giải đấu

`TournamentSummary` = các field của `Tournament` trong mock: `slug, name, titleIcon, cover, status, format, organizer (displayName), description, teamCount, registeredTeams, registrationDeadline, drawDate, dateStart, dateEnd, createdAt`. Server tính sẵn các nhãn `timeLabel`, `dateRange` theo đúng định dạng frontend đang hiển thị.

`TournamentDetail` = summary + `{title, titleAccent, intro[], mode, category, formatLabel, series, heroImage, rules[], prizes[], teamList: Team[], bracket: BracketRound[], upcoming: ScheduledMatch[], results: ScheduledMatch[], champion: Team|null, myRole: 'organizer'|'captain'|'member'|null, myRegistration: Registration|null}`. Các field suy ra (lịch, kết quả, vô địch, xếp hạng) tính ở backend, chuyển logic từ `src/lib/tournament.ts`.

| Method | Path | Ai | Ghi chú |
|---|---|---|---|
| GET | `/api/tournaments` | mọi người | `status`, `q`, phân trang, `sort=createdAt\|deadline` |
| GET | `/api/tournaments/:slug` | mọi người | `TournamentDetail` |
| POST | `/api/tournaments` | đăng nhập | `{name, titleAccent?, description, intro[], teamCount: 4\|8\|16, series:'BO1'\|'BO3'\|'BO5', registrationDeadline, drawDate, dateStart, dateEnd, rules[], prizes[], cover: 'tour-1'\|'tour-2'\|'tour-3'}`. Người tạo = BTC. Slug sinh từ tên (không dấu, chống trùng). Ràng buộc: deadline ≤ drawDate ≤ dateStart ≤ dateEnd. |
| PATCH | `/api/tournaments/:slug` | BTC | Chỉ khi `status=open`. |
| POST | `/api/tournaments/:slug/registrations` | đăng nhập | `{teamName, members: username[5], subs?: username[0..2]}`. Người gửi phải nằm trong `members` (đội trưởng). Mỗi người chỉ ở 1 đội/giải. Quá hạn hoặc đủ chỗ (tính đội `approved`) → 409. Trạng thái ban đầu `pending`. |
| GET | `/api/tournaments/:slug/registrations` | BTC | Tất cả; người khác chỉ thấy đội `approved` qua `teamList`. |
| POST | `/api/tournaments/:slug/registrations/:id/approve` \| `/reject` | BTC | `reject` có `{reason?}` |
| DELETE | `/api/tournaments/:slug/registrations/:id` | đội trưởng | Rút đăng ký khi còn `open` |
| POST | `/api/tournaments/:slug/close-registration` | BTC | |
| POST | `/api/tournaments/:slug/draw` | BTC | Cần ≥ 2 đội `approved`. Bốc ngẫu nhiên vào nhánh loại trực tiếp có kích thước = luỹ thừa của 2 nhỏ nhất ≥ số đội. Bye được đẩy lên vòng sau ngay. `status → live`. Bốc lại chỉ khi chưa có trận nào có tỉ số. |
| POST | `/api/tournaments/:slug/matches/:matchId/score` | BTC | `{scoreA, scoreB}` hợp lệ theo BO (vd. BO3: 2–0, 2–1). Đội thắng vào vòng sau. Thắng chung kết → `status=finished`, `champion`. Sửa tỉ số chỉ khi trận vòng sau chưa có tỉ số. |
| PATCH | `/api/tournaments/:slug/matches/:matchId` | BTC | `{scheduledAt}` |

## 6. Hoạt động, tìm kiếm

| Method | Path | Ghi chú |
|---|---|---|
| GET | `/api/activities` | Đăng nhập. Hoạt động liên quan tới mình (phòng mình ở, giải mình đăng ký/tổ chức). Phân trang. `Activity = {id, kind: 'join'\|'register'\|'invite'\|'result', text, emphasis?, at}` |
| GET | `/api/search?q=` | Tối đa 5 phòng (public), 5 giải, 5 người dùng. `q` ≥ 2 ký tự. |

## 7. Schema DB (PostgreSQL; Drizzle; PGlite cho dev/test)

Quy ước: khoá chính `id uuid` (sinh bằng `crypto.randomUUID()` trong app), `created_at timestamptz default now()`, tên bảng/cột dạng snake_case. Không dùng extension Postgres.

| Bảng | Cột chính | Ràng buộc / index |
|---|---|---|
| `users` | id, uid (text, 6 chữ số, unique), username (unique), display_name, password_hash, avatar_url, bio, bio_extra, role_badge, player_badge, level int default 1, crowned bool, search_text, created_at | unique(username), unique(uid) |
| `sessions` | id, user_id → users, token_hash (unique), expires_at, created_at, last_seen_at | index(user_id) |
| `rooms` | id, code (unique), title, highlight, thumbnail, host_id → users, mode, visibility, capacity int default 10, status, config jsonb, join_key, last_split jsonb, search_text, created_at, finished_at | index(status, visibility) |
| `room_members` | room_id → rooms, user_id → users, role (`player`\|`spectator`), side (`blue`\|`red`\|null), lane, ready, captain, tier smallint, joined_at, position int | PK(room_id, user_id); index(user_id) |
| `room_messages` | id, room_id, author_id (null = hệ thống), text, system bool, created_at | index(room_id, created_at) |
| `room_matches` | id, room_id, winner, blue_user_ids uuid[], red_user_ids uuid[], created_at | index(room_id) |
| `tournaments` | id, slug (unique), name, title_accent, description, intro jsonb, organizer_id → users, status, team_count, series, cover, registration_deadline, draw_date, date_start, date_end, rules jsonb, prizes jsonb, champion_team_id, search_text, created_at | index(status) |
| `tournament_teams` | id, tournament_id, name, logo, captain_id, status (`pending`\|`approved`\|`rejected`\|`withdrawn`), reject_reason, seed int, created_at | unique(tournament_id, lower(name)) |
| `tournament_team_members` | team_id, user_id, tournament_id, is_sub bool | PK(team_id, user_id); unique(tournament_id, user_id) |
| `bracket_matches` | id, tournament_id, round int, position int, label, team_a_id, team_b_id, score_a, score_b, winner_team_id, scheduled_at, next_match_id, next_slot (`a`\|`b`) | unique(tournament_id, round, position) |
| `activities` | id, kind, actor_id, room_id, tournament_id, text, emphasis, created_at | index(created_at) |
| `activity_recipients` | activity_id, user_id | PK; index(user_id) |

Migration đặt ở `database/migrations/` (drizzle-kit generate). Seed (`base-backend-api/src/db/seed.ts`) dựng lại **đúng** dữ liệu mock hiện có: 10 người chơi (mật khẩu demo `customaov123`, chỉ dùng khi dev), 5 phòng, 8 giải với trạng thái và nhánh như `getTournamentDetail`, chat, hoạt động. Mốc "hôm nay" của seed = `MOCK_TODAY` (2026-11-15) để màn hình khớp baseline.

## 8. Frontend ↔ API

- `VITE_DATA_SOURCE=mock|api` (mặc định `mock`). Adapter `api` dùng `fetch` với `credentials: 'include'`, tự gắn `X-CSRF-Token` từ cookie `csrf` cho request ghi.
- Dev: Vite proxy `/api` (kể cả WebSocket) → `http://127.0.0.1:<API_PORT>`. Dùng cùng origin nên không cần CORS.
- Kiểu dữ liệu dùng từ `@customaov/contracts`. Lớp ánh xạ sang kiểu UI hiện có đặt ở `src/api/map.ts`, để các component đổi ít nhất có thể.
