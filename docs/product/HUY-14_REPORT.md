# Báo cáo HUY-14 – Supabase adapters

Ngày kiểm tra: 17/11/2026. Toàn bộ unit test dùng fake Supabase client. Không có request nào tới Supabase và không dùng URL/key/tài khoản thật.

## Phạm vi đã làm

- Cấu hình `supabase` và client lazy; `.env.example` giữ giá trị URL/key trống.
- Feature routing: Auth/Profile/Open Room detail dùng Supabase; room list, Chat, Tournament, Registration, Activity và Search dùng mock có nhãn **Dữ liệu mẫu**.
- Auth password, signup → OTP, restore/listener, anonymous = khách, thông báo lỗi tiếng Việt và cleanup khi logout/đổi user.
- Profile đọc/map `profiles` + `game_profiles`, update đúng ba cột profile, đổi Game UID qua RPC.
- Open Room snapshot RPC/fallback bốn bảng, FIFO/slot mapping, `SupabaseRoomView`, Realtime refetch + debounce + reconnect/backoff + cleanup.
- Hợp đồng migration/RLS/RPC/Realtime và hướng dẫn chạy được ghi tại `SUPABASE_CONTRACTS.md`, `FRONTEND_BOUNDARIES.md`, README.

## Quyết định ánh xạ

- `Me.displayName` lấy `profiles.display_name`, fallback phần trước `@` của email; `username` được chuẩn hóa từ cùng tên vì schema Supabase không có cột username.
- `UserProfile` chỉ map dữ liệu thật. KDA, win rate, trận, MVP, thành tích, tướng và lịch sử không có trong schema nên dùng empty state (`hasGameData=false`, danh sách rỗng), không sinh dữ liệu giả.
- `OpenRoomSnapshot.waiting` là entry `waiting` tăng dần `queue_seq`; `selected` lấy `room_current_players` tăng dần `slot`; `version` lấy từ `rooms.version`.
- RLS không cho danh sách room public, nên landing/dashboard giữ mock sample. Detail UUID dùng model Open Room riêng, không gộp với model Platform trong `packages/contracts`.
- Hồ sơ người khác chỉ hiển thị header + empty state theo giới hạn RLS; `game_profiles` public không được biến thành thống kê không tồn tại.

## Những dữ liệu Supabase chưa có

- Profile: level, KDA, win rate, MVP, match history, achievements, champion/item stats, cover và bio phụ.
- Open Room: title/thumbnail/mode/capacity theo model Platform, chat và các thao tác ghi HUY-15.
- Tournament, registration, activity, search và danh sách room public.

## File chính

- Cấu hình: `.gitignore`, `base-frontend-web/.env.example`, `package.json`, `package-lock.json`, `src/vite-env.d.ts`.
- Adapter: `src/api/source.ts`, `sources.ts`, `adapter.ts`, `adapters.ts`, `src/api/supabase/*`.
- UI: `LoginModal.tsx`, `SupabaseRoomView.tsx`, `SampleDataBadge.tsx`, `RoomDetail.tsx` và các khối sample.
- Unit test: `auth.unit.test.ts`, `profile.unit.test.ts`, `room.unit.test.ts`, `realtime.unit.test.ts`, `SupabaseRoomView.unit.test.tsx`.
- Tài liệu: `SUPABASE_CONTRACTS.md`, `FRONTEND_BOUNDARIES.md`, README, `DECISIONS.md`.

## Kết quả verify

| Lệnh | Kết quả |
| --- | --- |
| `npm run build` (gốc) | PASS, exit 0. |
| `npm run lint` (gốc) | PASS, 0 lỗi; đúng 2 cảnh báo có sẵn tại `AppContext.tsx`. |
| `npm test` (gốc) | PASS: web 152, api 170, contracts 89, team-core 15. |
| Build web với `VITE_DATA_SOURCE=supabase`, URL loopback không phục vụ và anon key `dummy` | PASS, exit 0; không chạy app/không phát request. |
| `node scripts/e2e-auth.mjs http://localhost:5198` | PASS, tất cả kiểm tra đạt. |
| `node scripts/screenshot.mjs huy14 http://localhost:5198` | PASS 40/40; 10 route × 4 width, không scroll ngang/console error. |
| Unit test Supabase | PASS: Auth 5, Profile 3, Room 3, Realtime 3, View 1. |

Lead vẫn cần tự kiểm chứng read-only trên Supabase Production theo hàng rào của issue; báo cáo này không tuyên bố integration test Supabase.
