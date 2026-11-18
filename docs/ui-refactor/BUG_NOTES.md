# Ghi chú triển khai & lỗi đã xử lý

## HUY-15b – Ghi chú triển khai

Phần này ghi lại cách tổ chức giao diện thao tác Open Room ở chế độ `VITE_DATA_SOURCE=supabase` (mock/api giữ nguyên hoàn toàn).

### 1. Cấu trúc component đã tách

- `base-frontend-web/src/pages/CreateRoom.tsx`:
  - Kiểm tra `roomsAdapter.roomView === 'open-room'`. Nếu đúng thì render `CreateOpenRoom` (một thẻ đơn giản với nút vàng duy nhất gọi `createOpenRoom()` rồi điều hướng tới `/rooms/<id>`).
  - Chế độ `mock`/`api` giữ nguyên `CreateRoomWizard` 4 bước.
- `base-frontend-web/src/pages/JoinRoom.tsx` + route `/join/:inviteCode` (trong `RequireAuth` tại `src/App.tsx`):
  - Form nhập **Tên hiển thị** (mặc định lấy `user.displayName` từ hồ sơ, tối đa 40 ký tự).
  - Gọi `joinOpenRoom(inviteCode, displayName)`; thành công thì điều hướng tới `/rooms/${result.data.room_id}`, lỗi thì hiện `error.message` và toast.
- `base-frontend-web/src/components/domain/SupabaseRoomView.tsx`:
  - `SupabaseRoomView` nối `useOpenRoom(roomId)`, `useOpenRoomActions(roomId, room.snapshot)`, `useAuth()`, `useToast()` rồi truyền xuống `SupabaseRoomSnapshot`.
  - `SupabaseRoomSnapshot` giữ nguyên header trạng thái (`Đang mở` / `Đã đóng`, `Đang cập nhật trực tiếp` / `Mất kết nối, đang thử lại`) và điều phối các khối con trong `src/components/domain/open-room/`:
    - `OpenRoomControls.tsx`: hiển thị pha hiện tại + số vòng, nút hành động chính theo pha (`Chuẩn bị vòng` / `Vòng tiếp theo` / `Bắt đầu` / `Kết thúc`), ghi chú `Lưu kết quả trận: sắp có`, link mời + nút `Sao chép link mời` (chỉ chủ phòng), nút `Vào hàng chờ` (`continueQueue`), `Rời phòng` (`leave`), `Đóng phòng` (`close`).
    - `OpenRoomLineup.tsx`: hiển thị đội hình 5v5 Team A / Team B khi pha là `preparing`, cho phép chủ phòng chọn 1 người mỗi đội để `Đổi chỗ` (`swapLineupPlayers` → `saveLineup`) hoặc `Chia ngẫu nhiên` (`skill_mode: 'random'` → `saveLineup`).
    - `OpenRoomQueue.tsx`: hàng chờ FIFO (`Đang chờ`), ô `Thêm người chơi` của chủ phòng (`addPlayer`), danh sách `Ngoài hàng chờ` (nếu có thành viên active chưa nằm trong hàng chờ/đội hình để chủ phòng có thể `requeue`/`kick`), và bảng `Được chọn`.
    - `ParticipantMenu.tsx`: menu `⋯` trên từng người chơi (`Thay người` khi `preparing`, `Đưa về cuối hàng chờ` chỉ cho guest do host thêm đang ở ngoài queue, `Mời ra khỏi phòng` trừ chính host).
    - `ConfirmActionModal.tsx`: hộp thoại xác nhận chung cho `kick`, `requeue`, `leave`, `close`.
    - `helpers.ts`: hàm thuần `buildLineupFromSelected`, `buildRandomLineup` và hằng `OPEN_ROOM_PHASE_LABEL` (tách riêng để tránh cảnh báo `react-refresh/only-export-components`).

### 2. Cách nút đọc quyền từ `openRoomPermissions`

- `SupabaseRoomSnapshot` tính `permissions = openRoomPermissions(snapshot, userId)` (dựa trên vai trò `host` / `member` / `spectator`, trạng thái phòng `open` / `closed` và pha vòng `idle` / `preparing` / `active` / `ended`).
- Mọi nút và menuitem đều ẩn hoặc disable theo cờ tương ứng trong `permissions`:
  - Chủ phòng (`host`): thấy link mời, `Thêm người chơi`, menu `⋯` (`kick`, `requeue`, `replace` khi `preparing`), `Đổi chỗ` / `Chia ngẫu nhiên` (`saveLineup` khi `preparing`), nút pha (`prepare` / `start` / `end`), và `Đóng phòng` (`close`).
  - Thành viên (`member`): thấy `Vào hàng chờ` (`continueQueue`, disable nếu đang trong hàng chờ/đội hình) và `Rời phòng` (`leave`).
  - Khán giả (`spectator`): chỉ xem, không thấy các nút thao tác của chủ phòng hay thành viên.
- Khi `actions.pending[action]` là `true`, nút bị disable và đổi nhãn sang trạng thái đang xử lý (ví dụ `Đang bắt đầu…`, `Đang lưu…`).
- Các hàm `canKickMember`, `canRequeueMember`, `canReplaceMember` trong `openRoomPermissions` tập trung quyền theo đúng `memberId`; component không tự suy lại điều kiện mục tiêu. `useOpenRoomActions` gộp các lần gọi trùng cùng action khi request đầu còn chạy.
- Quy tắc nút vàng: mỗi khung nhìn chỉ có tối đa 1 nút `variant="primary"` là nút hành động chính của pha (`Chuẩn bị vòng` / `Vòng tiếp theo` / `Bắt đầu` / `Kết thúc`); mọi nút khác dùng `outline` hoặc `ghost`.

### 3. Vì sao không tự sửa state cục bộ mà chờ refetch/realtime

- `OpenRoomSnapshot` là dữ liệu dùng chung nhiều người chơi, có `version` khóa lạc quan (optimistic lock) ở backend Supabase.
- Nếu UI tự sửa `snapshot` cục bộ sau khi bấm nút, hai người cùng thao tác hoặc một thao tác bị từ chối sẽ làm lệch state giữa các máy và lệch `version` khi gọi `saveLineup`/`replace`.
- Thay vào đó, `useOpenRoomActions` tự gọi `requestOpenRoomRefetch(roomId)` sau khi mutation thành công hoặc gặp `version_conflict`, kết hợp với kênh Realtime của `useOpenRoom` để đồng bộ lại snapshot chuẩn từ server. Khi gặp lỗi, UI hiện toast bằng `error.message` (với `version_conflict` là `"Phòng vừa thay đổi, đã tải lại."`).

### 4. Cách kiểm

- Unit test (`Vitest` + `Testing Library`, không gọi Supabase thật):
  - `src/components/domain/SupabaseRoomView.unit.test.tsx`: kiểm tra render FIFO/slot/realtime, phân quyền nút theo vai trò × pha, xác nhận kick/requeue đúng `memberId`, swap/random gửi đủ lineup 5v5, và lỗi hiện toast.
  - `src/pages/OpenRoomRoutes.unit.test.tsx`: kiểm tra `/join/:inviteCode` gọi `joinOpenRoom` + điều hướng + hiện lỗi, `/rooms/new` ở chế độ `open-room` gọi `createOpenRoom` + điều hướng, và chế độ mock/api vẫn render wizard.
- Kiểm tra hồi quy chế độ mock: `npm run build`, `npm run lint`, `npm test`, `e2e-auth.mjs` và `screenshot.mjs`.

### 5. Kết quả Verify (18/11/2026)

- `npm run build`: đạt (build sạch `@customaov/team-core`, `@customaov/contracts`, `@customaov/api`, `base-frontend-web`).
- `npm run lint`: đạt (0 lỗi; giữ đúng 2 cảnh báo `react-refresh/only-export-components` có sẵn ở `src/context/AppContext.tsx`).
- Test từng workspace:
  - `@customaov/team-core`: 15/15 passed.
  - `@customaov/contracts`: 89/89 passed.
  - `base-frontend-web`: 37 file, 199/199 passed (tăng từ 192 lên 199, không sửa kỳ vọng test cũ trừ bỏ dòng placeholder `'Thao tác phòng sẽ có ở bản sau.'` của HUY-14 trong `SupabaseRoomView.unit.test.tsx`).
  - `@customaov/api`: runner gộp treo sau khi chạy xong suite trên Windows nên đã chạy lần lượt từng file (`16` file test), tổng `170/170` passed (`4 + 25 + 3 + 3 + 11 + 7 + 6 + 17 + 9 + 13 + 14 + 13 + 18 + 8 + 4 + 15 = 170`).
- Dev server cổng `5199` (chế độ `mock`):
  - `node scripts/e2e-auth.mjs http://localhost:5199`: đạt tất cả kiểm tra (`Tất cả kiểm tra đều đạt`).
  - `node scripts/screenshot.mjs huy15b http://localhost:5199`: `40/40` đạt (10 route × 4 khổ `375/768/1280/1440`, `scrollWidth` khớp khung nhìn, 0 lỗi console).
