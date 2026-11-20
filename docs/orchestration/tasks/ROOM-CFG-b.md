# ROOM-CFG-b – Giao diện tạo phòng 4 bước + panel cấu hình trong phòng (phần 2/2)

- Coder: agy `gemini-4-hydrogen-medium` · Reviewer: Lead
- Nhánh `feat/room-create-config` (sau commit của ROOM-CFG-a) · Worktree `.worktrees/room-config`
- Cổng dev: 5199 (`npm run dev -- --port 5199 --strictPort` trong `base-frontend-web`).
- **Thiết kế của Owner (bắt buộc làm theo):** `docs/ui-refactor/mockups/create-room/`
  - `1-phong.png`, `2-che-do.png`, `3-cong-cu.png`, `4-xem-lai.png`: wizard;
  - `5-phong-sau-khi-tao.png`: panel trong phòng.

  Mở từng ảnh xem kỹ. Ảnh là bố cục và nội dung chữ; màu, font, spacing theo token trong `AGENTS.md`. Dòng "Minh họa cấu trúc từng bước…" và "Chưa kết nối Backend" trong ảnh là chú thích của mockup, **không** đưa vào UI.

## Bước 0
```bash
graphify update . --no-cluster && graphify cluster-only . --no-label --no-viz
graphify query "CreateRoom wizard stepper roomConfig SupabaseRoomView RoomDetail" --budget 2000
```
Không chạy `extract`/`label`.

## Hàng rào
- Không gọi Supabase thật, không đọc `.env.local`. Không push.
- Không sửa `src/api/**` (của ROOM-CFG-a). Nếu thiếu API, ghi vào báo cáo.
- Đọc `AGENTS.md` (Thiết kế, bẫy đã gặp, mục `/rooms/new`: khung ngoài không `overflow-hidden`, stepper giữ `whitespace-nowrap`).
- Giữ nháy đơn, không chấm phẩy. Xoá hẳn code cũ không dùng, không comment lại.
- Không làm yếu test. Test cũ đổi nhãn thì chỉ sửa selector, nêu lý do.

## Việc
1. **`/rooms/new` – một wizard 4 bước dùng chung cho mọi nguồn** (mock/api/supabase). Bỏ thẻ "Tạo phòng mở" riêng của supabase và wizard cũ.
   - Tiêu đề "Tạo phòng Custom", badge "Đề xuất".
   - Stepper dạng segmented 4 ô: "1. Phòng · 2. Chế độ · 3. Công cụ · 4. Xem lại". Chỉ bấm được các bước đã mở.
   - **Bước 1 — Thông tin phòng:**
     - ô "Tên phòng";
     - "Thể thức" radio BO3 / BO5 / BO7;
     - "Quyền truy cập" radio "Công khai" / "Riêng tư · Invite link";
     - ghi chú nhỏ "Invite link sẽ được tạo tự động sau khi tạo phòng thành công, không cần nhập thủ công."
   - **Bước 2 — Phong cách thi đấu:**
     - 2 thẻ chọn: "Vui vẻ — Fun" (Chơi cùng bạn bè, ưu tiên trải nghiệm thoải mái.) và "Tryhard — Competitive" (Thi đấu nghiêm túc, đề cao tính cạnh tranh.);
     - ghi chú "Phong cách thi đấu không ép buộc thuật toán chia đội. Host có thể chọn Random, Tier hoặc Rank ở bước tiếp theo."
   - **Bước 3 — Công cụ chia đội:**
     - 3 thẻ có icon: Random (Chia ngẫu nhiên 10 người thành hai đội 5v5.), Tier Balance (Chia đội theo điểm Tier của người chơi.), Rank Balance (Chia đội theo Rank và quy tắc cân bằng.);
     - ghi chú "Đây là công cụ mặc định của Host khi Prepare; có thể cho phép thay đổi trước khi khóa đội hình."
   - **Bước 4 — Xem lại:**
     - "Xác nhận cấu hình phòng, sau đó tạo Room ở trạng thái OPEN.";
     - bảng nhãn–giá trị: Tên phòng, Thể thức, Quyền truy cập, Phong cách, Chia đội, Trạng thái ban đầu OPEN. Hiện **giá trị đã chọn**, không phải "Fun / Tryhard";
     - có khoảng cách giữa nhãn và giá trị (ảnh mockup bị dính chữ).
   - Thẻ/radio đang chọn: viền vàng + nền vàng nhạt, `aria-checked`/`role="radio"` trong `radiogroup`. Không dùng vàng đặc.
   - Thanh hành động: "Quay lại" (ghost) · "Tiếp tục" / ở bước 4 "Tạo phòng" (nút vàng đặc duy nhất).
   - Bấm tạo gọi `createRoomWithConfig`, rồi điều hướng tới phòng. Lỗi theo trường thì nhảy về đúng bước.
2. **Panel cấu hình trong phòng** (`5-phong-sau-khi-tao.png`), dùng cho cả trang phòng mock (`RoomDetail`) và `SupabaseRoomView`:
   - Đầu panel: tên phòng (h1 của trang nếu chưa có h1 khác; mỗi trang đúng 1 h1), dòng phụ "BO5 · Private · 0/10 Players" (số người lấy từ dữ liệu thật), badge "OPEN".
   - **"Thông tin phòng"** có icon khoá: "Thông tin đã được cố định sau khi tạo phòng."
   - **"Chế độ chơi"**: segmented Fun / Tryhard.
   - **"Công cụ chia đội"**: segmented Random / Tier / Rank.
   - Host đổi được qua `updateRoomConfig`; người khác chỉ xem (disabled). Có pending + toast lỗi.
   - Supabase khi `configPersisted === false`:
     - hiện cấu hình host vừa nhập (truyền qua state điều hướng sau khi tạo; không có thì hiện "Chưa có cấu hình");
     - ghi chú "Cấu hình chưa được lưu lên server (chờ backend)";
     - segmented disabled.
3. **Nút chia đội trong phòng Supabase** (`OpenRoomLineup`):
   - nhãn theo công cụ đang chọn;
   - Random giữ hành vi hiện tại;
   - Tier/Rank: nút disabled + ghi chú "Cần điểm Tier/Rank của người chơi — sắp có".

   Không đổi logic HUY-15 khác.
4. **Test (Vitest):**
   - stepper chỉ mở bước đã tới;
   - validate tên;
   - bước 4 hiện đúng giá trị đã chọn;
   - tạo gọi `createRoomWithConfig` đúng cấu hình;
   - panel: host đổi được nhóm 2/3, khách không; nhóm 1 khoá;
   - supabase `configPersisted:false` hiện ghi chú và disable.

   Cập nhật test cũ của wizard/RoomDetail nếu nhãn đổi (chỉ selector).

## Ghi chú học tập
Thêm mục "ROOM-CFG – Luồng tạo phòng 4 bước" vào `docs/ui-refactor/BUG_NOTES.md`, tiếng Việt, cho người mới:
- cấu trúc component;
- vì sao tách nhóm khoá/nhóm sửa được;
- cách radiogroup hoạt động với bàn phím;
- cách kiểm.

## Verify
1. Gốc worktree: `npm run build`, `npm run lint` (0 lỗi), `npm test` (web không giảm so với sau ROOM-CFG-a).
2. Dev 5199 (mock):
   - `node scripts/e2e-auth.mjs http://localhost:5199`: đạt;
   - `node scripts/screenshot.mjs roomcfg http://localhost:5199`: 40/40, không cuộn ngang.
3. Probe Playwright tạm (xoá sau khi chạy), kết quả ghi vào ghi chú:
   - đi hết 4 bước ở 375 và 1280, tạo phòng;
   - panel trong phòng đổi Fun→Tryhard, Random→Tier;
   - đếm nút vàng đặc ≤ 1 mỗi khung nhìn.
4. Tắt tiến trình của mình theo PID. `git status` sạch.

Commit:
- `feat(web): luồng tạo phòng 4 bước theo thiết kế`;
- `feat(web): panel cấu hình trong phòng`;
- `docs: ghi chú ROOM-CFG`.

Sau đó `orca orchestration send --type worker_done --outcome succeeded|failed`.
