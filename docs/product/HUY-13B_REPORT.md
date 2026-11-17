# HUY-13b – Báo cáo adapter nguồn dữ liệu theo tính năng

## Kết quả

- `src/api/sources.ts` định nghĩa 8 feature và nguồn riêng cho từng feature; hiện tất cả kế thừa `DATA_SOURCE` để giữ nguyên hành vi trước HUY-14.
- `DataAdapter`, `httpAdapter`, `mockAdapter` được chia thành `auth`, `profile`, `rooms`, `chat`, `tournaments`, `registrations`, `activities`, `search`. Mỗi nhóm có `initial(...)`, `readyImmediately`, `supportsRealtime`, `persistsWrites`, `isSampleData`.
- Hooks dùng adapter và cache key theo feature. Auth mock vẫn dùng `customaov.mockLoggedIn` + sự kiện `storage`; auth API vẫn restore `/auth/me` với loading state.
- Production code ngoài `src/api/` không còn import/đọc `DATA_SOURCE` hay `endpoints`. ESLint chặn hai import này; test được miễn để spy/stub transport.
- Không đổi UI, chuỗi hiển thị hay luồng người dùng; không thêm dependency, backend, contracts hay team-core.

## File đã sửa

- API/data layer: `src/api/{sources.ts,sources.test.ts,adapter.ts,adapters.ts,actions.ts,http.ts,mock.ts,hooks.ts,index.ts}`.
- Auth/context/layout: `src/context/AppContext.tsx`, `src/components/LoginModal.tsx`, `src/components/layout/{UserMenu.tsx,SearchDialog.tsx}`.
- Feature UI: `src/components/domain/{EditProfileDialog.tsx,RegisterTeamDialog.tsx,RegistrationsPanel.tsx}`, `src/pages/{CreateRoom.tsx,CreateTournament.tsx,HomeUser.tsx,Profile.tsx,RoomDetail.tsx,TournamentDetail.tsx}`.
- Test setup/stub: `LoginModal.test.tsx`, `EditProfileDialog.test.tsx`, `RegisterTeamDialog.test.tsx`, `RegistrationsPanel.test.tsx`, `TournamentDetail.test.tsx`.
- Guard/tài liệu: `base-frontend-web/eslint.config.js`, `docs/product/FRONTEND_BOUNDARIES.md`, file báo cáo này.

## Các chỗ còn chọn component/hành vi theo capability

- `LoginModal`: `authAdapter.persistsWrites` chọn `ApiLoginModal` hoặc `MockLoginModal`.
- `RoomDetail`: `roomsAdapter.supportsRealtime` chọn `ApiRoomDetail` hoặc `MockRoomDetail` (không gộp hai component).
- `TournamentDetail`: `tournamentsAdapter.persistsWrites`/`isSampleData` chọn quyền ghi và dữ liệu suy ra.
- `CreateRoom`, `CreateTournament`, `HomeUser`, `Profile`, `EditProfileDialog`, `UserMenu`: dùng `persistsWrites` hoặc `isSampleData` để giữ nguyên query, điều hướng, toast và nhãn hiện tại.

## Verify

- Boundary grep: chỉ còn `base-frontend-web/src/vite-env.d.ts:4` ngoài `src/api/` và test.
- `npm run build`: PASS.
- `npm run lint`: PASS, 0 lỗi, 2 cảnh báo có sẵn tại `AppContext.tsx`.
- `npm test`: PASS — web 136/136, API 170/170, contracts 89/89, team-core 15/15.
- Mock, web `5197`:
  - `e2e-auth.mjs`: PASS toàn bộ.
  - `screenshot.mjs huy13b`: 40/40 OK, không có cuộn ngang.
  - Không có `docs/screenshots/huy13/` hoặc `docs/screenshots/baseline/` trên đĩa worktree để chạy pixel diff; kiểm tra bố cục dựa trên 40 ảnh mới và guard scrollWidth của script.
- API, web `5197`, backend `6197`, PGlite `base-backend-api/.data/huy13b-e2e`; backend được restart trước từng script:
  - `e2e-auth-api.mjs`: PASS 5/5.
  - `e2e-rooms-api.mjs`: PASS 7/7.
  - `e2e-tournament-api.mjs`: PASS 14/14.
- Đã dừng đúng PID của Vite và từng backend; cổng `5197`/`6197` không còn listener.

## Sai lệch thiết kế

Không có sai lệch chức năng. Các mutation chỉ dùng trong bản UI API (`roomActions`, `registrationActions`) được bọc bởi facade trong `src/api/actions.ts`; component không biết `endpoints` hay nguồn transport. HUY-14 có thể mở rộng facade này bằng implementation theo nguồn khi bật mutation Supabase cho từng feature.
