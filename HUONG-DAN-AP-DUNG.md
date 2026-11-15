# 📘 Hướng Dẫn Áp Dụng Base-Workspace vào Dự Án

> **Base-workspace** là bộ template cấu hình AI Agent cho phát triển phần mềm.
> Khi áp dụng vào dự án thực tế, AI Agent sẽ đọc source code và tự cập nhật các file cấu hình.

---

## 📋 Mục Lục

1. [Tổng quan](#1-tổng-quan)
2. [Yêu cầu hệ thống](#2-yêu-cầu-hệ-thống)
3. [Các bước áp dụng](#3-các-bước-áp-dụng)
4. [Hướng dẫn SymbolicLink](#4-hướng-dẫn-symboliclink)
5. [Cài đặt & Sử dụng OpenSpec](#5-cài-đặt--sử-dụng-openspec)
6. [github/spec-kit — Spec-Driven Development Toolkit](#6-githubspec-kit--spec-driven-development-toolkit)
7. [obra/Superpowers — Development Methodology](#7-obrasuperpowers--development-methodology)
8. [Kết hợp 3 công cụ](#8-kết-hợp-3-công-cụ)
9. [Cấu trúc sau khi áp dụng](#9-cấu-trúc-sau-khi-áp-dụng)
10. [FAQ](#10-faq)

---

## 1. Tổng Quan

### Base-workspace là gì?

Bộ template bao gồm:
- **`.agent/rules/`** — Coding rules cho AI Agent (conventions, patterns, security...)
- **`.agent/workflows/`** — Slash commands tự động hóa (generate CRUD, add endpoint...)
- **`AGENTS.md`** — File context tổng quan project cho AI Agent
- **`docs/`** — Template thư mục tài liệu (đặc tả, design API, nghiệp vụ, tích hợp)
- **`database/`** — Template database schema và migration scripts
- **`handoff.md`** — Protocol trao đổi giữa Backend Agent và Frontend Agent

### Dành cho ai?

- Team phát triển sử dụng AI coding assistants (Gemini, GitHub Copilot, Cursor, Claude...)
- Dự án có cả Backend và Frontend (multi-repo hoặc monorepo)
- Cần chuẩn hóa cách AI Agent làm việc với codebase

### Nguyên tắc hoạt động

```
┌─────────────────────────────────────────────────────┐
│  1. Copy base-workspace vào dự án                    │
│  2. AI Agent đọc source code                         │
│  3. AI Agent tự generate AGENTS.md + cập nhật rules  │
│  4. Từ đó AI Agent viết code theo đúng conventions   │
└─────────────────────────────────────────────────────┘
```

### Bốn lớp hướng dẫn AI — hiểu đúng để dùng đúng

Base-workspace có 4 thứ hướng dẫn AI, mỗi thứ có vai trò riêng:

```
              ┌──────────────────────────────────────────────────┐
              │  obra/Superpowers  (nếu IDE hỗ trợ)             │
              │  Development methodology — SOP đầy đủ cho AI    │
              │  brainstorm → plan → TDD → review → done         │
              ├─────────────────────┬────────────────────────────┤
              │   .agent/rules/     │   .agent/workflows/        │
              │   Coding rules      │   Slash commands           │
              │   (luôn chạy nền)   │   (mày gọi)               │
              ├─────────────────────┴────────────────────────────┤
              │   OpenSpec                                        │
              │   Planning layer — propose → apply → archive     │
              └──────────────────────────────────────────────────┘
```

| Thứ | Vai trò tóm gọn |
|---|---|
| **OpenSpec** | 📦 Lưu trữ specs dài hạn theo Module → Feature → Version |
| **github/spec-kit** | 🗺️ Lên kế hoạch chất lượng cao — constitution → specify → clarify → plan → tasks |
| **obra/Superpowers** | ⚙️ Thực thi có kỷ luật — TDD + review gate + subagent tự động |
| **Rules** | AI biết *viết code thế nào* — convention, patterns, naming |
| **Workflows** | AI biết *làm task cụ thể* — khi gọi slash command |

---

## 2. Yêu Cầu Hệ Thống

| Yêu cầu | Version |
|----------|---------|
| **Node.js** | ≥ 20.19.0 (cần cho OpenSpec) |
| **npm** | ≥ 10 |
| **Git** | ≥ 2.x |
| **OS** | Windows 10+, macOS, Linux |
| **AI Tool** | Gemini Code Assist, GitHub Copilot, Cursor, Claude, hoặc bất kỳ AI assistant hỗ trợ `.agent/` |

---

## 3. Các Bước Áp Dụng

### Bước 1: Copy base-workspace

Copy toàn bộ thư mục base-workspace vào root của dự án:

```
your-project/
├── your-backend/         ← Repo backend hiện có
├── your-frontend/        ← Repo frontend hiện có
├── docs/                 ← Copy từ base-workspace
├── database/             ← Copy từ base-workspace
└── your-project.code-workspace
```

### Bước 2: Copy `.agent/` và `AGENTS.md` vào từng project

```bash
# Backend
cp -r base-workspace/base-backend-api/.agent/  your-backend/.agent/
cp base-workspace/base-backend-api/AGENTS.md   your-backend/AGENTS.md

# Frontend
cp -r base-workspace/base-frontend-web/.agent/ your-frontend/.agent/
cp base-workspace/base-frontend-web/AGENTS.md  your-frontend/AGENTS.md
```

**Windows PowerShell:**
```powershell
# Backend
Copy-Item -Recurse "base-workspace\base-backend-api\.agent" "your-backend\.agent"
Copy-Item "base-workspace\base-backend-api\AGENTS.md" "your-backend\AGENTS.md"

# Frontend
Copy-Item -Recurse "base-workspace\base-frontend-web\.agent" "your-frontend\.agent"
Copy-Item "base-workspace\base-frontend-web\AGENTS.md" "your-frontend\AGENTS.md"
```

### Bước 3: Cập nhật file `.code-workspace`

Sửa `base.code-workspace` thành tên dự án và đường dẫn thực tế:

```json
{
    "folders": [
        { "path": "your-frontend" },
        { "path": "your-backend" },
        { "path": "docs" },
        { "path": "database" }
    ],
    "settings": {}
}
```

### Bước 4: Yêu cầu AI Agent generate `AGENTS.md`

Mở project trong IDE → Mở AI Chat → Gửi prompt:

```
Đọc toàn bộ source code của project này và tạo file AGENTS.md 
theo hướng dẫn trong file AGENTS.md hiện tại. 
Quét pom.xml/package.json, cấu trúc thư mục, coding patterns, 
database config để viết đầy đủ các sections.
```

### Bước 5: Yêu cầu AI Agent cập nhật rules

Gửi prompt cho AI Agent:

```
Đọc source code và cập nhật các file `.agent/rules/` 
đang có trạng thái "CHƯA CẤU HÌNH". 
Với mỗi file, đọc hướng dẫn trong file đó và viết nội dung 
dựa trên tech stack và patterns thực tế của dự án.
```

### Bước 6: Đưa database schema vào

```bash
# Thay thế các file demo bằng schema thực tế
cp your-ddl-scripts/schema.sql database/Schema_YourDB.sql
```

### Bước 7: Đưa tài liệu nghiệp vụ vào

Đặt tài liệu vào đúng thư mục:
- Đặc tả chi tiết → `docs/dac-ta/`
- Thiết kế API → `docs/design-api/`
- Quy trình nghiệp vụ → `docs/nghiep-vu/`
- Tài liệu tích hợp → `docs/tich-hop/`

### Bước 8: Xóa files OpenSpec (nếu cài OpenSpec sau)

Nếu bạn sẽ cài OpenSpec (xem mục 5), hãy xóa các files `.agent/workflows/opsx-*` và `.agent/skills/openspec-*` vì `openspec init` sẽ tự tạo lại:

```powershell
# Backend
Remove-Item "your-backend\.agent\workflows\opsx-*" -Force
Remove-Item "your-backend\.agent\skills\openspec-*" -Recurse -Force

# Frontend
Remove-Item "your-frontend\.agent\workflows\opsx-*" -Force
Remove-Item "your-frontend\.agent\skills\openspec-*" -Recurse -Force
```

---

## 4. Hướng Dẫn SymbolicLink

### Tại sao cần SymbolicLink?

Trong workspace multi-project, các thư mục **`docs/`** và **`database/`** nằm ở root level, nhưng mỗi project (backend, frontend) cũng cần truy cập chúng. SymbolicLink cho phép:

- **Backend Agent** và **Frontend Agent** cùng đọc/ghi `docs/handoff.md` để trao đổi với nhau
- AI Agent trong mỗi project có thể truy cập database schema và tài liệu nghiệp vụ
- Không cần copy/duplicate files

### Cấu trúc mong muốn

```
your-workspace/
├── docs/                    ← Thư mục thật (shared)
│   ├── handoff.md           ← BE Agent ↔ FE Agent trao đổi qua file này
│   ├── dac-ta/
│   └── ...
├── database/                ← Thư mục thật (shared)
│   ├── Schema_XXX.sql
│   └── ...
├── your-backend/
│   ├── .agent/
│   ├── AGENTS.md
│   ├── docs → ../../docs    ← SymbolicLink
│   └── database → ../../database  ← SymbolicLink
└── your-frontend/
    ├── .agent/
    ├── AGENTS.md
    ├── docs → ../../docs    ← SymbolicLink
    └── database → ../../database  ← SymbolicLink
```

### Tạo SymbolicLink

#### Windows (PowerShell — **Run as Administrator**):

```powershell
# Tạo symlink docs vào backend
New-Item -ItemType SymbolicLink -Path "your-backend\docs" -Target "$(Resolve-Path docs)"

# Tạo symlink docs vào frontend
New-Item -ItemType SymbolicLink -Path "your-frontend\docs" -Target "$(Resolve-Path docs)"

# Tạo symlink database vào backend
New-Item -ItemType SymbolicLink -Path "your-backend\database" -Target "$(Resolve-Path database)"

# Tạo symlink database vào frontend
New-Item -ItemType SymbolicLink -Path "your-frontend\database" -Target "$(Resolve-Path database)"
```

> ⚠️ **Windows yêu cầu quyền Administrator** để tạo SymbolicLink.
> Hoặc bật **Developer Mode** trong Settings → Update & Security → For developers.

#### macOS / Linux:

```bash
# Từ thư mục workspace root
ln -s ../../docs your-backend/docs
ln -s ../../docs your-frontend/docs
ln -s ../../database your-backend/database
ln -s ../../database your-frontend/database
```

### Cấu hình Git (quan trọng!)

Thêm vào `.gitignore` của mỗi project để không commit symlink:

```gitignore
# Symlinks to shared folders
docs
database
```

Hoặc nếu muốn track symlink trong git:
```bash
git config core.symlinks true
```

### Handoff Protocol (BE ↔ FE Agent)

File `docs/handoff.md` là kênh giao tiếp giữa Backend Agent và Frontend Agent:

```markdown
### [2025-01-15] BE→FE: API upload đổi sang multipart
- **Trạng thái:** 🔴 Chờ xử lý
- **Mô tả:** API upload file đã migration từ Base64 sang multipart/form-data
- **API liên quan:** POST /api/file/upload
- **Request format:** FormData (metadata JSON + binary files)
- **Mong muốn:** FE cập nhật service gọi API dùng FormData
```

Mỗi khi một Agent thay đổi API contract, nó ghi entry vào `handoff.md`. Agent bên kia đọc và xử lý.

---

## 5. Cài Đặt & Sử Dụng OpenSpec

### OpenSpec là gì?

[OpenSpec](https://github.com/Fission-AI/OpenSpec) là công cụ **Spec-Driven Development (SDD)** — thay vì để AI code ngay, bạn bắt nó *lên kế hoạch trước*: tạo proposal, design, specs, và danh sách tasks. Sau khi review và approve, AI mới implement theo đúng những gì đã được thống nhất.

> **Lưu ý kiến trúc quan trọng:** OpenSpec được cài và khởi tạo **riêng cho từng project** (backend có `openspec/` riêng, frontend có `openspec/` riêng). Để specs của BE và FE cùng một feature vẫn liên kết được với nhau, cần tuân theo **convention đặt tên thống nhất** (xem mục cấu trúc lưu trữ bên dưới).

---

### Cài đặt

```bash
# Cài đặt global (yêu cầu Node.js ≥ 20.19.0)
npm install -g @fission-ai/openspec@latest

# Kiểm tra version
openspec --version
```

### Khởi tạo trong project

```bash
# Backend
cd your-backend
openspec init

# Frontend
cd your-frontend
openspec init
```

Lệnh `openspec init` sẽ tự tạo:
- `openspec/config.yaml` — Cấu hình project
- `openspec/specs/` — Thư mục lưu trữ specifications đã hoàn thành
- `openspec/changes/` — Thư mục chứa các changes đang active
- `.agent/workflows/opsx-*.md` — Slash commands cho AI Agent
- `.agent/skills/openspec-*/` — Skills cho AI Agent

### Chọn profile (optional)

```bash
openspec config profile
```

Chọn profile phù hợp: `basic` (đơn giản) hoặc `expanded` (đầy đủ hơn cho dự án lớn).

### Cập nhật OpenSpec

```bash
npm install -g @fission-ai/openspec@latest

cd your-project
openspec update   # Refresh agent instructions trong project
```

---

### Workflow chi tiết: propose → apply → archive

```
┌──────────────────────────────────────────────────────────┐
│  1. /opsx:propose "tên feature"                          │
│     → AI tạo proposal, design, be-spec, fe-spec, tasks   │
│                                                          │
│  2. Review proposal — sửa nếu AI hiểu sai nghiệp vụ     │
│                                                          │
│  3. /opsx:apply                                          │
│     → AI implement từng task theo thứ tự, tick ✅ khi xong│
│                                                          │
│  4. /opsx:archive                                        │
│     → Move vào specs/, dọn changes/                     │
└──────────────────────────────────────────────────────────┘
```

**Bước 1 — Propose:**

Gọi lệnh với mô tả ngắn gọn về feature cần làm:
```
/opsx:propose "Thêm chức năng export báo cáo ra Excel theo khoảng thời gian"
```
AI sẽ tạo thư mục trong `openspec/changes/` với các files: `proposal.md`, `design.md`, `be-spec.md`, `fe-spec.md`, `tasks.md`.

**Bước 2 — Review:**

Đây là bước quan trọng nhất. Cần kiểm tra:
- `proposal.md` — AI có hiểu đúng scope và nghiệp vụ không?
- `design.md` — API design, data flow, DB impact có hợp lý không?
- `tasks.md` — Thứ tự tasks có đúng dependency không?

Sửa trực tiếp vào các file nếu AI hiểu sai. Chỉ approve khi chắc chắn AI sẽ implement đúng.

**Bước 3 — Apply:**

```
/opsx:apply
```
AI đọc `tasks.md` và implement từng task. Mỗi task hoàn thành được đánh dấu ✅. Nếu bị gián đoạn, gọi lại `/opsx:apply` — AI tiếp tục từ task chưa xong.

**Bước 4 — Archive:**

```
/opsx:archive --target specs/[module]/[feature]/[version]/
```
Chỉ rõ đường dẫn để AI archive đúng vị trí (xem cấu trúc lưu trữ bên dưới).

---

### Cấu trúc lưu trữ specs

Vì BE và FE có `openspec/` riêng biệt, cần dùng **cấu trúc thư mục và tên feature thống nhất** giữa 2 project để dễ tra cứu và liên kết.

**Nguyên tắc:** Gom theo **Module → Feature → Version**

```
openspec/
├── changes/                        ← Đang làm (flat, không phân cấp)
│   └── export-baocao-excel/        ← Tên feature — dùng GIỐNG NHAU ở cả BE và FE
│       ├── proposal.md
│       ├── design.md
│       ├── be-spec.md              ← Spec phía backend
│       ├── fe-spec.md              ← Spec phía frontend
│       └── tasks.md
│
└── specs/                          ← Archive dài hạn (phân cấp đầy đủ)
    ├── [module]/                   ← Nhóm theo module nghiệp vụ
    │   └── [feature]/              ← Tên feature cụ thể
    │       ├── CHANGELOG.md        ← Tóm tắt lịch sử các version
    │       ├── v1-[mo-ta-ngan]/    ← Version 1
    │       │   ├── proposal.md
    │       │   ├── design.md
    │       │   ├── be-spec.md
    │       │   ├── fe-spec.md
    │       │   └── tasks.md        ← Tất cả tasks đã ✅
    │       └── v2-[mo-ta-ngan]/    ← Version 2 (thêm/thay đổi sau này)
    │           └── ...
    └── infrastructure/             ← Thay đổi cross-cutting (không thuộc module nghiệp vụ)
        └── ...
```

**Quy tắc đặt tên module:** Dùng tên tiếng Việt không dấu, khớp với cấu trúc menu/route của dự án. Ví dụ: `danhmuc/`, `dongbodulieu/`, `baocao/`, `quantrihethong/`.

**Quy tắc đặt tên version:** Dùng `v[số]-[mô-tả-ngắn]` thay vì số thuần — ví dụ `v1-crud-co-ban`, `v2-them-phan-quyen`. Mục đích: đọc tên thư mục là hiểu ngay lần đó làm gì, không cần mở file.

**Quy tắc tên feature trong `changes/`:** Tên thư mục phải **giống hệt nhau** ở cả BE và FE repo. Đây là "key" để liên kết 2 bên khi không có thư mục shared.

**File `CHANGELOG.md` ở feature level:**
```markdown
# [tên-feature] — Changelog

## v2 — Thêm filter theo đơn vị (2025-09)
- BE: Thêm check ORGID từ JWT
- FE: Dropdown chọn đơn vị trên form filter

## v1 — Chức năng cơ bản (2025-07)
- BE: Endpoint mới, query và template
- FE: Nút trigger, xử lý response
```
File này nằm ở `specs/[module]/[feature]/CHANGELOG.md` — không nằm trong folder version nào. AI đọc file này sẽ hiểu ngay lịch sử mà không cần mở từng version.

---

### Tham khảo thêm

- 📖 [OpenSpec Documentation](https://github.com/Fission-AI/OpenSpec/blob/main/docs/getting-started.md)
- 📖 [Hướng dẫn sử dụng chi tiết](docs/hdsd/OpenSpec-Huong-Dan-Su-Dung.md)

---

## 6. github/spec-kit — Spec-Driven Development Toolkit

### spec-kit là gì?

[github/spec-kit](https://github.com/github/spec-kit) là một **Spec-Driven Development (SDD) toolkit** do GitHub phát triển — thay vì để AI viết code từ prompt, bạn mô tả *what* và *why* trước, rồi toolkit dẫn qua từng bước có kiểm soát từ principles đến implementation.

**Vai trò trong bộ 3 công cụ:** spec-kit chuyên về **lên kế hoạch chất lượng cao** — bước clarify giúp làm rõ requirements trước khi plan, constitution đảm bảo mọi quyết định kỹ thuật nhất quán với nguyên tắc dự án. Kết quả là tasks.md đủ rõ để AI implement đúng ngay từ đầu.

---

### Workflow tổng thể

```
┌────────────────────────────────────────────────────────┐
│  /speckit.constitution                                 │
│  Thiết lập nguyên tắc dự án — làm nền cho mọi quyết định│
└──────────────────────┬─────────────────────────────────┘
                       │ 1 lần cho toàn project
┌──────────────────────▼─────────────────────────────────┐
│  /speckit.specify "mô tả feature"                      │
│  Tập trung vào WHAT và WHY — không nói tech stack      │
└──────────────────────┬─────────────────────────────────┘
                       │
┌──────────────────────▼─────────────────────────────────┐
│  /speckit.clarify  (khuyến nghị)                       │
│  Làm rõ requirements trước khi plan → giảm rework      │
└──────────────────────┬─────────────────────────────────┘
                       │
┌──────────────────────▼─────────────────────────────────┐
│  /speckit.plan "tech stack và architecture"            │
│  Mới đến tech stack — AI tạo implementation plan       │
└──────────────────────┬─────────────────────────────────┘
                       │
┌──────────────────────▼─────────────────────────────────┐
│  /speckit.tasks                                        │
│  Chia plan thành tasks có dependency + parallel markers│
└──────────────────────┬─────────────────────────────────┘
                       │
┌──────────────────────▼─────────────────────────────────┐
│  /speckit.implement                                    │
│  Thực thi tasks theo thứ tự, validate từng bước        │
└────────────────────────────────────────────────────────┘
```

**Điểm đặc biệt — Constitution:**

Bước đầu tiên `/speckit.constitution` tạo file `.specify/memory/constitution.md` chứa governing principles cho toàn project — code quality standards, testing requirements, architecture decisions. File này được AI tham chiếu trong **mọi bước** về sau, đảm bảo tính nhất quán. Đây là thứ OpenSpec và Superpowers không có.

---

### IDE support

| IDE / Tool | Flag | Ghi chú |
|---|---|---|
| **Claude Code** | `--ai claude` | Native support |
| **GitHub Copilot** | `--ai copilot` | Native support |
| **Cursor** | `--ai cursor-agent` | Native support |
| **Gemini CLI** | `--ai gemini` | Native support |
| **Windsurf** | `--ai windsurf` | Native support |
| **Antigravity** | `--ai agy --ai-skills` | Cần flag `--ai-skills` |
| **Codex CLI** | `--ai codex --ai-skills` | Cần flag `--ai-skills` |
| **Roo Code** | `--ai roo` | Native support |
| **Kilo Code** | `--ai kilocode` | Native support |
| **opencode** | `--ai opencode` | Native support |
| **Generic** | `--ai generic --ai-commands-dir <path>` | Bring your own agent |

---

### Cài đặt

**Yêu cầu:** Python 3.11+, `uv`, Git

```bash
# Cài đặt specify CLI (persistent — khuyến nghị)
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git@vX.Y.Z
# Thay vX.Y.Z bằng latest tag tại: https://github.com/github/spec-kit/releases

# Kiểm tra tools
specify check
```

### Khởi tạo project

```bash
# Tạo project mới
specify init your-project --ai claude

# Hoặc init trong project hiện có
cd your-backend
specify init . --ai claude
# hoặc
specify init --here --ai claude

# Với Antigravity
specify init . --ai agy --ai-skills

# Windows (PowerShell scripts)
specify init . --ai copilot --script ps
```

Sau khi init, AI agent sẽ có sẵn các slash commands: `/speckit.constitution`, `/speckit.specify`, `/speckit.clarify`, `/speckit.plan`, `/speckit.tasks`, `/speckit.implement`.

### Cập nhật spec-kit

```bash
uv tool install specify-cli --force --from git+https://github.com/github/spec-kit.git@vX.Y.Z
```

---

### Cấu trúc thư mục sau khi init

```
your-project/
└── .specify/
    ├── memory/
    │   └── constitution.md      ← Project principles (tạo bằng /speckit.constitution)
    ├── specs/
    │   └── 001-feature-name/    ← Mỗi feature 1 thư mục (numbered)
    │       ├── spec.md          ← Requirements & user stories
    │       ├── plan.md          ← Technical implementation plan
    │       ├── tasks.md         ← Task breakdown có dependencies
    │       ├── data-model.md    ← Data model (nếu có)
    │       └── contracts/       ← API specs, SignalR specs...
    ├── scripts/                 ← Helper scripts (auto-generated)
    └── templates/               ← Templates cho spec/plan/tasks
```

> **Lưu ý với multi-project (BE + FE):** Init spec-kit riêng cho từng project. Feature numbering (`001-`, `002-`...) nên **đồng bộ thủ công** giữa BE và FE để dễ liên kết — ví dụ cả BE và FE đều có `001-export-baocao/`.

---

### Extensions & Presets

spec-kit có hệ thống mở rộng cho phép customize sâu:

| | **Extensions** | **Presets** |
|---|---|---|
| Dùng khi | Cần thêm capabilities mới | Cần thay đổi cách workflow hoạt động |
| Ví dụ | Thêm Jira integration, V-Model test traceability | Đổi format spec, thêm compliance gates, localize ngôn ngữ |
| Lệnh | `specify extension add <name>` | `specify preset add <name>` |

---

### Tham khảo thêm

- 📖 [spec-kit Repository](https://github.com/github/spec-kit)
- 📖 [Spec-Driven Development Methodology](https://github.com/github/spec-kit/blob/main/spec-driven.md)

---

## 7. obra/Superpowers — Development Methodology

### Superpowers là gì?

[obra/Superpowers](https://github.com/obra/superpowers) là một **development methodology và skills framework** mã nguồn mở — không phải config file, không phải plugin đơn thuần. Nó dạy AI coding agent cách làm việc có hệ thống: thay vì nhảy vào code ngay, AI sẽ brainstorm → lên plan → implement có kiểm soát → review → done.

Superpowers xây dựng trên bộ **"skills"** — mỗi skill là một file `SKILL.md` mô tả quy trình làm việc cụ thể. AI tự nhận biết khi nào cần dùng skill nào và kích hoạt tự động, không cần gọi command.

**Vai trò trong bộ 3 công cụ:** Superpowers chuyên về **thực thi có kỷ luật** — enforce TDD (viết test trước rồi mới code), bắt buộc review gate giữa các tasks, và dùng subagent để làm song song. Đây là thứ spec-kit và OpenSpec không có.

---

### Bộ Skills có sẵn

| Skill | Kích hoạt khi | Làm gì |
|---|---|---|
| `brainstorming` | Trước khi viết code | Hỏi ngược lại để hiểu đúng yêu cầu, tạo design doc |
| `writing-plans` | Sau khi có design | Chia thành tasks 2–5 phút, rõ file path + verify step |
| `using-git-worktrees` | Sau approve design | Tạo branch mới, isolated workspace, verify test baseline |
| `subagent-driven-development` | Khi có plan | Dispatch subagent cho từng task, 2-stage review |
| `test-driven-development` | Trong lúc implement | Enforce RED→GREEN→REFACTOR, commit từng bước |
| `requesting-code-review` | Giữa các tasks | Review trước khi tiếp tục |
| `systematic-debugging` | Khi có bug | 4-phase root cause process |
| `verification-before-completion` | Trước khi báo done | Verify thật sự xong chưa |
| `finishing-a-development-branch` | Khi xong tất cả tasks | Kiểm tra tests, merge/PR/discard |

**Workflow tổng thể:**

```
Mày: "Tao muốn làm feature X"
              │
              ▼
  ┌─────────────────────┐
  │   brainstorming     │ ← AI hỏi: scope? edge cases? constraint?
  │   → design doc      │   Tạo design doc, mày review & approve
  └──────────┬──────────┘
             │
             ▼
  ┌─────────────────────┐
  │  using-git-worktrees│ ← Tạo branch, verify clean baseline
  └──────────┬──────────┘
             │
             ▼
  ┌─────────────────────┐
  │   writing-plans     │ ← Chia tasks 2-5 phút, mày approve
  └──────────┬──────────┘
             │
             ▼
  ┌─────────────────────┐
  │  subagent-driven-   │ ← Subagent làm từng task
  │  development        │   + test-driven-development
  │  + TDD              │   + requesting-code-review
  └──────────┬──────────┘
             │
             ▼
  ┌─────────────────────┐
  │  finishing-branch   │ ← Verify, merge/PR/discard
  └─────────────────────┘
```

---

### IDE nào hỗ trợ?

Superpowers cần IDE có cơ chế **skill discovery** — tức là IDE phải biết cách đọc `SKILL.md`, parse và tự kích hoạt đúng lúc. Không phải IDE nào cũng có.

| IDE / Tool | Hỗ trợ | Cách cài |
|---|---|---|
| **Claude Code** | ✅ Native | `/plugin install superpowers@claude-plugins-official` |
| **Cursor** | ✅ Native | `/add-plugin superpowers` trong Agent chat |
| **Gemini CLI** | ✅ Native | `gemini extensions install https://github.com/obra/superpowers` |
| **Codex (OpenAI)** | ✅ Manual | Clone repo → tạo symlink vào `~/.agents/skills/` |
| **OpenCode** | ✅ Manual | Nói với AI fetch và follow INSTALL.md |
| **Antigravity, Windsurf, Cline...** | ❌ Chưa support | Không có cơ chế skill discovery |

---

### Cài đặt chi tiết

#### Claude Code (1 lệnh)

```bash
/plugin install superpowers@claude-plugins-official
```

#### Cursor (1 lệnh)

Trong Agent chat của Cursor:
```
/add-plugin superpowers
```

#### Gemini CLI

```bash
gemini extensions install https://github.com/obra/superpowers

# Cập nhật sau này:
gemini extensions update superpowers
```

#### Codex — Manual setup

```bash
# Clone về máy
git clone https://github.com/obra/superpowers.git ~/.codex/superpowers

# Tạo symlink để Codex discover skills
mkdir -p ~/.agents/skills
ln -s ~/.codex/superpowers/skills ~/.agents/skills/superpowers

# Restart Codex
```

**Windows (PowerShell):**
```powershell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.agents\skills"
cmd /c mklink /J "$env:USERPROFILE\.agents\skills\superpowers" "$env:USERPROFILE\.codex\superpowers\skills"
```

#### Cập nhật Superpowers

```bash
# Claude Code / Cursor:
/plugin update superpowers

# Codex:
cd ~/.codex/superpowers && git pull
# (Skills update ngay qua symlink, không cần restart)
```

---

### IDE không support — làm gì thay thế?

Với các IDE chưa có skill discovery (Antigravity, Windsurf...), không thể cài Superpowers trực tiếp. Tuy nhiên có thể **áp dụng triết lý của Superpowers** thủ công thông qua `.agent/workflows/`:

Thay vì AI tự kích hoạt, mày tạo các workflow mô phỏng từng bước key của Superpowers:

```
.agent/workflows/
├── plan-feature.md        ← Mô phỏng brainstorming + writing-plans
│   "Trước khi code: hỏi ngược, tạo design, chia tasks"
├── implement-task.md      ← Mô phỏng TDD
│   "Viết test fail → code pass → refactor → commit"
├── review-before-next.md  ← Mô phỏng requesting-code-review
│   "Checklist trước khi sang task tiếp theo"
└── done-checklist.md      ← Mô phỏng verification + finishing
    "Verify tests, clean up, PR checklist"
```

Sự khác biệt: Superpowers thật tự động và có subagent coordination. Phiên bản workflow thủ công này mày phải tự gọi từng bước — nhưng vẫn tốt hơn không có gì.

---

### Superpowers vs OpenSpec — dùng cái nào?

```
Đang dùng IDE hỗ trợ Superpowers?
│
├─ CÓ → Dùng Superpowers làm nền tảng chính
│        OpenSpec vẫn dùng được song song để
│        lưu trữ specs theo module/feature/version
│
└─ KHÔNG → Dùng OpenSpec làm planning layer chính
            + tự build workflows mô phỏng Superpowers
            trong .agent/workflows/
```

Hai thứ không loại trừ nhau — Superpowers lo lifecycle, OpenSpec lo spec storage và traceability.

---

---

## 8. Kết Hợp 3 Công Cụ

### Mỗi công cụ làm một việc khác nhau

Ba công cụ không thay thế nhau — chúng bổ sung cho nhau, mỗi cái giỏi một việc riêng biệt:

```
┌─────────────────────────────────────────────────────────────────┐
│  📦 OpenSpec — LƯU TRỮ                                         │
│  "Sau khi làm xong, spec này thuộc module nào,                  │
│   feature nào, version nào?"                                    │
│                                                                 │
│  Giỏi: Archive dài hạn theo Module → Feature → Version         │
│  Yếu:  Không enforce cách implement                             │
├─────────────────────────────────────────────────────────────────┤
│  🗺️ github/spec-kit — LÊN KẾ HOẠCH                             │
│  "Trước khi code, cần làm gì? Constitution là gì,              │
│   requirements là gì, tasks theo thứ tự nào?"                   │
│                                                                 │
│  Giỏi: Planning chất lượng cao — clarify trước khi plan,       │
│        constitution làm nền cho mọi quyết định kỹ thuật        │
│  Yếu:  Không lưu theo module/version, không enforce TDD        │
├─────────────────────────────────────────────────────────────────┤
│  ⚙️ obra/Superpowers — THỰC THI                                 │
│  "Khi đã có tasks, implement thế nào cho đúng?                 │
│   TDD, review giữa tasks, subagent song song?"                  │
│                                                                 │
│  Giỏi: Implement discipline — TDD bắt buộc, review gate,       │
│        subagent coordination tự động                            │
│  Yếu:  Không có spec storage, cần IDE support riêng            │
└─────────────────────────────────────────────────────────────────┘
```

---

### Ba giai đoạn — ba công cụ

Một feature đi qua 3 giai đoạn, mỗi giai đoạn một công cụ đảm nhiệm:

```
GIAI ĐOẠN 1: LÊN KẾ HOẠCH
──────────────────────────────────────────────────────
Công cụ: github/spec-kit
Làm gì:  Constitution → Specify → Clarify → Plan → Tasks
Kết quả: tasks.md rõ ràng, AI biết chính xác cần làm gì

                    ↓ tasks.md

GIAI ĐOẠN 2: THỰC THI
──────────────────────────────────────────────────────
Công cụ: obra/Superpowers  (nếu IDE support)
         hoặc /opsx:apply  (nếu không)
Làm gì:  TDD → code → review → next task → verify → done
Kết quả: Code đúng, có tests, đã review

                    ↓ spec + plan + tasks (đã ✅)

GIAI ĐOẠN 3: LƯU TRỮ
──────────────────────────────────────────────────────
Công cụ: OpenSpec convention
Làm gì:  Archive vào specs/[module]/[feature]/[version]/
Kết quả: Tra cứu được sau 6 tháng, AI đọc được lịch sử
```

---

### Ví dụ thực tế — 3 scenario theo mức độ setup

#### Scenario A — Chỉ OpenSpec (IDE bất kỳ, mới bắt đầu)

```
Task: "Export báo cáo phụ tải điện ra Excel"

1. /opsx:propose "Export báo cáo phụ tải điện ra Excel"
   → AI tạo proposal, design, be-spec, fe-spec, tasks.md

2. Review tasks.md — sửa chỗ AI hiểu sai nghiệp vụ

3. /opsx:apply → AI implement từng task

4. /opsx:archive
   → specs/baocao/export-ptai-dien/v1-export-excel/
```

✅ Được: Spec archive đẹp, trace được lịch sử.
⚠️ Thiếu: Không có TDD, không có review gate tự động.

---

#### Scenario B — spec-kit + OpenSpec (Antigravity, Copilot, Windsurf...)

Combo khuyến nghị cho hầu hết team hiện tại.

```
Task: "Phân quyền người dùng theo đơn vị ORGID"

── LÊN KẾ HOẠCH (spec-kit) ─────────────────────────────

1. /speckit.specify "Phân quyền người dùng theo đơn vị"

2. /speckit.clarify
   AI hỏi: Phân quyền theo đơn vị hay phòng ban?
           Inherit từ đơn vị cha không?
           Có audit log không?
   → Mày trả lời → spec không còn mơ hồ

3. /speckit.plan "Spring Boot, JOOQ, schema EVNTMS, JWT ORGID"
   → plan.md với tech decisions đúng stack

4. /speckit.tasks → tasks.md: 8 tasks có dependency rõ

── THỰC THI ─────────────────────────────────────────────

5. /opsx:apply → implement từng task theo tasks.md

── LƯU TRỮ (OpenSpec) ───────────────────────────────────

6. /opsx:archive
   → specs/quantrihethong/phan-quyen-don-vi/v1-crud-co-ban/
      ├── spec.md   (từ spec-kit)
      ├── plan.md   (từ spec-kit)
      └── tasks.md  (từ spec-kit, tất cả ✅)
```

✅ Được: Planning chất lượng hơn nhờ clarify, spec archive đúng module/version.
⚠️ Thiếu: Không có TDD và review gate tự động trong implement.

---

#### Scenario C — spec-kit + Superpowers + OpenSpec (Claude Code hoặc Cursor)

Combo đầy đủ nhất.

```
Task: "Tích hợp CMIS upload file hợp đồng điện tử"

── LÊN KẾ HOẠCH (spec-kit) ─────────────────────────────

1. /speckit.constitution  (1 lần cho toàn project)
   → constitution.md: security-first, JWT required,
     JOOQ only, audit fields bắt buộc, no hardcode URL

2. /speckit.specify + /speckit.clarify
   → AI hỏi: chunk size? retry? rollback khi lỗi?

3. /speckit.plan "Spring Boot, OpenFeign → CMIS REST API"
   → AI tự check constitution trước khi plan

4. /speckit.tasks → tasks.md: 12 tasks

── THỰC THI (Superpowers tự động) ──────────────────────

5. AI implement, Superpowers kích hoạt tự động:

   using-git-worktrees    → Tạo branch feature/cmis-upload

   [Mỗi task]
   test-driven-development → ✍️ Viết test fail
                           → ✅ Viết code để pass
                           → 🔄 Refactor → 💾 Commit

   [Giữa các tasks]
   requesting-code-review  → AI tự review trước khi tiếp

   [Cuối cùng]
   verification            → Verify toàn bộ
   finishing-branch        → PR checklist, merge

── LƯU TRỮ (OpenSpec) ───────────────────────────────────

6. /opsx:archive
   → specs/tich-hop/cmis-upload/v1-hop-dong-dien-tu/
      ├── spec.md
      ├── plan.md
      └── tasks.md  (tất cả ✅)
```

✅ Được: Planning chất lượng cao + implement có TDD/review + spec archive đầy đủ.
⚠️ Thiếu: Cần IDE support Superpowers (Claude Code hoặc Cursor).

---

### Chọn combo phù hợp với setup của bạn

| Setup hiện tại | Combo | Ghi chú |
|---|---|---|
| IDE bất kỳ, mới bắt đầu | **OpenSpec only** | Đơn giản, đủ dùng ngay |
| Antigravity, Copilot, Windsurf | **spec-kit + OpenSpec** | Khuyến nghị cho hầu hết team |
| Claude Code hoặc Cursor | **spec-kit + Superpowers + OpenSpec** | Combo đầy đủ nhất |

> **Lưu ý:** Không cần dùng cả 3 ngay từ đầu. Bắt đầu với OpenSpec, thêm spec-kit khi IDE support, thêm Superpowers khi chuyển sang Claude Code hoặc Cursor. Ba công cụ không conflict nhau — thêm sau không cần đổi lại cái đã setup trước.

## 9. Cấu Trúc Sau Khi Áp Dụng

```
your-workspace/
├── HUONG-DAN-AP-DUNG.md         ← File hướng dẫn này
├── your-project.code-workspace  ← VS Code workspace config
│
├── your-backend/                ← Backend project
│   ├── AGENTS.md                ← ✅ AI Agent đã generate
│   ├── .agent/
│   │   ├── rules/               ← ✅ AI Agent đã cập nhật
│   │   │   ├── 01-backend-core-conventions.md
│   │   │   ├── 02-repository-pattern.md
│   │   │   ├── 03-service-pattern.md
│   │   │   ├── 04-rest-api-controller.md
│   │   │   ├── 05-security-rules.md       (generic — sẵn sàng)
│   │   │   ├── 09-project-structure.md
│   │   │   ├── 10-database-orm.md
│   │   │   └── 13-openspec-conventions.md  (generic — sẵn sàng)
│   │   ├── workflows/           ← Slash commands
│   │   │   ├── generate-crud-api.md
│   │   │   ├── add-api-endpoint.md
│   │   │   ├── security-check.md
│   │   │   └── quick-fix.md
│   │   └── skills/              ← OpenSpec skills (auto-generated)
│   ├── openspec/                ← OpenSpec (auto-generated bởi openspec init)
│   │   ├── changes/             ← Feature đang làm
│   │   └── specs/               ← Archive theo module/feature/version
│   ├── docs → ../docs           ← SymbolicLink
│   ├── database → ../database   ← SymbolicLink
│   └── src/                     ← Source code
│
├── your-frontend/               ← Frontend project
│   ├── AGENTS.md                ← ✅ AI Agent đã generate
│   ├── .agent/
│   │   ├── rules/               ← ✅ AI Agent đã cập nhật
│   │   ├── workflows/
│   │   │   ├── generate-component.md
│   │   │   └── add-api-call.md
│   │   └── skills/
│   ├── openspec/
│   │   ├── changes/
│   │   └── specs/
│   ├── docs → ../docs           ← SymbolicLink
│   ├── database → ../database   ← SymbolicLink
│   └── src/
│
├── docs/                        ← Shared documentation
│   ├── handoff.md               ← BE ↔ FE Agent communication
│   ├── dac-ta/                  ← Đặc tả nghiệp vụ
│   ├── design-api/              ← Thiết kế API
│   ├── nghiep-vu/               ← Tài liệu nghiệp vụ
│   ├── tich-hop/                ← Tài liệu tích hợp
│   ├── hdsd/                    ← Hướng dẫn sử dụng
│   ├── json/                    ← JSON samples
│   └── pdf/                     ← PDF documents
│
└── database/                    ← Database schemas & scripts
    ├── Schema_XXX.sql
    ├── data-sample.sql
    └── scripts/
```

---

## 10. FAQ

### Q: AI Agent nào được hỗ trợ?
**A:** Bất kỳ AI assistant nào đọc được `.agent/` directory: Gemini Code Assist, GitHub Copilot (với agent mode), Cursor, Claude, Windsurf, Cline...

### Q: Dự án chỉ có Backend (không có Frontend)?
**A:** Chỉ cần copy `.agent/` và `AGENTS.md` từ `base-backend-api/`. Bỏ qua frontend. Không cần SymbolicLink handoff.

### Q: Rules nào cần AI cập nhật, rules nào dùng được luôn?
**A:**
- ✅ **Dùng ngay:** `05-security-rules.md`, `08-frontend-security.md`, `13-openspec-conventions.md`
- ⚠️ **Cần AI cập nhật:** Các file có dòng "CHƯA CẤU HÌNH"

### Q: Có thể thêm rules mới không?
**A:** Có! Tạo file `.md` mới trong `.agent/rules/` với YAML frontmatter:
```yaml
---
trigger: always_on  # hoặc: glob, model_decision, manual
globs: **/*.java    # chỉ cần nếu trigger = glob
---
```

### Q: SymbolicLink không hoạt động trên Windows?
**A:** Bật **Developer Mode**: Settings → Update & Security → For developers → Developer Mode: ON. Hoặc chạy PowerShell as Administrator.

### Q: OpenSpec có bắt buộc không?
**A:** Không bắt buộc. OpenSpec hữu ích cho các feature lớn cần planning trước. Đối với tasks nhỏ, dùng workflows (`/generate-crud-api`, `/add-api-endpoint`...) là đủ.

### Q: obra/Superpowers có bắt buộc không?
**A:** Không bắt buộc, nhưng rất nên dùng nếu IDE hỗ trợ (Claude Code, Cursor, Gemini CLI). Superpowers giải quyết vấn đề lớn hơn OpenSpec — nó chuẩn hóa toàn bộ cách AI làm việc từ đầu đến cuối thay vì chỉ từng feature riêng lẻ.

### Q: IDE không hỗ trợ Superpowers thì bỏ qua hoàn toàn?
**A:** Không cần bỏ qua hoàn toàn. Mày vẫn áp dụng được **triết lý** của Superpowers bằng cách tạo workflows thủ công trong `.agent/workflows/` mô phỏng các bước key: plan trước khi code, TDD, review checklist, done checklist. Sự khác biệt là mày phải tự gọi từng bước thay vì AI tự động.

### Q: Superpowers và OpenSpec dùng song song được không?
**A:** Được và nên dùng song song. Superpowers lo development lifecycle (brainstorm → plan → TDD → review → done). OpenSpec lo spec storage và traceability theo module/feature/version. Hai thứ bổ sung cho nhau, không thay thế nhau.

### Q: spec-kit khác gì OpenSpec?
**A:** Cả hai đều là SDD tools nhưng khác nhau về scope. OpenSpec tập trung vào per-feature planning và lưu trữ specs có structure. spec-kit đầy đủ hơn — có project-level constitution làm nền, bước clarify riêng trước khi plan, system extensions/presets để customize, và IDE support rộng hơn nhiều (kể cả Antigravity). Nếu IDE support cả hai thì dùng spec-kit làm planning layer chính, OpenSpec làm spec archive.

### Q: spec-kit, Superpowers, OpenSpec — dùng cả 3 cùng lúc được không?
**A:** Được. Mỗi thứ có vai trò riêng và bổ sung cho nhau: spec-kit lo planning & implementation workflow, Superpowers lo TDD và subagent coordination (nếu IDE support), OpenSpec lo lưu trữ và trace specs dài hạn theo module/version. Thực tế không cần dùng cả 3 ngay từ đầu — bắt đầu với cái IDE mày support tốt nhất, thêm dần các thứ còn lại khi cần.
