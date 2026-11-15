# CHANGELOG – customAOV

Tất cả các thay đổi và cột mốc phát triển của dự án **customAOV** được ghi nhận chi tiết tại đây theo tiến trình các Epic từ E1 đến E7.

---

## [1.0.0-mvp] – 2026-11-15

Phiên bản phát hành **MVP (Minimum Viable Product)** của customAOV. Hệ thống chuyển đổi toàn diện từ giao diện mẫu tĩnh (mock frontend) sang ứng dụng web hoàn chỉnh kết nối backend thật, hỗ trợ tổ chức phòng custom 5v5 cân bằng và các giải đấu cộng đồng Liên Quân Mobile.

### Tóm Tắt Theo Epic (E1 – E7)

#### E1 – Rà soát 8 route và sửa P0 (Frontend Mock & Baseline)
- **Rà soát chất lượng giao diện:** Audit toàn diện 8 route chính trên 4 khổ màn hình tiêu chuẩn (375px, 768px, 1280px, 1440px) theo quy chuẩn thiết kế `AGENTS.md` và `UI_UX_CHECKLIST.md`.
- **Khắc phục lỗi P0:** Sửa lỗi lệch số lượng thành viên hiển thị ở các phòng mẫu (AOV-1025 và AOV-1027).
- **Khắc phục lỗi P1:** Tinh chỉnh 3 điểm lỗi hiển thị CSS ở khổ màn hình nhỏ 375px (chống vỡ khung, chống tràn lề).
- **Bộ ảnh chụp đối chiếu (Baseline):** Lưu trữ bộ ảnh chuẩn 32/32 trạng thái màn hình làm căn cứ nghiệm thu hồi quy thị giác, bảo đảm 100% không phát sinh cuộn ngang cấp trang (`scrollWidth <= innerWidth`), mỗi màn hình tối đa 1 nút vàng đặc chính và không có tiêu đề/tab bị cắt cụt (`…`).

#### E2 – Nền tảng Backend và Hợp đồng API
- **Hợp đồng dữ liệu chung (`@customaov/contracts`):** Xây dựng bộ schema xác thực bằng Zod và định nghĩa kiểu TypeScript dùng chung giữa Frontend và Backend, bao phủ toàn bộ API endpoint và sự kiện WebSocket (86 bài kiểm thử đơn vị).
- **Đặc tả API (`docs/product/API.md`):** Thiết kế chi tiết các RESTful endpoint, mã lỗi chuẩn hóa, sự kiện WebSocket thời gian thực, và các bổ sung bảo mật quan trọng (Mục 9: bảo vệ phòng riêng tư, CSRF HMAC gắn phiên, rate limit theo IP+username, transaction khóa `FOR UPDATE`, xử lý suất bye/TBD trong nhánh).
- **Khung máy chủ backend (`base-backend-api`):** Khởi tạo ứng dụng Fastify 5 trên Node.js 22, hệ thống đọc cấu hình biến môi trường an toàn, logger tự động ẩn (redact) dữ liệu nhạy cảm (mật khẩu, token, cookie), endpoint kiểm tra sức khỏe `/health`.
- **Tầng cơ sở dữ liệu & Migration:** Tích hợp Drizzle ORM, cơ chế quản lý migration tự động trong `database/migrations/`, hỗ trợ cơ sở dữ liệu nhúng PGlite (chạy in-process phục vụ dev/test) và PostgreSQL qua Docker Compose.
- **Nạp dữ liệu mẫu (Seed):** Khởi tạo dữ liệu seed tương thích hoàn toàn với mock frontend (8 giải đấu, 5 phòng custom, tài khoản mẫu `suthy`, lịch sử hoạt động).
- **Công cụ monorepo:** Đồng bộ hóa các lệnh thực thi ở thư mục gốc (`build`, `lint`, `test`, `dev:api`, `dev:web`) qua npm workspaces.
- **Quy chuẩn lập trình:** Viết lại `base-backend-api/AGENTS.md` và `.agent/rules` theo đúng stack Fastify 5 + Drizzle + TypeScript.

#### E3 – Quản lý Tài khoản và Hồ sơ người chơi
- **Xác thực bảo mật (Auth API):** Đăng ký tài khoản, đăng nhập, đăng xuất và lấy thông tin phiên người dùng (`/api/auth/me`).
- **Bảo mật mật khẩu & phiên làm việc:** Băm mật khẩu bằng thuật toán scrypt qua thư viện chuẩn Node.js `node:crypto`, quản lý phiên qua bảng `sessions` trong CSDL và cookie bảo mật `httpOnly` (`SameSite=Lax`).
- **Phòng chống tấn công:** Cơ chế chống CSRF hai lớp (Double-submit Cookie HMAC gắn định danh phiên) và giới hạn tần suất gửi yêu cầu (Rate limiting) theo IP và IP+username.
- **Tầng dữ liệu Frontend linh hoạt:** Xây dựng module `src/api/` hỗ trợ 2 adapter song song (`mock` và `api`), chuyển đổi tức thì thông qua biến môi trường `VITE_DATA_SOURCE`.
- **Tích hợp giao diện Auth:** Kết nối `LoginModal` và router guard `RequireAuth` với API xác thực thật, đồng thời duy trì chế độ "Tài khoản mẫu" khi chạy ở môi trường mock.
- **Hồ sơ người chơi (Profile API & UI):** Xem hồ sơ cá nhân (`/profile`) và hồ sơ người chơi khác (`/profile/:userId`), hiển thị chỉ số trận custom đã đấu, tỉ lệ thắng/thua, danh hiệu giải đấu; hộp thoại `EditProfileDialog` cho phép cập nhật tên hiển thị, tiểu sử và ảnh đại diện.

#### E4 – Phòng Custom 5v5 & Realtime Hub
- **Quản lý phòng custom:** API danh sách phòng có phân trang, tìm kiếm không dấu, bộ lọc chế độ; wizard tạo phòng 4 bước (`/rooms/new`); cơ chế bảo vệ phòng riêng tư bằng mã mời `key` (ẩn thông tin nhạy cảm đối với người chưa tham gia).
- **Chia đội tự động tại máy chủ:** Tích hợp thuật toán từ package `@customaov/team-core` (`splitTeams5v5`) với hai chế độ chia ngẫu nhiên (`random`) và cân bằng theo chỉ số xếp hạng (`tier`).
- **Quyền hạn chủ phòng (Host Controls):** Thao tác chuyển đổi vị trí người chơi giữa 2 đội hoặc chuyển thành khán giả (`moveMember`), mời thành viên ra khỏi phòng (`removeMember`), chia lại đội, phân ngẫu nhiên vị trí đi đường (`random lane`).
- **Kênh truyền thông thời gian thực (WebSocket Hub):** Khởi tạo endpoint WebSocket `/api/ws` kết nối theo từng phòng, phát sóng tức thì các sự kiện cập nhật thành viên, trạng thái sẵn sàng, tin nhắn trò chuyện và thông báo mời ra khỏi phòng; hỗ trợ tự động kết nối lại khi gián đoạn mạng.
- **Xuất kết quả chia đội:** Tạo chuỗi văn bản định dạng chuẩn (`formatTeamsText`) sao chép nhanh vào clipboard để gửi sang Zalo hoặc Discord.
- **Ghi nhận kết quả trận đấu:** Chủ phòng nhập kết quả chung cuộc (Team Xanh thắng / Team Đỏ thắng) -> kết thúc phòng, tự động cập nhật lịch sử trận, cộng dồn tỉ số thắng/thua vào hồ sơ cá nhân và phát sinh sự kiện hoạt động.
- **Kiểm thử E2E phòng custom:** Kịch bản tự động hóa 10 tài khoản tham gia phòng, chia đội, trò chuyện realtime và ghi nhận kết quả (`scripts/e2e-rooms-api.mjs`).

#### E5 – Giải Đấu Cộng Đồng & Bảng Đấu Loại Trực Tiếp
- **Chuyển giao logic giải đấu sang máy chủ:** Chuyển toàn bộ các hàm suy diễn dữ liệu (nhánh đấu, xếp hạng, lịch thi đấu, xác định đội vô địch) sang backend kèm kiểm thử tính nhất quán.
- **Wizard tạo giải đấu 4 bước (`/tournaments/new`):** Cho phép người dùng tạo giải đấu mới với các tùy chọn quy mô (4, 8 hoặc 16 đội), thể thức (BO1, BO3, BO5), thời gian nhận đăng ký, thời gian thi đấu và cơ cấu giải thưởng.
- **Quy trình đăng ký đội thi đấu (`RegisterTeamDialog`):** Đội trưởng đăng ký đội với 5 thành viên chính và tối đa 2 dự bị; kiểm tra tính hợp lệ của tài khoản thành viên; thanh tiến độ đăng ký `RegistrationProgress` cập nhật thời gian thực.
- **Bảng điều khiển Ban tổ chức (`OrganizerPanel` & `RegistrationsPanel`):** Cho phép người tạo giải duyệt hoặc từ chối các đơn đăng ký tham gia, đóng đăng ký khi đủ số lượng đội hoặc hết hạn.
- **Động cơ bảng đấu loại trực tiếp (Single-elimination Bracket Engine):** Thuật toán bốc thăm ngẫu nhiên, tự động xử lý các suất miễn đấu (Bye / TBD) khi số đội lẻ, cho phép bốc thăm lại khi chưa có trận nào có tỉ số.
- **Quản lý trận đấu và kết quả giải:** Ban tổ chức xếp lịch ngày giờ thi đấu cho từng trận; hộp thoại nhập tỉ số trận đấu (`ScoreDialog`); tự động đưa đội chiến thắng vào vòng đấu tiếp theo; tự động chuyển trạng thái giải đấu `open → live → finished` và tôn vinh đội Vô địch khi trận Chung kết hoàn tất.
- **Kiểm thử E2E giải đấu:** Kịch bản tự động hóa giải đấu 8 đội thể thức BO3 trọn vẹn từ bước tạo giải, đăng ký, duyệt đội, bốc thăm nhánh tới trận chung kết (`scripts/e2e-tournament-api.mjs`).

#### E6 – Dashboard Tổng Hợp, Tìm Kiếm & Dòng Hoạt Động
- **Hệ thống nhật ký hoạt động (`activities`):** Tự động ghi nhận và lưu trữ các sự kiện quan trọng (vào phòng, đăng ký giải đấu, kết quả trận custom, giành cúp vô địch giải).
- **Dòng hoạt động đầy đủ (`/activities`):** Trang lịch sử hoạt động chi tiết, hỗ trợ phân trang theo tham số URL.
- **Hộp tìm kiếm toàn cục (`SearchDialog`):** Mở nhanh bằng phím tắt `Ctrl + K` (hoặc `Cmd + K`), hỗ trợ tìm kiếm không dấu các phòng custom, giải đấu và người chơi với cơ chế debounce 250ms và điều hướng bằng bàn phím.
- **Tích hợp Dashboard (`HomeUser`):** Hiển thị thẻ quảng bá giải đấu nổi bật đang mở đăng ký (Promo Card), danh sách các phòng người dùng tham gia ("Phòng của bạn"), bảng danh sách phòng công khai và 5 hoạt động gần nhất.

#### E7 – Hoàn Thiện MVP, Kiểm Định & Tài Liệu Hóa
- **Audit toàn diện MVP (E7-T01):** Khảo sát độc lập trên cả môi trường Mock và API, kiểm tra bảo mật backend, tính nhất quán dữ liệu giữa các màn hình, quy tắc thiết kế giao diện trên 4 khổ hiển thị và toàn bộ các luồng E2E.
- **Khắc phục và hoàn thiện (E7-T02):** Xử lý các phát hiện từ quá trình audit, củng cố tính ổn định của hệ thống.
- **Kiểm thử môi trường triển khai (E7-T03):** Xác thực bộ kiểm thử backend chạy trên CSDL PostgreSQL chuẩn hóa qua Docker; thiết lập quy trình khởi chạy toàn bộ ứng dụng chỉ bằng một câu lệnh duy nhất; hoàn thiện tài liệu `README.md`.
- **Tài liệu sản phẩm (E7-T04):** Xây dựng tài liệu Hướng dẫn sử dụng chi tiết có mục lục (`docs/product/HDSD.md`) và Nhật ký phát hành (`CHANGELOG.md`).
- **Nghiệm thu hồi quy cuối cùng (E7-T05):** Chạy kiểm thử e2e và chụp ảnh toàn bộ 8 route trên 4 khổ màn hình ở cả 2 chế độ, nghiệm thu đạt 100% các tiêu chí hoàn thành MVP đã cam kết trong PRD mục 8.

---

## Ngoài Phạm Vi MVP

Căn cứ theo mục 4 của PRD, các tính năng sau đây **nằm ngoài phạm vi của phiên bản MVP** và được bảo lưu cho các giai đoạn phát triển tiếp theo:

1. **Phương thức xác thực mở rộng:**
   - Đăng nhập thông qua tài khoản bên thứ ba (Google, Facebook, Discord, Garena OAuth).
   - Quy trình khôi phục mật khẩu thông qua thư điện tử (Email reset password).
2. **Dữ liệu trực tiếp từ game Liên Quân Mobile:**
   - Kết nối trực tiếp API máy chủ game để lấy danh sách tướng sở hữu, thông số KDA, bậc rank thực tế, trang bị, danh hiệu MVP.
   - Tính năng bốc tướng ngẫu nhiên và hộp bí ẩn theo tài sản trong game.
   - Chế độ trình chiếu toàn màn hình (fullscreen presentation mode) cho giải đấu offline.
3. **Chế độ chơi và chia đội nâng cao:**
   - Thuật toán chia đội cân bằng theo bậc rank ingame (MVP sử dụng chỉ số điểm Tier tự khai báo).
   - Hỗ trợ thể thức thi đấu 3v3 và 1v1 (giao diện hiện có nhãn "Sắp có", hệ thống tập trung hoàn thiện chuẩn 5v5).
4. **Thể thức giải đấu phức tạp:**
   - Thể thức thi đấu vòng bảng (Group Stage).
   - Thể thức nhánh thắng – nhánh thua (Double Elimination).
   - Tính năng tự động phân bổ lịch thi đấu thông minh theo khung giờ đăng ký của các đội.
5. **Tính năng mạng xã hội và thông báo:**
   - Hệ thống thông báo đẩy trong ứng dụng (biểu tượng chuông trên TopNav).
   - Bảng xếp hạng toàn máy chủ (BXH).
   - Trang cộng đồng và thảo luận chung (các mục này được gắn nhãn "Sắp có").
6. **Nền tảng ứng dụng và hạ tầng triển khai:**
   - Ứng dụng di động chuyên biệt (Native App trên Android và iOS).
   - Triển khai hạ tầng máy chủ trả phí trên đám mây (Cloud hosting, VPC, CDN).
   - Tên miền tùy chỉnh và hệ thống gửi email giao dịch tự động.
   - *Quy ước MVP:* Ứng dụng được thiết kế và kiểm thử để vận hành độc lập, trọn vẹn trên môi trường máy cục bộ (Local environment) chỉ với một câu lệnh khởi chạy.
7. **Cổng quản trị và kiểm duyệt:**
   - Phân quyền Quản trị viên hệ thống (Admin Portal / Dashboard).
   - Hệ thống tự động lọc và kiểm duyệt từ ngữ tin nhắn chat nâng cao (MVP áp dụng cơ chế giới hạn độ dài ký tự và tần suất gửi tin).
