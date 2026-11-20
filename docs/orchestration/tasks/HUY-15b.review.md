# HUY-15b review – Codex review UI Open Room do agy viết

- Reviewer: Codex `gpt-5.6-sol` medium · Worktree `.worktrees/HUY-15-room` · nhánh `feat/huy-15-room-mutations`
- Phạm vi: diff `3d77a78..HEAD`, tức các commit `1afd8b2` và `e4057c4`.

## Bước 0
```bash
graphify update . --no-cluster && graphify cluster-only . --no-label --no-viz
```
Dùng `graphify query` để lần theo quan hệ trước khi đọc rộng. Không chạy `extract`/`label`.

## Hàng rào
- Không gọi mạng tới Supabase, không `.env.local`.
- Không push. Không làm yếu test.
- Không đọc/ghi ngoài `D:\CustomAOV\base-workspace`.

## Kiểm
1. **Đúng hành vi:**
   - mỗi nút gọi đúng action + đúng `memberId`;
   - nút ẩn/disable theo `openRoomPermissions` (không tự tính quyền lại trong component);
   - swap/random tạo đúng 5v5 với đủ trường `OpenRoomLineupPlayer`;
   - `/join/:inviteCode` qua RequireAuth và điều hướng đúng `room_id` trả về;
   - `/rooms/new` chỉ đổi giao diện ở chế độ supabase, mock/api giữ nguyên wizard.
2. **State:**
   - không có state cục bộ lệch với snapshot (dựa vào refetch/realtime);
   - pending/disable chống bấm 2 lần;
   - modal xác nhận đóng đúng (`onClose` ổn định, theo bẫy trong AGENTS.md).
3. **AGENTS.md:**
   - ≤ 1 nút vàng đặc/khung nhìn;
   - `min-w-0`; không `text-[Npx]`, không spacing lẻ, không bo góc lẻ;
   - tiêu đề không bị cắt `…`;
   - 375px không cuộn ngang;
   - giữ nháy đơn, không chấm phẩy.
4. **Test:** test mới có kiểm hành vi thật hay chỉ render? Test cũ có bị sửa kỳ vọng không (`git diff 3d77a78..HEAD -- '*.test.*'`)?
5. **Bảo mật:** không lộ chi tiết lỗi SQL ra UI; không log dữ liệu người dùng.

## Đầu ra
- Lỗi chắc chắn (đúng hành vi, test, quy tắc): **sửa luôn** trong commit `fix(web): HUY-15b sửa theo review`, kèm test nếu là lỗi hành vi.
- Góp ý chủ quan: chỉ liệt kê, không sửa.
- Chạy lại web `npm test`, `npm run lint` (0 lỗi), `npm run build`. `git status` sạch.
- `orca orchestration send --type worker_done --outcome succeeded|failed`, kèm danh sách lỗi đã sửa và góp ý.
