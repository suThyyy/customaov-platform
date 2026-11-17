# Ranh giới frontend và backend Platform

Tài liệu này bắt đầu từ kiểm kê HUY-13 và được cập nhật sau HUY-13b. Nó mô tả ranh giới adapter chuẩn bị cho HUY-14; **không** phải là quyết định xoá backend hiện tại.

## 1. Kết luận nhanh

- Frontend mặc định chạy với `VITE_DATA_SOURCE` không đặt, tức `mock`; Fastify và PGlite không cần khởi động.
- `@customaov/team-core` và `@customaov/contracts` xuất từ `dist/`, trong khi `dist/` không được commit. HUY-13 chọn các lifecycle script `predev`, `prebuild`, `pretest` để build hai package này trước lệnh frontend. Cách này giữ đúng package boundary và cùng cách resolve ở dev/test/build; alias thẳng sang `src` không cần thiết.
- Ranh giới đích nên là một `DataAdapter` thứ ba tên `supabase`, ngang hàng với `mock` và `api`. Component/hook không nên tự hỏi nguồn dữ liệu là gì.
- REST/CSRF/cookie và WebSocket bên dưới là hợp đồng của Platform hiện tại. HUY-14 chỉ được bỏ chúng sau khi Supabase Auth, RLS/RPC và Realtime có e2e tương đương.

## 2. Kiểm kê REST

`src/api/endpoints.ts` có 36 endpoint REST. `src/api/client.ts` còn gọi trực tiếp `GET /api/auth/csrf` khi mutation chưa có cookie CSRF; vì vậy bảng ghi rõ cả đường gọi này. “Mock” mô tả hành vi UI hiện tại khi `DATA_SOURCE=mock`, không phải một HTTP mock server.

| Method + path | Hàm FE | File/trang sử dụng | Hành vi mock | Ranh giới thay thế đề xuất |
| --- | --- | --- | --- | --- |
| `GET /api/auth/csrf` | `endpoints.csrf`; `client.csrfToken` gọi trực tiếp | `api/client.ts` trước mọi mutation; wrapper `endpoints.csrf` hiện chưa có caller | Không gọi HTTP | **bỏ**; Supabase client không dùng double-submit CSRF cho token của nó |
| `POST /api/auth/register` | `endpoints.register` | `components/LoginModal.tsx` (`ApiLoginModal`) | `MockLoginModal` dùng tài khoản mẫu, ghi session local | **Supabase Auth** `signUp` + trigger tạo profile |
| `POST /api/auth/login` | `endpoints.login` | `components/LoginModal.tsx` | Đăng nhập tài khoản mẫu, không gọi HTTP | **Supabase Auth** `signInWithPassword` |
| `POST /api/auth/logout` | `endpoints.logout` | `components/layout/UserMenu.tsx` | Chỉ xoá session mock | **Supabase Auth** `signOut` |
| `GET /api/auth/me` | `endpoints.me` | `context/AppContext.tsx`; `api/http.ts` khi lấy profile hiện tại | Đọc `customaov.mockLoggedIn` và `currentUser` | **Supabase Auth** `getSession`/`onAuthStateChange`, join bảng profile |
| `GET /api/users/:username` | `endpoints.profile` | `api/http.ts` → `useProfile` → `/profile`, `/profile/:userId` | `readMockProfile` từ `src/mocks` | **bảng + RLS** (`profiles`, thống kê/history qua view) |
| `PATCH /api/users/me` | `endpoints.updateMe` / `updateProfile` | `components/domain/EditProfileDialog.tsx` trên `/profile` | Parse form, hiện “Đã lưu (giả lập)”, không mutate mock | **bảng + RLS** update hàng profile của `auth.uid()` |
| `GET /api/rooms` | `endpoints.rooms` | `api/http.ts` → `useRooms`, `useRoomsPage`; landing, dashboard, `RoomsTable` | Lọc/tìm/phân trang mảng `rooms` trong bộ nhớ | **bảng + RLS**; view/query cho `mine`, status, mode |
| `POST /api/rooms` | `endpoints.createRoom` / `createRoom` | `/rooms/new` | Chỉ toast “Đã tạo phòng (giả lập)”, không tạo bản ghi | **RPC** để tạo room + host/member/config nguyên tử |
| `GET /api/rooms/:code` | `endpoints.room` | `api/http.ts`, `api/room.ts`; `/rooms/:roomId` | `readMockRoom` | **bảng + RLS**; view trả full/restricted theo quyền/key |
| `POST /api/rooms/:code/join` | `endpoints.joinRoom` / `joinRoom` | dashboard/HomeUser và `/rooms/:roomId` | Điều hướng thẳng hoặc state mock cục bộ, không gọi HTTP | **RPC** kiểm key, sức chứa, phòng hiện tại và role nguyên tử |
| `POST /api/rooms/:code/leave` | `endpoints.leaveRoom` | `/rooms/:roomId` | Nhánh phòng mock cập nhật state cục bộ | **RPC** để rời phòng/chuyển host và phát sự kiện nhất quán |
| `PATCH /api/rooms/:code/me` | `endpoints.updateRoomMe` | `/rooms/:roomId` chọn lane/ready | State mock cục bộ | **bảng + RLS** nếu update một membership; RPC nếu cần rule liên bảng |
| `POST /api/rooms/:code/split` | `endpoints.splitRoom` | `/rooms/:roomId` | `team-core` chia đội phía client trên state mock | **RPC** xác thực host và ghi kết quả; vẫn tái sử dụng `team-core` phía client để preview |
| `POST /api/rooms/:code/move` | `endpoints.moveRoomMember` | `/rooms/:roomId` kéo/thả thành viên | `moveMember` trên state mock | **RPC** để kiểm quyền/sức chứa và swap nguyên tử |
| `POST /api/rooms/:code/kick` | `endpoints.kickRoomMember` | `/rooms/:roomId` | `removeMember` trên state mock | **RPC** để kiểm quyền, xoá membership và phát kick |
| `POST /api/rooms/:code/random-lanes` | `endpoints.randomLanes` | `/rooms/:roomId` | Random lane trên state mock | **RPC** vì cập nhật nhiều membership |
| `POST /api/rooms/:code/result` | `endpoints.roomResult` | `/rooms/:roomId` | Ghi kết quả trong state mock | **RPC** để khoá trạng thái và ghi history/stat nguyên tử |
| `GET /api/rooms/:code/export` | `endpoints.exportRoom` | `/rooms/:roomId` | Tạo text từ dữ liệu đang có | **bỏ** endpoint; format ở client từ snapshot đã được RLS cho phép |
| `GET /api/rooms/:code/messages` | `endpoints.messages` | `api/http.ts`, `api/room.ts`; chat `/rooms/:roomId` | `readMockMessages` | **bảng + RLS** select membership-scoped, cursor theo thời gian/id |
| `POST /api/rooms/:code/messages` | `endpoints.createMessage` | chat `/rooms/:roomId` | Thêm tin vào state cục bộ | **bảng + RLS** insert; trigger/Realtime phát hàng mới |
| `GET /api/tournaments` | `endpoints.tournaments` | `api/http.ts` → landing, dashboard, `/tournaments` | Lọc mảng `tournaments` | **bảng + RLS** (public read) |
| `GET /api/tournaments/:slug` | `endpoints.tournament` | `api/http.ts` → `/tournaments/:slug` | `getTournamentDetail` từ mock | **bảng + RLS** + view/query các quan hệ chi tiết |
| `POST /api/tournaments` | `endpoints.createTournament` / `createTournament` | `/tournaments/new` | Sinh slug `*-mock`, toast rồi về danh sách | **RPC** để tạo tournament/rules/prizes nguyên tử |
| `PATCH /api/tournaments/:slug` | `endpoints.updateTournament` | Chưa có caller runtime | Không gọi | **bảng + RLS** cho organizer; RPC nếu update cấu trúc con |
| `POST /api/tournaments/:slug/registrations` | `endpoints.createRegistration` | `RegisterTeamDialog` trong chi tiết giải | UI mock không mở luồng đăng ký thật | **RPC** kiểm deadline, slot và đội trùng |
| `GET /api/tournaments/:slug/registrations` | `endpoints.registrations` | `useRegistrations` → `RegistrationsPanel` | Panel BTC chỉ dùng API | **bảng + RLS** chỉ organizer/captain phù hợp |
| `POST /api/tournaments/:slug/registrations/:id/approve` | `endpoints.approveRegistration` | `RegistrationsPanel` | Không gọi | **RPC** kiểm quyền, trạng thái và sức chứa nguyên tử |
| `POST /api/tournaments/:slug/registrations/:id/reject` | `endpoints.rejectRegistration` | `RegistrationsPanel` | Không gọi | **RPC** kiểm quyền/trạng thái |
| `DELETE /api/tournaments/:slug/registrations/:id` | `endpoints.deleteRegistration` | `/tournaments/:slug` huỷ đăng ký của mình | Không gọi | **bảng + RLS** delete của captain; RPC nếu cần audit |
| `POST /api/tournaments/:slug/close-registration` | `endpoints.closeRegistration` | `OrganizerPanel` | Không gọi | **RPC** chuyển trạng thái có kiểm tra |
| `POST /api/tournaments/:slug/draw` | `endpoints.drawTournament` | `OrganizerPanel` | Không gọi | **RPC** transaction tạo bracket/matches |
| `POST /api/tournaments/:slug/matches/:matchId/score` | `endpoints.scoreMatch` | `ScoreDialog`/`OrganizerPanel` | Không gọi | **RPC** xác thực BO, cập nhật bracket và champion nguyên tử |
| `PATCH /api/tournaments/:slug/matches/:matchId` | `endpoints.scheduleMatch` | `OrganizerPanel` | Không gọi | **bảng + RLS** update lịch; RPC nếu cần rule trạng thái |
| `GET /api/activities` | `endpoints.activities` | `api/http.ts` → dashboard, `/activities` | Cắt trang `src/mocks/activity.ts` | **bảng + RLS** hoặc view activity của `auth.uid()` |
| `GET /api/search?q=` | `endpoints.search` | `api/http.ts` → `SearchDialog` | `readMockSearch`, lọc không dấu trong bộ nhớ | **RPC** cho tìm kiếm hợp nhất rooms/tournaments/users; Edge Function chỉ cần khi tích hợp search ngoài DB |

Các hàm `apiRequest` luôn gửi `credentials: 'include'`, parse response bằng schema Zod, biến error contract thành `ApiError`, và đọc `Retry-After`. Khi chuyển sang Supabase, adapter phải giữ semantics lỗi mà UI đang dựa vào (đặc biệt 400 field errors, 403, 404, 409 và retry), dù transport không còn là REST này.

## 3. Auth và session

### Hiện tại

- Backend đặt cookie HttpOnly `sid` cho session. Browser gửi cookie vì `apiRequest` dùng `credentials: 'include'`; WebSocket cùng origin cũng dùng cookie này.
- Mutation dùng double-submit CSRF. `client.ts` đọc cookie `csrf` (`CSRF_COOKIE`), nếu thiếu thì gọi `GET /api/auth/csrf`, rồi gửi token trong header `X-CSRF-Token` (`CSRF_HEADER`). `sid` không được JavaScript đọc.
- `AppContext.tsx` chia hai nhánh:
  - API: khởi tạo `loading=true`, gọi `endpoints.me`, giữ `Me | null`, và cập nhật state sau login/logout.
  - mock: đọc/ghi `localStorage`, đồng bộ nhiều tab bằng sự kiện `storage`.
- Khoá mock là `customaov.mockLoggedIn`; giá trị `'1'` nghĩa là đã đăng nhập, thiếu khoá nghĩa là khách. Khoá này cũng là hợp đồng của `scripts/e2e-auth.mjs`.

### Đích Supabase

- Dùng Supabase Auth làm nguồn sự thật: `getSession()` khi bootstrap và `onAuthStateChange` cho login/logout/refresh/multi-tab.
- `AppContext` chỉ chuyển session/user của Supabase thành model UI; không tự gọi `/api/auth/me` hay quản lý cookie `sid`/CSRF.
- Dùng `auth.users.id`/`auth.uid()` làm khoá RLS; dữ liệu hiển thị mở rộng nằm ở `profiles`.
- Giữ `customaov.mockLoggedIn` chỉ trong `mockAdapter`/e2e mock. Không dùng khoá mock để giả session Supabase.
- Supabase JS quản lý access/refresh token theo cấu hình client. Không sao chép cơ chế `sid`/`X-CSRF-Token` sang adapter mới; thay vào đó cấu hình redirect, storage và RLS đúng chuẩn, đồng thời tránh log token.

## 4. WebSocket `/api/ws`

### Hợp đồng hiện tại

Theo `src/api/realtime.ts` và `packages/contracts/src/rooms.ts`:

| Chiều | Message | Xử lý |
| --- | --- | --- |
| FE → server | `{type:'subscribe', room, key?}` | Gửi khi socket mở hoặc gọi `resubscribe`; key dùng cho phòng private |
| FE → server | `{type:'unsubscribe', room}` | Gửi khi đổi phòng/unmount trước khi đóng socket |
| server → FE | `{type:'room.updated', room: RoomDetailResponse}` | Parse full/restricted snapshot rồi `onRoomUpdated` |
| server → FE | `{type:'chat.message', room, message: ChatMessage}` | Chỉ nhận đúng room, merge message theo id |
| server → FE | `{type:'room.kicked', room}` | Gọi `onKicked` cho người bị mời ra |
| server → FE | `{type:'error', code, room?}` | Gọi `onError`; gồm lỗi quyền như `FORBIDDEN` |

`useRoomChannel` được dùng bởi nhánh API của `/rooms/:roomId`. Hook tự reconnect theo 1s → 2s → 5s → 10s, resubscribe sau khi mở, và reload REST sau reconnect vì có thể đã bỏ lỡ event.

### Đích Supabase Realtime

- Một channel theo room, ví dụ `room:<room-id>`, lắng nghe Postgres Changes/Broadcast cho room, memberships, messages và result.
- RLS phải bảo vệ dữ liệu nền; private room không được dựa vào việc client “biết channel name”. Join key nên được xác minh qua RPC, sau đó quyền membership/RLS quyết định subscribe/read.
- Map event của Supabase về interface domain ổn định (`roomUpdated`, `chatMessage`, `kicked`, `error`) để component không phụ thuộc payload transport.
- Reconnect của Supabase vẫn cần một lần refetch snapshot; không giả định event stream không mất gói.

## 5. Công tắc `DATA_SOURCE`

### Trạng thái sau HUY-13b

`DATA_SOURCE` và `endpoints` nay là chi tiết nội bộ của `src/api/`. `src/api/sources.ts` khai báo `Feature`, `Source`, `FEATURE_SOURCES` và `sourceOf(feature)`; hiện cả tám feature vẫn kế thừa công tắc toàn cục để giữ nguyên hành vi. Hooks dùng nguồn của đúng feature trong cache key. Component chỉ đọc capability (`readyImmediately`, `supportsRealtime`, `persistsWrites`, `isSampleData`) hoặc gọi facade action, không hỏi transport.

ESLint `no-restricted-imports` chặn import `**/api/source` và `**/api/endpoints` từ production code ngoài `src/api/`; test được miễn để stub transport. Kiểm tra biên production chỉ còn khai báo type `VITE_DATA_SOURCE` trong `vite-env.d.ts`.

| Feature | Adapter được chọn trong `api/adapters.ts` | Phạm vi |
| --- | --- | --- |
| `auth` | `authAdapter` | restore session, login/register/logout, localStorage mock |
| `profile` | `profileAdapter` | profile initial/load/update |
| `rooms` | `roomsAdapter` | danh sách, chi tiết, create/join và capability realtime |
| `chat` | `chatAdapter` | initial/messages và capability realtime |
| `tournaments` | `tournamentsAdapter` | danh sách, chi tiết, tạo giải |
| `registrations` | `registrationsAdapter` | danh sách đơn; mutation qua facade `registrationActions` |
| `activities` | `activitiesAdapter` | feed phân trang |
| `search` | `searchAdapter` | initial/search, debounce dựa trên capability |

Các điểm còn chọn hai UI theo capability (cố ý giữ tới HUY-15): `LoginModal` dùng `authAdapter.persistsWrites`; `RoomDetail` dùng `roomsAdapter.supportsRealtime`. `TournamentDetail`, `CreateRoom`, `CreateTournament`, `HomeUser`, `Profile`, `EditProfileDialog` và `UserMenu` dùng capability để giữ đúng dữ liệu, toast và luồng hiện tại.

### Thêm nguồn `supabase` ở HUY-14

1. Thêm `'supabase'` vào `Source` và type env nếu vẫn cần cấu hình qua Vite; đặt nguồn riêng cho từng feature trong `FEATURE_SOURCES`.
2. Tạo Supabase implementation theo các interface nhóm ở `api/adapter.ts`, gồm đầy đủ capability và `initial(...)`; không import Supabase client ra ngoài `src/api/`.
3. Mở rộng factory `adapterFor` trong `api/adapters.ts` để chọn implementation theo `sourceOf(feature)`; bổ sung facade mutation trong `api/actions.ts` khi cần.
4. Thêm contract/unit test cho từng feature và chạy regression mock/API trước khi bật từng feature sang Supabase. Không thêm nhánh transport trong component.

Phần kiểm kê dưới đây là số liệu lịch sử trước refactor HUY-13b, được giữ để truy vết phạm vi.

### Cách đếm

Audit production `src` (loại `*.test.*` và `api/source.ts`) cho kết quả:

- **60 lần xuất hiện token `DATA_SOURCE` trong 12 file**: gồm import/re-export và runtime use.
- **44 điểm runtime dùng/kiểm**: 43 phép so sánh `===`/`!==` và 1 lần đưa nguồn vào cache key.
- Nếu tính cả test mocks: 71 lần xuất hiện ngoài `source.ts` trong 23 file. Test chỉ ép mode để kiểm hành vi, không phải nhánh runtime nên không đưa vào danh sách refactor.
- Ước lượng ban đầu ở spec ("khoảng 59 chỗ trong 13 file") tính cả `vite-env.d.ts` (khai báo kiểu, 1 lần) và chưa tính dòng import. Số chính xác cho việc refactor ở HUY-14 là **44 điểm runtime** ở trên.

### Mọi điểm runtime ngoài `source.ts`

| File:dòng | Việc đang làm |
| --- | --- |
| `api/hooks.ts:29` | Chọn singleton `httpAdapter` hoặc `mockAdapter` |
| `api/hooks.ts:65` | Chỉ áp trạng thái loading/error giả lập cho mock |
| `api/hooks.ts:90` | Retry lỗi do `useMockStatus` |
| `api/hooks.ts:104` | Đưa nguồn dữ liệu vào cache key |
| `api/hooks.ts:108` (2 chỗ) | Fallback rooms đồng bộ và ready ngay khi mock |
| `api/hooks.ts:116` | Fallback trang rooms từ mock |
| `api/hooks.ts:118` | Đánh dấu trang rooms ready ngay khi mock |
| `api/hooks.ts:125` | Fallback room từ mock |
| `api/hooks.ts:127` | Đánh dấu room ready ngay khi mock |
| `api/hooks.ts:133` | Fallback messages từ mock |
| `api/hooks.ts:135` | Đánh dấu messages ready ngay khi mock |
| `api/hooks.ts:140` (2 chỗ) | Fallback tournaments và ready ngay khi mock |
| `api/hooks.ts:146` | Fallback tournament detail từ mock |
| `api/hooks.ts:148` | Đánh dấu tournament detail ready ngay khi mock |
| `api/hooks.ts:156` (2 chỗ) | Fallback profile và ready ngay khi mock |
| `api/hooks.ts:169` | Fallback activity page từ mock |
| `api/hooks.ts:171` | Đánh dấu activity ready ngay khi mock |
| `api/hooks.ts:205` | Chọn debounce/min-length/loader cho global search |
| `api/index.ts:28` | Create tournament qua REST hay mock slug |
| `api/index.ts:34` | Chỉ PATCH profile ở mode API |
| `api/index.ts:43` | Join room mock trả thẳng code; API gọi backend |
| `context/AppContext.tsx:60` | Khởi tạo login từ localStorage chỉ ở mock |
| `context/AppContext.tsx:62` | Khởi tạo loading khi API cần restore session |
| `context/AppContext.tsx:68` | Chọn restore `/auth/me` hay listener localStorage |
| `context/AppContext.tsx:99` | `login()` cập nhật API user hay ghi mock session |
| `context/AppContext.tsx:109` | `logout()` xoá API user hay mock session |
| `components/LoginModal.tsx:65` | Render modal auth API hoặc modal tài khoản mẫu |
| `components/domain/EditProfileDialog.tsx:73` | Chọn nội dung toast “giả lập”/“đã cập nhật” |
| `components/domain/EditProfileDialog.tsx:74` | Chỉ refetch profile sau save API |
| `components/layout/UserMenu.tsx:69` | Chỉ gọi endpoint logout ở mode API |
| `components/layout/UserMenu.tsx:81` | Chọn toast logout mock/API |
| `components/layout/UserMenu.tsx:92` | Chọn label logout mock/API |
| `pages/CreateRoom.tsx:241` | Mode mock dừng sau toast, không tạo room thật |
| `pages/CreateTournament.tsx:284` | Điều hướng detail sau create API, list sau mock |
| `pages/CreateTournament.tsx:303` | Toast fallback riêng cho lỗi mock |
| `pages/HomeUser.tsx:67` | Đổi query dashboard (`mine`, tournament open, activities) theo API |
| `pages/Profile.tsx:88` | Dùng UI hồ sơ người khác từ mock khi cần |
| `pages/RoomDetail.tsx:132` | Tách toàn bộ `ApiRoomDetail` và `MockRoomDetail` |
| `pages/TournamentDetail.tsx:132` | Bật các quyền/luồng detail chỉ có API |
| `pages/TournamentDetail.tsx:875` | Chọn schedule backend hay suy từ mock |
| `pages/TournamentDetail.tsx:903` | Chọn results backend hay suy từ bracket mock |
| `pages/TournamentDetail.tsx:908` | Chỉ tính podium từ mock |
| `pages/TournamentDetail.tsx:909` | Chọn champion backend hay podium mock |
| `pages/TournamentDetail.tsx:911` | Chọn runner-up backend hay podium mock |

### Ranh giới adapter đề xuất (không làm trong HUY-13)

1. Mở rộng `DataAdapter` thành interface domain đầy đủ: `auth`, `profiles`, `rooms`, `roomMutations`, `messages`, `tournaments`, `registrations`, `activities`, `search`, `realtime`.
2. Tạo factory duy nhất trong `src/api/adapter.ts`: `mock`, `api`, `supabase`. Chỉ factory đọc cấu hình nguồn.
3. Adapter trả domain result/error thống nhất; cache/loading/fallback thuộc hooks, không đọc global `DATA_SOURCE`.
4. Chuyển nhánh lớn RoomDetail/TournamentDetail thành capability/data của adapter thay vì component song song theo transport.
5. Sau khi parity test xanh, xoá lần lượt các nhánh trên. Không đổi UI trong cùng commit với thay transport.

## 6. Shared packages

### Bảng nguồn khi `VITE_DATA_SOURCE=supabase` (HUY-14)

| Feature | Nguồn | Ghi chú |
| --- | --- | --- |
| Auth | Supabase | password, signup + OTP, restore/listener; anonymous = khách. |
| Profile | Supabase | `profiles`, `game_profiles`, UID RPC. |
| Room detail UUID | Supabase | snapshot RPC/fallback bốn bảng + Realtime. |
| Room list | Mock (sample) | RLS không có danh sách public tương đương; có nhãn “Dữ liệu mẫu”. |
| Chat, tournaments, registrations, activities, search | Mock (sample) | Chưa có contract Supabase trong HUY-14; có nhãn “Dữ liệu mẫu”. |

Component chọn hành vi theo capability của adapter (`authFlow`, `roomView`, `showsSampleBadge`), không đọc trực tiếp `DATA_SOURCE`.

### `@customaov/team-core`

Giữ package. Thuật toán chia đội chạy phía client, framework-independent, có test riêng và không phải phụ thuộc Platform. Supabase migration không thay đổi lý do tồn tại của package này.

### `@customaov/contracts`

Frontend đang dùng trực tiếp các nhóm sau:

- Auth/error: `LoginBodySchema`, `RegisterBodySchema`, `AuthResponseSchema`, `Me`/`MeResponseSchema`, `LogoutResponseSchema`, `CsrfResponseSchema`, `CSRF_COOKIE`, `CSRF_HEADER`, `ErrorBodySchema`, `ErrorCode`.
- Rooms/chat/realtime: `RoomMode`, `RoomSummary`/schema, `RoomDetail`/schema, room query/body schemas và types, `RoomMutationResponseSchema`, `ChatMessage`/schema, messages schemas, export schema; contract còn định nghĩa `WsClientMessage` và `WsServerMessage`.
- Tournaments: summary/detail/registration schemas và types, query/write/score/schedule schemas, `Series`, `TeamCount`, cùng `isValidSeriesScore`.
- Profiles/activity/search: `UserSummary`, `UserProfileSchema`, update-me schema/type/response, `Activity`, activity query/response và `SearchResponseSchema`.

Hai phương án để Owner quyết ở HUY-14:

| Phương án | Ưu điểm | Nhược điểm |
| --- | --- | --- |
| Giữ Zod contracts làm domain model | Validate runtime ở biên adapter; model UI ổn định trước thay đổi transport; test/mock dùng cùng invariant; dễ map REST và Supabase song song trong giai đoạn chuyển | Trùng một phần với schema DB/types sinh; phải bảo trì mapper và có nguy cơ drift nếu thiếu contract test |
| Thay bằng Supabase generated types | Một nguồn sự thật sát schema DB; giảm type DTO viết tay; quan hệ/nullability đổi sẽ lộ khi build | Generated types không validate runtime; kéo chi tiết table/RPC vào UI; khó biểu diễn view/domain tổng hợp; migration schema gây blast radius lớn và mock kém độc lập |

Khuyến nghị kỹ thuật: giữ một lớp domain/Zod mỏng cho dữ liệu đi vào UI, dùng generated types bên trong `supabaseAdapter`, rồi map giữa hai lớp. Owner vẫn cần quyết định phạm vi giữ `contracts` sau HUY-14.

## 7. Dev proxy và biến môi trường

`base-frontend-web/vite.config.ts` proxy cả HTTP và WebSocket từ `/api` sang `process.env.API_TARGET ?? 'http://127.0.0.1:6174'`, với `changeOrigin: true` và `ws: true`. Proxy chỉ phục vụ mode Platform API; frontend mock không cần target sống. Adapter Supabase sẽ dùng URL/key public của Supabase và không đi qua proxy `/api`; giữ proxy trong giai đoạn chuyển để chạy regression Platform.

`VITE_DATA_SOURCE` hiện chỉ chấp nhận ý nghĩa runtime `api` hoặc fallback `mock`. Khi thêm `supabase`, cập nhật type ở `vite-env.d.ts` và factory adapter; không rải thêm phép so sánh trong component.

## 8. Kế hoạch lưu trữ backend Platform (chỉ kế hoạch)

### Trước khi xoá

1. Tạo tag hoặc nhánh bất biến `archive/platform-backend` tại commit Platform cuối đã verify.
2. Ghi commit/tag đó vào tài liệu migration và kiểm tra có thể checkout/build độc lập.
3. Chỉ merge commit xoá sau gate Owner và review khác hãng.

### Phạm vi sẽ phải gỡ sau này

- Thư mục: `base-backend-api/`, `database/`; chỉ xoá `packages/contracts/` nếu Owner chọn generated types hoàn toàn. **Không** xoá `packages/team-core/`.
- Root scripts/config: `dev:all`, `dev:api`, phần build/lint/test của `@customaov/api`, `scripts/dev-all.mjs`, workspace backend nếu không còn dùng, biến `DATABASE_URL`, `TEST_DATABASE_URL`, `CSRF_SECRET`, `ALLOWED_ORIGINS` trong docs/config.
- Backend e2e: `base-frontend-web/scripts/e2e-auth-api.mjs`, `e2e-tournament-api.mjs`, `e2e-rooms-api.mjs` và các script package tương ứng.
- Dev proxy `/api`/`API_TARGET` khi không còn regression Platform.
- CI: bỏ build/typecheck/test backend và contracts chỉ sau khi workflow Supabase tương đương đã thay thế; CI HUY-13 giữ nguyên và không chạy e2e.
- Tài liệu: README/CONTRIBUTING/AGENTS/API references về Fastify, PGlite, cookie/CSRF, port 6174 và lệnh backend.

### Điều kiện được xoá

- HUY-14 đã thay toàn bộ endpoint/auth/realtime đang dùng và không còn runtime import/call Platform.
- RLS/RPC/Auth/Realtime có unit/integration test và e2e trên Supabase cho các luồng khách, member, host, organizer và lỗi quyền.
- Mock e2e vẫn xanh; Supabase e2e bao phủ ít nhất auth, room lifecycle/chat/realtime, tournament registration/organizer.
- Có phương án seed/test environment có thể lặp lại; CI mới xanh; archive tag/branch đã kiểm tra phục hồi được.
- Owner duyệt gate xoá dữ liệu/code.

## 9. Tách mock và kiểm thử backend

- `npm run dev:web` vẫn mặc định mock vì `source.ts` chỉ chọn API khi `VITE_DATA_SOURCE === 'api'`.
- `test:e2e:mock` là alias của `test:e2e`; tên cũ được giữ để README, CONTRIBUTING và AGENTS không gãy.
- `test:e2e:api`, `test:e2e:tournament`, `test:e2e:rooms` giữ nguyên và vẫn là kiểm thử backend, cần `dev:all`/API thật.
- `.github/workflows/ci.yml` giữ nguyên: install, build, lint/typecheck, unit/integration; không chạy e2e.

## 10. Báo cáo verify HUY-13

Phần này được điền từ clone sạch và worktree, không suy diễn từ build cũ.

### Baseline trước sửa

- Clone sạch + `npm ci`: thành công, 407 package được cài.
- `npm run dev:web` trên 5195: Vite mở cổng nhưng dependency scan lỗi vì không resolve được `@customaov/contracts` và `@customaov/team-core` (không có `dist`).
- `npm run build --workspace base-frontend-web`: exit 1, lỗi đầu tiên `TS2307 Cannot find module '@customaov/contracts'`.
- `npm test --workspace base-frontend-web`: exit 1, 24 suite fail vì không resolve được hai shared package.

### Kết quả sau sửa

Chạy 17/11/2026 ở commit `9fcb2d6`. Verify trên một clone sạch mới (`git clone` → `npm ci`, chưa có `dist/` của shared package):

- `npm run build --workspace base-frontend-web`: exit 0 (`prebuild` tự build `team-core` và `contracts`).
- `npm test --workspace base-frontend-web`: exit 0, 28 file, 135 test.
- Xoá `dist/` của 2 package rồi chạy `npm run dev -- --port 5196 --strictPort` trong `base-frontend-web`: `predev` build shared package, Vite phục vụ `/`, `/src/main.tsx`, `/src/api/types.ts` đều HTTP 200. Không khởi động Fastify hay PGlite.
- `node scripts/e2e-auth.mjs http://localhost:5196`: "Tất cả kiểm tra đều đạt".
- `node scripts/screenshot.mjs huy13 http://localhost:5196`: 40/40 `ok`, 0 `FAIL`.

Ở gốc worktree:

- `npm run build`: exit 0.
- `npm run lint`: 0 lỗi, 2 cảnh báo có sẵn (`AppContext.tsx`).
- `npm test`: team-core 15, contracts 89, web 135, api 170, đều đạt.

Lưu ý khi truyền cổng: `npm run dev:web -- --port N` ở gốc **không** chuyển được `--port` qua hai tầng npm (Vite nhận `N` thành tham số vị trí và mở cổng mặc định). Muốn đổi cổng thì chạy `npm run dev -- --port N` bên trong `base-frontend-web`.
