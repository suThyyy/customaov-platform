# ROOM-CFG-b review – Codex review UI tạo phòng của agy

- Reviewer: Codex `gpt-5.6-sol` medium · Worktree `.worktrees/room-config` · nhánh `feat/room-create-config`
- Phạm vi: các commit sau `f17a74e` (ROOM-CFG-a) tới HEAD.
- Đối chiếu với `docs/orchestration/tasks/ROOM-CFG-b.md` (đặc tả) và 5 ảnh `docs/ui-refactor/mockups/create-room/`.

## Bước 0
`graphify update . --no-cluster && graphify cluster-only . --no-label --no-viz`, rồi dùng `graphify query`. Không chạy `extract`/`label`.

## Hàng rào
- Không gọi Supabase thật, không đọc `.env.local`.
- Không push. Không làm yếu test.
- Không đọc/ghi ngoài `D:\CustomAOV\base-workspace`.
- Dev server nếu cần: cổng 5199, tắt theo PID sau khi dùng.

## Kiểm
1. **Khớp thiết kế:**
   - đủ 4 bước, đúng nhãn và mô tả như ảnh;
   - bước 4 hiện giá trị đã chọn, nhãn và giá trị không dính nhau;
   - panel trong phòng: nhóm 1 khoá, segmented Fun/Tryhard và Random/Tier/Rank;
   - không có chữ chú thích của mockup ("Minh họa…", "Chưa kết nối Backend").
2. **Đúng hành vi:**
   - stepper chỉ mở bước đã tới;
   - lỗi theo trường nhảy đúng bước;
   - tạo gọi `createRoomWithConfig` đúng cấu hình rồi điều hướng đúng (mock: mã phòng; supabase: id phòng);
   - host đổi nhóm 2/3 qua `updateRoomConfig`, người khác chỉ xem;
   - `configPersisted:false` hiện ghi chú và disable;
   - Tier/Rank trong `OpenRoomLineup` disable kèm ghi chú, Random giữ hành vi HUY-15.
3. **Wizard cũ đã xoá sạch:** không còn import hay mock chết (BO1, lane/tướng, luật pick). Luồng api mode vẫn tạo được phòng (`CreateRoom.api.test.tsx`).
4. **Truy cập:**
   - `RadioGroup`: `role="radiogroup"`/`radio`, `aria-checked`, phím mũi tên, roving tabindex, nhãn liên kết;
   - mỗi trang đúng 1 `h1`.
5. **AGENTS.md:**
   - ≤ 1 nút vàng đặc mỗi khung nhìn;
   - `min-w-0`; tên phòng dài xuống dòng, không cắt `…` ở tiêu đề;
   - token chữ, spacing, bo góc đúng thang; không `text-[Npx]`;
   - 375px không cuộn ngang;
   - nháy đơn, không chấm phẩy.
6. **Test:** test mới kiểm hành vi thật hay chỉ render? Test cũ có bị sửa kỳ vọng (ngoài selector) không: `git diff f17a74e..HEAD -- '*.test.*'`.

## Đầu ra
- Lỗi chắc chắn: **sửa luôn**, commit `fix(web): ROOM-CFG sửa theo review`, kèm test nếu là lỗi hành vi.
- Góp ý chủ quan: chỉ liệt kê.
- Chạy lại web `npm test`, `npm run lint` (0 lỗi), `npm run build`. `git status` sạch.
- `orca orchestration send --type worker_done --outcome succeeded|failed`, kèm danh sách lỗi đã sửa và góp ý.
