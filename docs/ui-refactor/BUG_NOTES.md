# Ghi chú học tập sửa lỗi UI

## UI-002 – Bố cục thông tin trang hồ sơ thiếu phân cấp

**Nhìn thấy gì:**
- Ở màn hình desktop (`/profile`), tên hiển thị quá to (`40px`) so với phần thông tin bên dưới.
- Dòng `@username`, badge `Lv.42`, và `UID` bị ghép chung vào một hàng có vạch ngăn dọc `|`, khi tên/ID dài sẽ khó đọc và rời rạc.
- Ba badge (`Lv.42`, `Chủ phòng (Host)`, `Người chơi Custom`) nằm tách làm hai hàng khác kiểu nhau (`LevelPill` vuông `rounded-btn` nằm trên, hai `Badge` tròn `rounded-full` nằm dưới).
- Phần giới thiệu (`bio`) dính sát cụm badge phía trên (`gap-3` = `12px`).
- Nút **Chỉnh sửa hồ sơ** và nút `⋯` bị đẩy xuống đáy khối header (ngang hàng với dòng giới thiệu) thay vì nằm cùng cụm đầu với tên người dùng.

**Lỗi nằm ở đâu:**
- `base-frontend-web/src/pages/Profile.tsx:124-248` (`OtherProfile` và `MyProfile` dùng `PageHeader`).
- `base-frontend-web/src/components/layout/PageHeader.tsx:34-44`: class `md:items-end` và `<h1 className="font-display text-2xl font-bold text-fg sm:text-4xl">`.

**Nguyên nhân:**
- `PageHeader` là component dùng chung cho các trang danh sách/tạo mới, nên `h1` tự phóng to lên `text-4xl` (`35.2px–40px`) từ breakpoint `sm:`, và dùng `md:items-end` để đẩy cụm `actions` xuống mép dưới của toàn bộ khối bên trái.
- Khi `Profile` nhét cả `@username`, `UID`, hai hàng badge và `bio` vào prop `meta` của `PageHeader`, toàn bộ khối bên trái cao lên nhiều dòng, kéo theo `actions` tụt xuống dưới cùng và `bio` bị kẹt trong cùng `flex-col gap-3` với metadata.
- Thiếu `min-w-0` và `truncate` (kèm `title` tooltip) cho `@username` và `UID` khiến chuỗi dài không được xử lý gọn.

**Vì sao lại thế / vì sao trước đây không thấy:**
- `PageHeader` vốn thiết kế cho tiêu đề ngắn + 1 dòng mô tả (`description`) + nút hành động nằm ngang đáy tiêu đề. Khi tái sử dụng cho trang hồ sơ có avatar lớn, 3 tầng metadata và bio, giả định đó không còn khớp.
- Dữ liệu mẫu mặc định (`@suthy`, `UID 102394`) rất ngắn nên không lộ lỗi tràn/gãy dòng với ID dài 40+ ký tự.

**Cách tìm ra:**
- Đọc `Profile.tsx` và `PageHeader.tsx`, đối chiếu DOM thực tế ở `375px`, `768px`, `1280px` bằng Playwright.
- Đo `getComputedStyle(h1).fontSize` (`24px` ở 375px, `35.2px` ở 768px, `40px` ở 1280px) và so sánh `h1Top` (`276px`) với `editBtnTop` (`396px` ở 1280px — lệch `120px` xuống dưới).

**Hướng sửa đã chọn và lý do:**
- Tạo helper `ProfileHeader` ngay trong `Profile.tsx` (dùng chung cho `MyProfile` và `OtherProfile`) thay vì sửa `PageHeader.tsx`.
  - `h1` cố định `text-2xl` (`24px`) ở mọi khổ màn hình.
  - Dùng `md:items-start md:justify-between` để `actions` nằm ngang hàng với cụm tên ở trên cùng bên phải; ở `< 768px` (`375px`), `flex-col gap-4` xếp nút xuống dưới gọn gàng.
  - Nhóm `@username` + nút copy và `UID` vào một dòng `text-sm text-fg-muted`, có `min-w-0 max-w-full truncate` + `title` tooltip để ID dài 40+ ký tự không phá layout.
  - Gom `Lv.42`, `roleBadge`, `playerBadge` thành một hàng `<Badge>` `rounded-full` cùng kiểu, `gap-2`.
  - Tách `bio` ra dưới cụm `[Avatar + info + actions]` với `mt-4 md:mt-6` (`16px` mobile, `24px` desktop).
- *Phương án khác đã cân nhắc:* thêm nhiều prop tuỳ biến vào `PageHeader.tsx` (như `titleSize`, `alignActions`, `footer`), nhưng không chọn vì làm `PageHeader` phình phức tạp chỉ cho một trang đặc thù có avatar đè ảnh bìa và bio riêng.

**Đoạn code trước → sau:**
```tsx
// Trước (dùng PageHeader: h1 lên 40px, actions bị md:items-end kéo xuống đáy, LevelPill tách khỏi Badge)
<PageHeader
  flush
  className="px-2 md:px-6"
  leading={<Avatar ... />}
  title={<span>{p.player.name}<Crown ... /></span>}
  meta={
    <div className="flex flex-col gap-3">
      <div><LevelPill ... /> | {p.publicId} | UID {p.uid}</div>
      <div><Badge ...>{p.roleBadge}</Badge><Badge ...>{p.playerBadge}</Badge></div>
      <p>{p.bio} · {p.bioExtra}</p>
    </div>
  }
  actions={...}
/>

// Sau (ProfileHeader: h1 text-2xl, actions ở top-right, 3 badge cùng hệ rounded-full, bio tách mt-4 md:mt-6)
<header className="px-2 pt-3 md:px-6">
  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
    <div className="flex min-w-0 items-start gap-4">
      <div className="shrink-0">{avatar}</div>
      <div className="min-w-0 flex-1">
        <h1 className="flex min-w-0 items-center gap-2 font-display text-2xl font-bold text-fg">
          <span className="truncate" title={name}>{name}</span>
          ...
        </h1>
        {identity}
        {badges && <div className="mt-3 flex flex-wrap items-center gap-2">{badges}</div>}
      </div>
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 md:pt-1">{actions}</div>}
  </div>
  {bio && <div className="mt-4 md:mt-6">{bio}</div>}
  {tabs && <div className="mt-6">{tabs}</div>}
</header>
```

**Cách kiểm lại:**
- Mở `/profile` ở `375px`, `768px`, `1280px` (và `1440px` qua `screenshot.mjs`).
- Thử thay `@username` và `UID` bằng chuỗi > 50 ký tự bằng Playwright: `scrollWidth === innerWidth`, không tràn ngang, cắt gọn có `title` tooltip.
- Thử mở `EditProfileDialog` qua nút "Chỉnh sửa hồ sơ" và kiểm tra `Profile.test.tsx`.

**Bài học rút ra:**
- Không nên ép một component chung (`PageHeader`) gánh bố cục đặc thù bằng cách nhồi quá nhiều tầng vào `meta`; tách header riêng cho hồ sơ giúp thứ bậc thị giác rõ ràng mà không làm ảnh hưởng các trang khác.
- Với flexbox nhiều tầng, luôn đặt `min-w-0` trên các khối cha dọc đường dẫn tới phần tử cần `truncate` (nếu thiếu `min-w-0`, flex item sẽ lấy `min-width: auto` theo nội dung và gây tràn ngang).

---

## UI-003 – Hàng "Cho phép khán giả" co chiều cao khi tắt toggle

**Nhìn thấy gì:**
- Ở `/rooms/new` (Bước 1), khi tắt công tắc **Cho phép khán giả**, khu vực thiết lập phía dưới bị thụt lên trên.
- Dòng mô tả *"Cho phép người khác vào phòng ở chế độ quan sát."* dính sát đường kẻ phân cách (`border-t`) của thanh footer **Hủy / Tiếp tục**, và thanh footer bị nhảy lên theo.

**Lỗi nằm ở đâu:**
- `base-frontend-web/src/pages/CreateRoom.tsx:469-503` (khối `Khán giả` và điều kiện `{spectators && (<label>...</label>)}`).
- `base-frontend-web/src/pages/CreateRoom.tsx:696` (thanh footer có class `mt-6 ... md:mt-auto`).

**Nguyên nhân:**
1. **Thiếu padding đáy + `md:mt-auto` triệt tiêu khoảng cách:** Khối `Khán giả` chỉ có `pt-4` mà không có `pb-*` (`pb-6`). Ở màn hình `>= 768px` (`md:`), thanh footer dùng `md:mt-auto` (ghi đè lên `mt-6`). Trong flex column mà chiều cao form vừa khít nội dung, `margin-top: auto` tính ra bằng `0px`, làm mép dưới của khối `Khán giả` chạm trực tiếp đường kẻ `border-t` của footer (`0px` khoảng hở).
2. **Render có điều kiện gây nhảy chiều cao:** Ô chọn *"Số khán giả tối đa"* được bọc trong `{spectators && (...)}`. Khi tắt toggle, phần tử này biến mất khỏi DOM làm khối `Khán giả` co lại `80px` (`68px` chiều cao `<label>` + `12px` `gap-3`), kéo theo footer ở `1280px` nhảy từ `top: 978px` lên `898px` (`80px`), và ở `375px` làm trang ngắn hơn viewport khiến sticky footer nhảy từ `771px` lên `506px`.

**Vì sao lại thế / vì sao trước đây không thấy:**
- Mặc định `spectators` khởi tạo là `true`, nên khi mở `/rooms/new` lúc đầu luôn thấy ô chọn *"Số khán giả tối đa"* nằm bên dưới dòng mô tả, che mất việc dòng mô tả không có `pb-6`. Chỉ khi người dùng gạt tắt công tắc thì lỗi sát divider và nhảy footer mới lộ ra.

**Cách tìm ra:**
- Tìm chuỗi `"Cho phép khán giả"` trong `CreateRoom.tsx`, kiểm tra cấu trúc CSS của khối cha và footer.
- Đo bằng Playwright ở `375px` và `1280px` trước khi sửa:
  - `1280px`: `sectionHeight` giảm từ `177px` → `97px` (lệch `80px`); `footerTop` nhảy từ `978px` → `898px` (lệch `80px`); `descGapToFooter` khi tắt = `0px`.

**Hướng sửa đã chọn và lý do:**
- Thêm `pt-6 pb-6` cho khối `Khán giả` (`className="mt-6 border-t border-line-strong/70 pt-6 pb-6"`) để khoảng cách với divider trên và footer dưới luôn ổn định `24px`, không bị `md:mt-auto` ép sát `0px`.
- Giữ nguyên ô chọn *"Số khán giả tối đa"* trong DOM và chuyển sang trạng thái `disabled={!spectators}` kèm `opacity-50` và `cursor-not-allowed` thay vì ẩn/hiện bằng `{spectators && ...}`. Nhờ đó, bật/tắt toggle không làm thay đổi chiều cao khối (`heightDiff = 0px`) và footer không nhảy (`footerTopDiff = 0px` ở desktop).
- *Phương án khác đã cân nhắc:* giữ `{spectators && ...}` và chỉ thêm `pb-6`, nhưng nếu giữ render có điều kiện thì khối vẫn co giãn `80px` và footer vẫn nhảy mỗi khi gạt công tắc; chuyển sang `disabled` giữ bố cục hoàn toàn tĩnh và vẫn cho người dùng thấy rõ tuỳ chọn phụ thuộc vào công tắc.

**Đoạn code trước → sau:**
```tsx
// Trước
<div className="mt-6 border-t border-line-strong/70 pt-4">
  ...
  {spectators && (
    <label className="flex flex-col gap-2 md:pl-16">
      ...
      <select value={maxSpectators} onChange={...}>...</select>
    </label>
  )}
</div>

// Sau
<div className="mt-6 border-t border-line-strong/70 pt-6 pb-6">
  ...
  <label className={cn('flex flex-col gap-2 transition-opacity md:pl-16', !spectators && 'opacity-50')}>
    ...
    <select value={maxSpectators} disabled={!spectators} onChange={...}>...</select>
  </label>
</div>
```

**Cách kiểm lại:**
- Mở `/rooms/new` ở `375px` và `1280px`, bật/tắt công tắc **Cho phép khán giả** và đo lại chiều cao khối + vị trí footer bằng Playwright.
- Kiểm tra trạng thái `disabled` khi tắt toggle (select không nhận focus/click, review bước 4 vẫn hiển thị `"Không cho phép"`).

**Bài học rút ra:**
- Không dựa vào `md:mt-auto` của phần tử sau để tạo khoảng cách tối thiểu; khối nội dung phía trên vẫn cần `pb-*` rõ ràng để không bao giờ chạm vào `border-t` khi `mt-auto` rút về `0`.
- Với các tuỳ chọn phụ thuộc toggle, dùng trạng thái `disabled` thay vì xoá khỏi DOM giúp tránh layout shift (nhảy footer/thanh cuộn) khi người dùng thao tác.

---

## Kiểm tra

1. **Build & Lint** (`npm run build`, `npm run lint` ở gốc worktree):
   - `npm run build`: 4/4 workspace (`@customaov/team-core`, `@customaov/contracts`, `@customaov/api`, `base-frontend-web`) build thành công.
   - `npm run lint`: 0 lỗi (chỉ có 2 cảnh báo `react-refresh/only-export-components` có sẵn ở `AppContext.tsx`).
2. **Unit test** (`npm test` ở gốc worktree):
   - `@customaov/team-core`: 15/15 passed
   - `@customaov/contracts`: 89/89 passed
   - `base-frontend-web`: 29 files, 136/136 passed
   - `@customaov/api`: 16 files, 170/170 passed
3. **E2E & Screenshot** (dev server mock cổng `5182`):
   - `node base-frontend-web/scripts/e2e-auth.mjs http://localhost:5182`: tất cả kiểm tra đều đạt.
   - `node base-frontend-web/scripts/screenshot.mjs ui002 http://localhost:5182`: 40/40 ảnh (`scrollWidth === innerWidth`, 0 lỗi console).
4. **Playwright probe:**
   - **UI-003 (`1280px`):** `on` (`sectionHeight=209`, `footerTop=1010`, `descGapToFooter=104`) vs `off` (`sectionHeight=209`, `footerTop=1010`, `descGapToFooter=104`) → `heightDiff = 0`, `footerTopDiff = 0`.
   - **UI-003 (`375px`):** `on` (`sectionHeight=229`) vs `off` (`sectionHeight=229`) → `heightDiff = 0` (lưu ý: `page.click` cuộn tới toggle trên màn `375px` nên toạ độ viewport của thanh `sticky` đổi theo `scrollY`, chiều cao khối vẫn giữ nguyên `229px`).
   - **UI-002 (`/profile`):** `h1FontSize = 24px` ở cả `375/768/1280px`; `editBtnTop = 280px` ngang hàng `h1Top = 276px` ở `768/1280px`; thử chuỗi `@username` và `UID` > 50 ký tự ở `375px` và `1280px` đều `overflow: false` (`scrollWidth === innerWidth`).

## Ghi chú review (Lead, 18/11)
**Nhìn thấy gì:** tên trên header hồ sơ dùng `truncate`, tên dài bị cắt thành `…`.
**Vì sao là lỗi:** `AGENTS.md` mục Thiết kế quy định *tiêu đề và nhãn tab không được bị cắt `…`*; chỉ mô tả dài mới được cắt (kèm tooltip). Tên người dùng là `<h1>` của trang nên phải hiện đủ.
**Sửa:** bỏ `truncate`, dùng `min-w-0 [overflow-wrap:anywhere]`: tên dài tự xuống dòng, kể cả chuỗi liền không có dấu cách (vd. `oqnvuz0704oqnvuz0704…`) vẫn không làm tràn khung. Dòng `@username · UID` vẫn được cắt + `title` vì đó là metadata, không phải tiêu đề.
**Bài học:** trước khi chọn `truncate`, hỏi "đây là tiêu đề hay mô tả?". Tiêu đề → cho xuống dòng; mô tả/ID phụ → được cắt nhưng phải có tooltip.

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
