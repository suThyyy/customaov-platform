# HUY-15d – Sửa lỗi phát hiện khi thử thật HUY-15c

- Coder: Codex `gpt-5.6-sol` medium · Worktree `.worktrees/HUY-15-room` · nhánh `feat/huy-15-room-mutations` (sau `50683d7`)
- Bước 0: `graphify update . --no-cluster && graphify cluster-only . --no-label --no-viz`, rồi `graphify query` trước khi đọc rộng. Không `extract`/`label`.
- Hàng rào:
  - không gọi Supabase thật, không đọc `.env.local`/`.env.test.local`;
  - không push; không làm yếu test;
  - **dev server 5199 đang chạy**, đừng tắt hay khởi động server khác;
  - được đọc `D:\ProjectCustom\db\migrations\*.sql` (chỉ đọc).

## Lỗi (Lead thấy khi chạy 2 trình duyệt trên Production)
1. **Nút "Bắt đầu" bật dù đội hình chưa đủ 5v5.**
   - Tái hiện: preparing → Chia ngẫu nhiên → Thay người. Người thay vào có `team = null`. Bấm Bắt đầu thì RPC trả lỗi `Save a complete active 5v5 lineup before Start`.
   - `start_open_room_round` yêu cầu 10 `room_current_players`, 5 `team='a'`, 5 `team='b'` (đọc thêm điều kiện còn lại trong SQL).
   - Sửa: `openRoomPermissions.start` chỉ `true` khi đội hình đủ điều kiện như SQL. Khi preparing mà chưa đủ, hiện gợi ý ngắn cạnh nút: "Xếp đủ 5v5 rồi mới bắt đầu".
2. **Người chưa có đội không hiện trong cột Team A/B**, nên host không có cách xếp ngoài "Chia ngẫu nhiên".
   - Sửa: thêm nhóm "Chưa xếp đội" trong `OpenRoomLineup`. Mỗi người trong nhóm có nút "Vào Team A"/"Vào Team B", chỉ bật cho đội còn thiếu (< 5). Bấm gọi `saveLineup` với đội hình mới.
   - Giữ `skill_*` của người đó (nếu null thì `skill_mode: 'random'`).
3. **Thông điệp lỗi:** `Save a complete active 5v5 lineup before Start` hiện bị ánh xạ thành "Chưa đủ người chơi…", dễ hiểu nhầm. Đổi thành thông điệp riêng: "Hãy xếp đủ đội hình 5v5 trước khi bắt đầu." Không được làm hỏng các ánh xạ khác.
4. **Kiểm, rồi sửa nếu là lỗi:** sau khi một thành viên tài khoản "Rời phòng" lúc vòng đã kết thúc, tên họ vẫn còn 1 chỗ trên màn host.
   - Nếu đó là bảng đội hình của vòng vừa kết thúc (dữ liệu `room_current_players` của server) thì không sửa, chỉ ghi chú.
   - Nếu là danh sách "Ngoài hàng chờ" hay hàng chờ mà vẫn hiện người `status <> 'active'` thì lọc bỏ.

## Test
- Thêm test cho cả 4 mục: quyền `start` theo đội hình; nhóm "Chưa xếp đội" + nút gọi `saveLineup` đúng đội; ánh xạ lỗi mới; lọc thành viên đã rời (nếu sửa).
- Web `npm test` (≥ 204, không giảm), `npm run lint` (0 lỗi), `npm run build`. `git status` sạch.

Commit `fix(web): HUY-15d sửa lỗi đội hình 5v5 sau thay người`, rồi `orca orchestration send --type worker_done --outcome succeeded|failed`, kèm kết luận mục 4.
