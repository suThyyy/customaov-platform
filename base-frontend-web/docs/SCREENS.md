# Inventory màn hình (nguồn: bộ ảnh mock `UI-Mock`, khung 1672×941)

| # | File ảnh | Màn hình | Route | Khối chính | Thành phần dùng chung |
|---|----------|----------|-------|------------|------------------------|
| 1 | `trang-chu-guest.png` | Trang chủ (khách) | `/` | Header ngang (logo, nav, Đăng nhập/Đăng ký); Hero full-bleed (eyebrow, H1, mô tả, 2 CTA); 4 thẻ tính năng; Bảng "Phòng custom đang hoạt động"; Thẻ "Giải đấu cộng đồng nổi bật" | GuestHeader, Button (pill), FeatureCard, RoomsTable, TournamentPromoCard, StatusBadge, Chip, Avatar |
| 2 | `trang-chu-user.png` | Trang chủ (đã đăng nhập) | `/dashboard` | Sidebar; Topbar (search Ctrl K, chuông, user menu); Hero carousel (eyebrow, H1, 2 CTA, chấm trang); 4 thẻ tính năng nhỏ; Bảng phòng; Thẻ hồ sơ + 3 chỉ số; Thẻ giải đấu nổi bật; Hoạt động gần đây | AppShell (Sidebar + Topbar), PageBanner, FeatureCard, RoomsTable, TournamentPromoCard, Card, SectionTitle, Badge |
| 3 | `trang-phong-custom.png` | Phòng custom (chi tiết phòng) | `/rooms/:roomId` (mẫu: `/rooms/AOV-1024`) | Banner phòng (tên, meta, mã phòng + copy, Chia sẻ / … / Bắt đầu chia đội); 2 cột Team Xanh / Team Đỏ (avatar, tên, lane chip, ready); Panel tabs Công cụ / Cấu hình / Ghi chú với 4 công cụ; Thanh chat + Xuất kết quả | AppShell, PageBanner, TeamPanel, LaneChip, Tabs, ToolItem, Button |
| 4 | `trang-giai-dau.png` | Danh sách giải đấu | `/tournaments` | Banner + "Tạo giải đấu"; Bộ lọc pill (Tất cả / Đang mở đăng ký / Đang diễn ra / Đã kết thúc) + Sắp xếp; 3 thẻ giải (ảnh + badge trạng thái, tiêu đề, meta, mô tả, cột thông số, "Xem chi tiết") | AppShell, PageBanner, FilterPills, TournamentRow, StatusBadge, Button |
| 5 | `chi-tiet-giai-dau.png` | Chi tiết giải đấu | `/tournaments/:slug` (mẫu: `/tournaments/ngu-kiet-cup-mua-1`) | Banner (trạng thái, meta, 4 nút); Tabs (Thông tin / Danh sách đội / Bảng đấu / Lịch thi đấu / Kết quả); Nhánh đấu loại trực tiếp (Tứ kết → Bán kết → Chung kết, cúp); Lịch thi đấu sắp tới; Kết quả gần đây; Thông tin giải đấu (4 ô) | AppShell, PageBanner, Tabs, BracketMatch, MatchRow, InfoTile, SectionTitle |
| 6 | `ho-so-user.png` | Hồ sơ người dùng | `/profile` (alias `/profile/:userId`) | Banner hồ sơ (avatar lớn, tên, Lv, ID copy, 2 badge vai trò, bio, Chỉnh sửa / …); Tabs (Tổng quan / Lịch sử trận / Tướng ưa thích / Thành tích); 4 thẻ chỉ số; Tướng ưa thích (5 thẻ); Vai trò ưa thích (5 thanh %); Lịch sử trận gần đây (bảng, trang bị) | AppShell, Tabs, StatCard, ChampionCard, RoleBar, Badge, SectionTitle |
| 7 | `cau-hinh-room.png` | Tạo / cấu hình phòng custom | `/rooms/new` | Banner "Tạo phòng custom"; Stepper 3 bước; Form bước 1 (Tên phòng + đếm ký tự, Mô tả, Chế độ phòng 4 lựa chọn, Hiển thị Công khai/Riêng tư, Tùy chọn hỗ trợ: 2 toggle + chọn số khán giả); Hủy / Tiếp tục | AppShell, PageBanner, Stepper, TextField, OptionCard, RadioCard, Toggle, Select, Button |

## Thành phần dùng chung (tổng hợp)

- **Khung**: `GuestHeader` (màn 1), `AppShell` = `Sidebar` + `Topbar` (màn 2–7).
- **Nút**: primary vàng (gradient), outline, secondary (nền xám đậm), gold-outline ("Xem chi tiết"), icon button vuông.
- **Thẻ**: `Card` nền surface + viền mảnh, bo 16px.
- **Badge**: trạng thái (Đang chờ / Đang diễn ra / Đang mở đăng ký / Đã kết thúc / Thắng / Thua), pill vàng (Lv, vai trò), chip trung tính (chế độ 5v5).
- **Avatar**: tròn (người chơi), bo góc (avatar user ở topbar / hồ sơ).
- **Tabs**: gạch chân vàng.
- **SectionTitle**: icon vàng + tiêu đề + link "Xem tất cả →".
