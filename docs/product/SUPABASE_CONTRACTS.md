# Hợp đồng Supabase cho Auth, Profile và Open Room

Tài liệu này chốt hợp đồng mà frontend HUY-14 sử dụng, dựa trên migration và mã JavaScript cũ tại commit `595a24e` của `D:\ProjectCustom`. Không chứa URL, khóa hay tài khoản thật. Supabase hiện là Production; HUY-14 chỉ kiểm thử bằng client giả.

## 1. Bảng và cột

| Bảng | Cột frontend dùng | Ghi chú |
| --- | --- | --- |
| `profiles` | `id uuid` PK/FK `auth.users`; `role text` (`player|organizer|admin`); `display_name text?`; `avatar_url text?`; `bio text?`; `created_at timestamptz` | Trigger Auth tạo hàng. Nguồn: `20261102_huy5_profiles_security.sql:11-30`. |
| `game_profiles` | `id uuid`; `user_id uuid` unique; `ingame_name text`; `game_uid text?`; `current_tier text?`; `current_rank text?`; `main_roles text[]`; `system_mmr int`; `uid_changed_at timestamptz?`; `uid_change_available_at timestamptz?`; `created_at timestamptz` | Hai cột cooldown được thêm tại `20261103_huy8_game_uid_cooldown.sql:7-9`. |
| `rooms` | `id uuid`; `host_user_id uuid`; `invite_code text` unique; `status open|closed`; `current_round_no int`; `current_round_state idle|preparing|active|ended`; `version bigint`; `created_at`; `closed_at?` | `20261103_huy9_open_room_security.sql:16-31`. |
| `room_members` | `id uuid`; `room_id uuid`; `user_id uuid?`; `member_kind account|guest`; `display_name`; `status active|left|kicked`; `joined_at`; `left_at?` | HUY-10 cho phép `user_id` null với người do Host thêm, nhưng participant đăng nhập vẫn là account: `20261103_huy10_room_api_support.sql:8-19`; HUY-10 sau đó cấm Anonymous Auth join. |
| `room_queue_entries` | `id`; `room_id`; `member_id`; `queue_seq bigint identity`; `status waiting|selected|played|removed`; `joined_at`; `selected_round_no?` | Một member chỉ có một entry đang hoạt động (`waiting|selected`): `20261103_huy9_open_room_security.sql:48-68`. |
| `room_current_players` | `room_id`; `round_no`; `member_id`; `queue_entry_id`; `slot 1..10`; `ready_state`; `team a|b?`; `skill_mode random|tier|rank?`; `skill_value?`; `skill_score?` | Bảng gốc: `20261103_huy9_open_room_security.sql:72-88`; skill columns: `20261103_huy11_room_lineup.sql:11-15`; random: `20261104_huy11_random_mode_lineup.sql:6-10`. |

## 2. RLS và quyền bảng

- `profiles`: RLS bật. `Users Read Own Profile` chỉ cho hàng `auth.uid() = id`; `Users Update Own Profile` chỉ update hàng của chính mình và có cùng `WITH CHECK`. Role không thể đổi bởi client vì trigger `prevent_profile_role_escalation`; chỉ `service_role` gọi `set_profile_role`. Tham chiếu `20261102_huy5_profiles_security.sql:136-194`.
- `game_profiles`: RLS bật. Migration sau cùng thay policy đọc-own bằng `Public Read Game Profiles`, áp cho `anon, authenticated`, `using (true)` (`20261102_huy5_game_profiles_public_read.sql:8-16`). Quyền update trực tiếp bị revoke; đổi `game_uid` chỉ qua RPC (`20261103_huy8_game_uid_cooldown.sql:11-15`).
- Bốn bảng Room: revoke toàn bộ từ `public, anon, authenticated`, rồi grant `SELECT` cho `authenticated`; RLS chỉ cho Host hoặc `room_members.status='active'` đọc room tương ứng qua `huy9_can_access_room`. Không có direct write policy; mọi ghi đi qua `SECURITY DEFINER`. Tham chiếu `20261103_huy9_open_room_security.sql:99-160`.
- Vì danh sách `rooms` chỉ hiện những phòng người dùng đang là Host/member, không có danh sách công khai tương đương landing/dashboard. HUY-14 giữ danh sách phòng ở mock và gắn nhãn **Dữ liệu mẫu**; chỉ `/rooms/:roomId` UUID đọc Supabase.

## 3. RPC Profile

| Hàm | Tham số → trả về | Security / quyền | Lỗi có thể ném |
| --- | --- | --- | --- |
| `request_game_uid_change` | `new_game_uid text` → `game_profiles` | `SECURITY DEFINER`, `search_path=pg_catalog,public`; revoke public/anon/authenticated rồi grant `authenticated` (`20261103_huy8_game_uid_cooldown.sql:15-19,63-66`; phiên bản anonymous-hardened tại `20261103_huy9_anonymous_auth_compatibility.sql:98-140`). | `authenticated user required`; `permanent account required`; `game UID is required`; `game profile not found`; `game UID can be changed again after %`. Không đổi khi UID giống hiện tại. |
| `set_profile_role` | `target_user_id uuid, target_role text` → `void` | `SECURITY DEFINER`, `search_path=public`; chỉ `service_role`, không cấp browser (`20261102_huy5_profiles_security.sql:103-134`). | trusted-service required; unsupported role; profile not found. Frontend không gọi. |

Các hàm trigger `handle_new_user`, `huy9_ensure_user_profiles`, `handle_anonymous_user_upgrade` và `prevent_profile_role_escalation` không phải RPC browser. Anonymous Auth không có profile; khi nâng cấp thành account thường, trigger mới tạo profile (`20261103_huy9_anonymous_auth_compatibility.sql:1-96`).

## 4. RPC Open Room

Tất cả hàm client bên dưới dùng `search_path=pg_catalog,public`. Trừ `read_open_room_state` là `SECURITY INVOKER`, các mutation là `SECURITY DEFINER`. Các hàm được revoke khỏi `public,anon,authenticated` rồi grant lại `authenticated`; helper `huy11_lock_preparing` và `huy9_is_anonymous_session` không được grant cho client.

| Hàm | Tham số → trả về | Quy tắc và lỗi chính |
| --- | --- | --- |
| `read_open_room_state` | `p_room_id uuid` → `jsonb {room,members,queue,currentPlayers}` | Invoker/RLS; mảng queue order `queue_seq`, player order `slot`; không thấy room trả null. `20261103_huy11_room_lineup.sql:17-25,155-160`. |
| `create_open_room` | không tham số → `rooms` | Account thường; lỗi `Only a registered authenticated user can create a room`. `20261103_huy9_open_room_security.sql:175-196`; hotfix pgcrypto giữ cùng contract. |
| `join_open_room` | `p_invite_code text, p_display_name text` → `room_members` | Bản sau cùng HUY-10 yêu cầu account thường; lỗi `Permanent authenticated account required`, input không hợp lệ, room không tồn tại/đóng, participant bị kick. `20261103_huy10_account_only_join.sql:8-73`. |
| `leave_open_room` | `p_room_id uuid` → `void` | Chỉ member của chính JWT; lỗi `Room membership not found`; entry active thành `removed`. `20261103_huy9_open_room_security.sql:267-290`. |
| `close_open_room` | `p_room_id uuid` → `rooms` | Account Host; lỗi `Permanent authenticated Host required`, `Only the active Room Host can close this Room`. `20261103_huy10_room_api_support.sql:22-45,174-181`. |
| `host_add_player_to_room` | `p_room_id uuid,p_display_name text` → `room_members` | Host account thêm player không có user_id; lỗi permanent Host, display name, active Host. `20261103_huy10_room_api_support.sql:47-85`. |
| `host_kick_room_member` | `p_room_id uuid,p_member_id uuid` → `void` | Host account; bản HUY-11 thay selected bằng waiting đầu FIFO nếu đang preparing. Lỗi permanent Host, only active Host, member not found, Host cannot kick self, already kicked. `20261104_huy11_kick_replace_selected.sql:6-108`. |
| `host_requeue_room_member` | `p_room_id uuid,p_member_id uuid` → `room_queue_entries` | Chỉ active Host-added player; lỗi permanent Host, only Host, wrong member kind/state, already active queue. `20261103_huy10_room_api_support.sql:126-181`. |
| `continue_open_room_queue` | `p_room_id uuid` → `room_queue_entries` | Member active tự vào lại cuối FIFO; lỗi membership not found/already registered. `20261103_huy9_open_room_security.sql:385-428`. |
| `prepare_next_open_room_round` | `p_room_id uuid` → `rooms` | Host account; cần state idle/ended và ≥10 waiting active; chọn 10 `order by queue_seq`; lỗi permanent account, Host only, wrong state, `Ten waiting players required...`, `Queue changed; refresh and retry`. `20261103_huy11_room_lineup.sql:97-129,158-164`. |
| `save_open_room_lineup` | `p_room_id uuid,p_version bigint,p_players jsonb` → `rooms` | Host account, preparing, optimistic lock. `p_players` đúng 10 unique selected, team 5v5; mode cuối cùng cho `random|tier|rank`. Lỗi `Permanent account required`, `Host only`, `Round is not preparing`, `Room changed; refresh and retry`, invalid lineup/values, exactly ten, teams 5v5. `20261103_huy11_room_lineup.sql:28-68`; bản cuối `20261104_huy11_random_mode_lineup.sql:12-39`. |
| `replace_open_room_player` | `p_room_id uuid,p_version bigint,p_member_id uuid` → `rooms` | Cùng khóa/version; thay bằng waiting đầu FIFO. Lỗi selected not found/no waiting player và các lỗi lock trên. `20261103_huy11_room_lineup.sql:72-93`. |
| `start_open_room_round` | `p_room_id uuid` → `rooms` | Host account, preparing, đủ lineup 5v5 active; lỗi permanent account, Host only, wrong state, `Save a complete active 5v5 lineup before Start`. Bản cuối `20261104_huy11_random_mode_lineup.sql:41-66`. |
| `end_open_room_round` | `p_room_id uuid` → `rooms` | Host + active; lỗi `Only the Host can end an active Round`; selected chuyển played. `20261103_huy9_open_room_security.sql:363-382`. |

Helper `huy9_can_access_room(uuid) → boolean` là `SECURITY DEFINER`, `row_security=off`, chỉ trả boolean và được grant authenticated để policy dùng (`20261103_huy9_open_room_security.sql:108-145,172-173`).

## 5. Waiting, Selected và FIFO

- Waiting là entry `status='waiting'` của member `status='active'`, hiển thị tăng dần `queue_seq`. `queue_seq` là identity toàn cục; index `(room_id,status,queue_seq)` hỗ trợ FIFO (`20261103_huy9_open_room_security.sql:48-68`).
- Selected là snapshot `room_current_players`, order `slot`; queue entry tương ứng có `status='selected'` và `selected_round_no=current_round_no` (`20261103_huy11_room_lineup.sql:117-127`).
- Prepare khóa và chọn tối đa/chính xác 10 waiting đầu `order by queue_seq`. Replace/kick cũng lấy waiting đầu, không cho client nhảy hàng (`20261103_huy11_room_lineup.sql:70-91`; `20261104_huy11_kick_replace_selected.sql:53-83`).
- Khi kết thúc vòng, selected → played. `continue_open_room_queue` tạo entry identity mới nên người chơi quay về cuối hàng.

## 6. Realtime

Channel `open-room:<roomId>` theo `room-controller.js:99-108`. Subscribe `postgres_changes`, `event:'*'`, schema `public` cho:

| Bảng | Filter |
| --- | --- |
| `rooms` | `id=eq.<roomId>` |
| `room_members` | `room_id=eq.<roomId>` |
| `room_queue_entries` | `room_id=eq.<roomId>` |
| `room_current_players` | `room_id=eq.<roomId>` |

Bốn bảng được thêm vào publication `supabase_realtime` ở `20261103_huy11_room_lineup.sql:166-176`. Client chỉ dùng event làm tín hiệu rồi refetch snapshot (debounce); không patch payload. Trạng thái lỗi/timeout/closed retry 1s, 2s, 5s, 10s; mỗi subscribe lại refetch để khôi phục event bị lỡ; rời route/đổi room/logout gọi `removeChannel`.

## 7. Ánh xạ sang UI

| Supabase | UI | Không có ở Supabase Open Room/Profile |
| --- | --- | --- |
| `profiles` + `game_profiles` | `Me`, `UserProfile`; display name ưu tiên `profiles.display_name`, fallback email prefix/ingame name | Level, KDA, win rate, MVP, lịch sử, thành tích, tướng, item, cover; UI phải empty, không sinh số giả. |
| `rooms` | Tiêu đề tối thiểu `Phòng #<invite_code>`, trạng thái/vòng/version, quyền viewer | Tên phòng, mô tả, mode Platform, visibility/key, thumbnail, chat, đội kiểu `RoomDetail` Platform. |
| queue waiting | `waiting[]` theo `queue_seq` | Không phải `teams.blue/red` của Platform. |
| current players | `selected[]` theo `slot`, team a/b, ready/skill | Không có lane/chat/result của Platform. |

Hai model không được gộp: UUID Open Room render `SupabaseRoomView`; room code Platform/mock giữ view cũ. Chat/tournaments/registrations/activities/search và danh sách room là sample khi chế độ tổng là Supabase.

## 8. Failure modes client

- Chưa đăng nhập hoặc phiên anonymous: coi là khách; route auth chuyển về login; adapter trả lỗi 401 và không đọc snapshot.
- RLS từ chối/không phải member: PostgREST có thể trả `42501` hoặc query không thấy hàng; UI dùng thông báo chung “không tồn tại hoặc không có quyền”, không phân biệt để tránh lộ dữ liệu.
- Room không tồn tại: RPC trả null; UI empty state.
- Mạng rớt: giữ trạng thái connection reconnecting, retry backoff; snapshot không được patch từ event.
- Token hết hạn: Supabase JS tự refresh; nếu refresh thất bại, `onAuthStateChange` trả session null, AppContext xóa user/cache/subscription.
- Auth sai mật khẩu/email chưa xác minh/rate limit/OTP hết hạn: map thông báo tiếng Việt; không log email, mật khẩu hay token.
