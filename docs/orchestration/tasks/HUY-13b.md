# HUY-13b – Gom công tắc DATA_SOURCE về tầng adapter, chọn nguồn theo từng tính năng

- Coder: Codex `gpt-5.6-sol` medium · Reviewer: Lead (khác hãng)
- Nhánh `refactor/huy-13b-data-source-adapter` · Worktree `.worktrees/HUY-13b-data-source` · rẽ từ `refactor/huy-13-frontend-isolation` (`e7c7a2f`)
- Cổng: web 5197, API 6197. Không dùng 5173/5174/6174.

## Mục tiêu
Chuẩn bị cho HUY-14 (thêm Supabase). Yêu cầu **không đổi giao diện và không đổi hành vi** ở cả hai chế độ `mock` và `api`.

1. **Chỉ code trong `base-frontend-web/src/api/` được biết đang dùng nguồn nào.** Ngoài thư mục này không file nào import `DATA_SOURCE` hay `endpoints`. Hiện có 44 điểm runtime; danh sách ở `docs/product/FRONTEND_BOUNDARIES.md` mục 5.
2. **Chọn nguồn theo từng tính năng**, không chỉ một công tắc toàn cục, để HUY-14 cho từng tính năng dùng Supabase hay mock riêng.

## Thiết kế (làm theo; lệch thì ghi lý do trong báo cáo)

### Cấu hình nguồn theo tính năng: `src/api/sources.ts`
```ts
export type Source = 'mock' | 'api'          // HUY-14 sẽ thêm 'supabase'
export type Feature = 'auth' | 'profile' | 'rooms' | 'chat' | 'tournaments' | 'registrations' | 'activities' | 'search'
export const FEATURE_SOURCES: Record<Feature, Source>   // hiện tại: mọi feature = DATA_SOURCE
export const sourceOf = (f: Feature): Source => FEATURE_SOURCES[f]
```
Có unit test cho file này.

### Adapter theo tính năng
- Mở rộng `DataAdapter`/`httpAdapter`/`mockAdapter` hiện có thành các nhóm `auth`, `profile`, `rooms`, `chat`, `tournaments`, `registrations`, `activities`, `search`.
- Mỗi nhóm được chọn theo `sourceOf(feature)`.
- Mỗi nhóm có thêm các trường mô tả khả năng, để hook và component **không phải hỏi nguồn**. Ví dụ:
  - `initial(params)`: dữ liệu đồng bộ ban đầu (mock có sẵn, api rỗng);
  - `readyImmediately`;
  - `supportsRealtime`;
  - `persistsWrites` (mock = false → toast "giả lập");
  - `isSampleData`. Mock = true. HUY-14 sẽ dùng cờ này để gắn nhãn "Dữ liệu mẫu" khi chạy lai; **issue này chưa hiện nhãn**.
- Nhãn và toast đang khác nhau giữa mock và api ("Đã lưu (giả lập)", "Đã đăng xuất (giả lập)"…): lấy từ adapter hoặc từ cờ khả năng. Giữ **đúng chữ hiện tại**.

### Hooks và hàm ghi
`api/hooks.ts` và `api/index.ts` dùng adapter của từng tính năng, không so sánh `DATA_SOURCE` trực tiếp. Cache key dùng `sourceOf(feature)`.

### Auth
`AppContext.tsx` và `LoginModal.tsx` gọi qua `auth` adapter. Hành vi phải giữ nguyên:
- mock: `localStorage` `customaov.mockLoggedIn` + sự kiện `storage` đồng bộ nhiều tab;
- api: `/auth/me` và trạng thái loading.

**Không** export thêm gì từ `AppContext.tsx` (sẽ làm tăng cảnh báo lint).

### Trang có hai bản `Api*`/`Mock*` (RoomDetail, LoginModal…)
- **Được giữ** hai component riêng, vì gộp UI là việc của HUY-15.
- Nhưng việc chọn bản nào phải dựa vào khả năng của adapter (ví dụ `roomsAdapter.supportsRealtime`) hoặc qua một hàm của `src/api` (ví dụ `useFeatureSource('rooms')`), **không** đọc `DATA_SOURCE`.
- Liệt kê các chỗ này trong báo cáo.

### Rào chắn tự động
Thêm rule ESLint có sẵn `no-restricted-imports` (không thêm thư viện): cấm import `**/api/source` và `**/api/endpoints` từ ngoài `src/api/`. Test được miễn nếu cần stub.

### Tài liệu
Cập nhật `docs/product/FRONTEND_BOUNDARIES.md`:
- mục 5: trạng thái mới, bảng tính năng → adapter;
- hướng dẫn ngắn "Thêm nguồn `supabase` ở HUY-14": sửa những file nào.

## Không được
- Đổi giao diện, chữ hiển thị hay luồng người dùng.
- Đổi backend, contracts hay team-core.
- Thêm thư viện.
- Bỏ, `skip` hay làm yếu test. Test chỉ được sửa phần setup/stub (ví dụ `vi.stubEnv`, mock module) để khớp cấu trúc mới; giữ nguyên kỳ vọng.
- Gộp `ApiRoomDetail`/`MockRoomDetail`.
- Thêm Supabase.
- Sửa `_old_web_DO_NOT_EDIT/`, `web_backup_*/`.
- Đọc/ghi ngoài `D:\CustomAOV\base-workspace`.
- Push.

## Verify (ghi output vào báo cáo)
1. `grep -rnE "DATA_SOURCE|from '.*api/endpoints'" base-frontend-web/src --include=*.ts --include=*.tsx | grep -v "src/api/" | grep -v test`: chỉ được còn `vite-env.d.ts` (khai báo kiểu).
2. Ở gốc:
   - `npm run build`;
   - `npm run lint`: 0 lỗi, tối đa 2 cảnh báo có sẵn;
   - `npm test`: web ≥ 135 (cộng test mới), api 170, contracts 89, team-core 15.
3. **Chế độ mock.** Chạy `npm run dev -- --port 5197 --strictPort` trong `base-frontend-web`, rồi:
   - `node scripts/e2e-auth.mjs http://localhost:5197`: đạt;
   - `node scripts/screenshot.mjs huy13b http://localhost:5197`: 40/40 ok.
   - So ảnh với bộ `huy13` (`base-frontend-web/docs/screenshots/huy13/`, nếu có trên đĩa) hoặc `docs/screenshots/baseline/`: không khác về bố cục.
4. **Chế độ api** (bắt buộc, vì đây là chế độ dễ vỡ nhất):
   - backend `PORT=6197`, `ALLOWED_ORIGINS=http://localhost:5197`, DB PGlite tạm trong worktree (đã gitignore);
   - web `VITE_DATA_SOURCE=api API_TARGET=http://127.0.0.1:6197`, cổng 5197.
   - Chạy lần lượt `e2e-auth-api.mjs`, `e2e-rooms-api.mjs` (7/7), `e2e-tournament-api.mjs` (14/14). Phải **khởi động lại backend trước mỗi script**, vì rate limit lưu trong bộ nhớ (xem README/MORNING_REPORT).
5. Tắt mọi tiến trình của mình **theo đúng PID**. `git status` sạch sau khi commit.

Commit theo Conventional Commits (`refactor(web): …`), có thể chia nhiều commit theo từng nhóm. Sau đó `orca orchestration send --type worker_done --outcome succeeded|failed`. Báo cáo gồm:
- danh sách file đã sửa;
- các chỗ còn chọn component theo khả năng;
- output verify.
