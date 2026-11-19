# HUY-15 – Báo cáo: Room, Queue & Randomizer trên Supabase (React)

Ngày 18/11/2026 · Nhánh `feat/huy-15-room-mutations` (xếp chồng trên `feat/huy-14-supabase-adapters`) · Lead: Claude

## Phân công
| Phần | Người làm | Nội dung | Commit |
|---|---|---|---|
| 15a | Codex | Adapter cho 13 RPC ghi, phân loại lỗi, `openRoomPermissions`, `useOpenRoomActions`, docs RPC ghi | `4a32a63`, `3d77a78` |
| 15b | Antigravity | UI: `/rooms/new` (supabase), `/join/:inviteCode`, hàng chờ, đội hình 5v5, điều khiển vòng, menu thao tác, hộp xác nhận | `1afd8b2`, `e4057c4` |
| 15b review | Codex | Sửa requeue sai `memberId`, gom quyền về một chỗ, khoá chống gọi trùng, test 5v5, bỏ cắt chữ | `50683d7` |
| 15c | Lead | Thử thật 2 client trên Production (bên dưới) | — |
| 15d | Codex | Sửa lỗi phát hiện ở 15c (bên dưới) | `d2b4b1d`, `b964738` |

## Kiểm tra tự động
- web 212 test, lint 0 lỗi (2 cảnh báo có từ trước), `tsc -b` đạt. Lead đã tự chạy lại.
- Theo báo cáo của worker:
  - api 170: chạy theo từng file vì runner Vitest/PGlite toàn bộ bị treo trên Windows;
  - contracts 89, team-core 15;
  - e2e mock và screenshot 40/40 (agy, ở 15b).

## Kiểm chứng thật (HUY-15c)
- **Môi trường:** Supabase Production `mbgiwrocfacxianindfp`. Owner duyệt ghi tối thiểu (`docs/orchestration/DECISIONS.md`, 18/11).
- **Migration:** đến `20261104_huy11_*` (ProjectCustom `595a24e`). Không chạy hay sửa migration nào.
- **Tài khoản:** 2 tài khoản test có sẵn (test-1 là host, test-2 là thành viên), dùng URL + anon key. Không đăng ký mới, không dùng service_role.
- **Công cụ:** Playwright 2 browser context độc lập + dev server `VITE_DATA_SOURCE=supabase`. Phép thử version cũ dùng `supabase-js` bằng phiên của test-1.

Lần chạy cuối (phòng `50d39ac4…`, 11:16–11:17): **tất cả kiểm tra đạt.**

| Tiêu chí | Kết quả |
|---|---|
| Tạo phòng, link mời đủ 36 ký tự, vào bằng `/join/:code` | Đạt |
| Realtime giữa 2 client: vào phòng, thêm người, đổi pha, đổi đội | Đạt, phần lớn dưới 1,4 giây |
| Hàng chờ FIFO đúng thứ tự vào, `queue_seq` tăng dần, 2 client thấy giống nhau | Đạt (11 người) |
| Kick người đang chờ | Đạt |
| Prepare chọn 10 người đầu hàng chờ, người thứ 11 ở lại | Đạt |
| Chia ngẫu nhiên, đổi chỗ (version tăng 1→2→3) | Đạt |
| Khoá version: lưu đội hình với version cũ | Bị từ chối `Room changed; refresh and retry` |
| Thay người: người đầu hàng chờ vào, nhận đúng đội của người bị thay, vẫn 5v5 | Đạt |
| Requeue người do host thêm đang ở ngoài hàng chờ → vào cuối | Đạt |
| Start khi test-2 mất mạng → bật lại tự cập nhật pha, kết nối realtime lại | Đạt (≈ 0,3 giây sau khi có mạng) |
| End, nút "Vòng tiếp theo" | Đạt |
| test-2 rời phòng, đăng xuất xoá token | Đạt |
| Lỗi console | Không có |

**Nhật ký ghi của lần chạy cuối** (25 request ghi, 11 trong số đó là `host_add_player_to_room`):

```
create_open_room · join_open_room · host_add_player_to_room ×10 · host_kick_room_member
host_add_player_to_room · prepare_next_open_room_round · save_open_room_lineup ×2
save_open_room_lineup (version cũ, bị từ chối) · replace_open_room_player · save_open_room_lineup
host_requeue_room_member · start_open_room_round · end_open_room_round · leave_open_room · close_open_room
```

**Dữ liệu để lại trên Production:**
- 10 phòng thử do test-1 tạo (từ 10:49 đến 11:17, gồm cả các lần chạy lỗi giữa chừng), **đều đã đóng** (`status = closed`).
- Thành viên giả lập "QA Bot n" và "QA test-2" nằm trong các phòng đã đóng đó.
- Không xoá dữ liệu nào và không đụng phòng hay người dùng khác.

## Lỗi phát hiện khi thử thật và đã sửa
1. **Nút "Bắt đầu" bật khi đội hình chưa đủ 5v5.** Server từ chối với `Save a complete active 5v5 lineup before Start`.
   - Quyền `start` giờ đòi đội hình đủ như SQL, kèm gợi ý cho host.
   - Thông điệp lỗi riêng: "Hãy xếp đủ đội hình 5v5 trước khi bắt đầu."
2. **Thay người làm mất đội của cả 10 người.** Nguyên nhân: `replace_open_room_player` chạy `update room_current_players set team=null where room_id=…`. UI cũ còn tự gán đội theo slot khi bấm "Vào Team", có thể ra 6–4.
   - `useOpenRoomActions.replace` chụp đội cũ → gọi replace → refetch → lưu lại đội hình bằng version mới, người mới nhận đội của người bị thay.
   - Bỏ việc gán đội ngầm.
   - Nút "Vào Team" chỉ bật khi đúng 1 người thiếu đội.
3. **Hàng chờ hiện người đã rời:** lọc thêm `status = active`. Tên còn trong bảng đội hình của vòng vừa kết thúc là dữ liệu đúng của server, giữ nguyên.

## Khoảng trống backend (cần Huy Hoàng)
- **Next:** chưa có state nhập Match ID / lưu kết quả trận. UI chỉ ghi "Lưu kết quả trận: sắp có".
- Chưa có lịch sử trận và thống kê.
- Không có RPC swap. Đổi chỗ = `save_open_room_lineup` với đội mới.
- Hàng chờ không có giới hạn.
- Không có RPC cập nhật `ready_state`.
- **Đề xuất:** `replace_open_room_player` chỉ nên đặt `team = null` cho người mới, hoặc cho người mới thừa hưởng đội của người bị thay. Hiện UI phải lưu thêm một lần; nếu có thao tác khác xen vào giữa 2 bước, đội hình sẽ trống và host phải bấm "Chia ngẫu nhiên".
- **Hành vi cần biết:** requeue chỉ áp dụng cho người do host thêm đang ở ngoài hàng chờ (ví dụ vừa bị thay ra). Nó không dời người đang chờ xuống cuối.

## Chưa làm / ngoài phạm vi
- Tải đồng thời nhiều người và kiểm thử tải (load QA).
- Khách ẩn danh (Anonymous Auth): bản hiện tại chỉ cho tài khoản thật vào phòng (migration huy10 account-only join).
