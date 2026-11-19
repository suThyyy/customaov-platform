# Đặc tả backend cấu hình phòng Custom

Tài liệu này là đề xuất để Huy Hoàng triển khai trên backend Supabase. Phần frontend hiện đã có adapter; chưa có thay đổi migration, SQL hay RPC production trong nhánh này.

## 1. Mô hình dữ liệu đề xuất

Bổ sung vào bảng `rooms`:

| Cột | Kiểu | Mặc định | Ràng buộc |
|---|---|---|---|
| `name` | `text not null` | – | `check (char_length(btrim(name)) between 3 and 60)` |
| `series` | `text not null` | `'BO5'` | `check (series in ('BO3', 'BO5', 'BO7'))` |
| `access` | `text not null` | `'private'` | `check (access in ('public', 'private'))` |
| `play_style` | `text not null` | `'fun'` | `check (play_style in ('fun', 'tryhard'))` |
| `split_tool` | `text not null` | `'random'` | `check (split_tool in ('random', 'tier', 'rank'))` |

`name`, `series`, `access` bị khoá sau khi tạo. `play_style` chỉ là nhãn phong cách, không được dùng để ép thuật toán chia đội. `split_tool` là công cụ mặc định của Host ở pha Prepare; việc cân bằng Tier/Rank thật sẽ triển khai khi có dữ liệu tương ứng. Phòng mới vẫn có `status = 'open'`, round đầu ở `idle` theo mô hình hiện tại.

## 2. RPC tạo phòng

Thay chữ ký không tham số hiện tại bằng:

```sql
create_open_room(
  p_name text,
  p_series text,
  p_access text,
  p_play_style text,
  p_split_tool text
)
```

RPC phải:

- yêu cầu tài khoản thường đã đăng nhập và tạo Host như luồng hiện tại;
- trim rồi kiểm tra tên 3–60 ký tự, kiểm tra toàn bộ enum trước khi ghi;
- sinh `invite_code` cho cả phòng private; chỉ trả invite code cho Host/thành viên có quyền;
- tạo phòng ở trạng thái OPEN và trả snapshot/cột cấu hình vừa ghi;
- chạy trong một transaction để không tạo phòng thiếu Host khi một bước lỗi.

## 3. RPC cập nhật cấu hình có thể sửa

```sql
update_open_room_settings(
  p_room_id uuid,
  p_version integer,
  p_play_style text,
  p_split_tool text
)
```

Quy tắc:

1. Khoá dòng phòng (`for update`) và từ chối khi `version <> p_version`.
2. Chỉ Host đang hoạt động của phòng được gọi.
3. Chỉ nhận `play_style`, `split_tool`; tuyệt đối không nhận hay cập nhật `name`, `series`, `access`.
4. Chỉ cho phép khi round hiện tại ở `idle`, `ended`, hoặc `preparing` nhưng **chưa lưu đội hình**. Nếu `room_current_players` đã có đội hình của round đang chuẩn bị thì trả lỗi trạng thái.
5. Validate enum, tăng `version`, trả snapshot mới. Nên dùng cùng quy ước lỗi version/Host/state mà các RPC Open Room hiện tại đang dùng để adapter ánh xạ thống nhất.

## 4. Quyền đọc và ý nghĩa phòng công khai

- Host và thành viên đang hoạt động được đọc đầy đủ phòng mình tham gia, kể cả cấu hình và invite code theo policy hiện tại.
- Người có invite hợp lệ được vào phòng private qua RPC join; không mở policy đọc trực tiếp toàn bộ bảng `rooms` cho anonymous hay mọi authenticated user.
- `access = 'public'` nghĩa là phòng có thể xuất hiện trong danh sách khám phá và người đã đăng nhập có thể mở/join mà không cần invite code. Nó không có nghĩa là cho phép đọc tuỳ ý bảng `rooms` bằng PostgREST.
- Cần một RPC/policy đọc riêng cho danh sách công khai, chỉ trả các cột an toàn (`id`, `name`, `series`, `play_style`, số người, trạng thái), không trả `invite_code` hay dữ liệu thành viên nhạy cảm. Phòng private không được lọt vào danh sách này.

## 5. Ánh xạ adapter frontend

API công khai cho UI:

- `createRoomWithConfig(config)`
- `getRoomConfig(roomId)`
- `updateRoomConfig(roomId, editable)`
- kiểu `RoomConfig`, `RoomConfigLocked`, `RoomConfigEditable`
- capability `roomsAdapter.configPersisted`

Nguồn mock lưu đủ cấu hình. Nguồn Supabase hiện gọi `createOpenRoom()` không tham số đúng một lần nhưng trả `configPersisted: false`; đọc trả `config: null`, và cập nhật chỉ phản hồi trạng thái chưa lưu. Khi các RPC trên được deploy, chỉ cần thay triển khai trong `src/api/supabase/` và chuyển capability thành `true`; UI không cần đổi hợp đồng.

Platform Fastify hiện chỉ có các trường tương đương `title`, `visibility`, `mode` và `config.{series,pickMode,tools}`. Adapter tương thích đang ánh xạ `playStyle` vào `mode`, và mã hoá lựa chọn `splitTool` qua `pickMode` + `balance`; Platform chưa có endpoint cập nhật settings nên `updateRoomConfig` báo lỗi rõ ràng. Không thay schema DB Platform trong công việc này.
