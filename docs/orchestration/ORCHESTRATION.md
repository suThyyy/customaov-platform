# Điều phối đa agent cho customAOV (Orca)

> Owner duyệt ngày 15/11/2026, bỏ giai đoạn Pilot. Việc "review 8 route + sửa P0" thành epic E1 của roadmap.
> Viết cho Orca CLI **1.4.258** (`orca --version`). Lệnh lấy theo `orca skills get orchestration --full` và `orca <lệnh> --help` của bản này. Khi nâng Orca, đọc lại hướng dẫn và sửa tài liệu này trước khi chạy tiếp.

Đọc kèm:
- `AGENTS.md`: quy tắc repo.
- `docs/orchestration/STATE.md`: trạng thái hiện tại và **lệnh tiếp quản Lead**.
- `docs/orchestration/tasks/<id>.md`: checkpoint của từng task.
- `docs/product/PRD.md`, `docs/product/ROADMAP.md`: phạm vi và DAG.

---

## 1. Vai trò

| Vai trò | Ai | Việc làm | Không được làm |
|---|---|---|---|
| **Owner** | Người dùng (suThyy) | Duyệt ở các điểm bắt buộc dừng (mục 8). Duyệt merge `integration/mvp → main` theo epic. | – |
| **Lead** | Claude Code, `claude-opus-5-5`, chạy trong Orca ở checkout gốc `base-workspace` (nhánh `orch/lead`) | Điều phối Run/Task, chọn model theo mục 3, **tự làm kiến trúc** (thiết kế API, schema, quyết định kỹ thuật), đọc bằng chứng, nghiệm thu, merge task vào `integration/mvp`. Là **người duy nhất ghi** `STATE.md` và `tasks/<id>.md`. | Merge vào `main`. Tự viết code tính năng dài (giao worker để giữ quota). |
| **Lead dự phòng** | Codex, `gpt-5.6-sol`, effort `medium` | Tiếp quản bằng `run-use` khi Lead dừng quá 15 phút (mục 7.2). Tiếp quản xong thì có quyền và nghĩa vụ như Lead. | Chạy song song với Lead. Mỗi lúc chỉ có **một** Lead. |
| **Coder chính** | Codex, `gpt-5.6-sol` medium | Code tính năng, sửa lỗi, test. | Sửa ngoài phạm vi. Merge. Thêm thư viện. |
| **Worker phụ** | Antigravity (theo bậc, mục 3), Copilot | Việc cơ học, docs, test đơn giản, audit, migration, task khó cần model Claude. Copilot còn làm reviewer phụ. | Như coder. |
| **Reviewer** | Theo mục 3.3, **luôn khác hãng với coder** | Đọc diff, chạy lệnh verify, trả PASS/FAIL theo tiêu chí. | Sửa code của task đang review. |

**"Hãng" là hãng làm ra model**, không phải công cụ chạy model. Ví dụ `claude-*` chạy qua Antigravity vẫn là Anthropic; Copilot `auto` hiện chọn GPT-5.6 Luna nên là OpenAI.

---

## 2. Agent và model khả dụng (kiểm tra thật 15/11/2026)

Cách kiểm tra: xem trạng thái đăng nhập, liệt kê model, rồi gửi prompt một chữ ("Reply with exactly the word OK") cho từng model, chạy ngoài repo, chế độ chỉ đọc. Kết quả "OK" nghĩa là đã đăng nhập và **lúc đó** còn quota. Không CLI nào cho xem số quota còn lại.

| Agent | Cách Orca chạy | Tài khoản | Model được phép dùng (đã probe OK) | Hãng |
|---|---|---|---|---|
| **Claude Code** 2.1.318 | `--agent claude` | claude.ai **Pro** (phiên hết hạn 12/12/2026) | `claude-opus-5-5` (Lead). Worker Claude chỉ khi bất khả kháng, vì dùng chung quota với Lead. | Anthropic |
| **Codex** 0.163.0 | Terminal tự tạo (mục 4.3) để truyền `-c service_tier="default"` | ChatGPT | **Chỉ `gpt-5.6-sol`, effort `medium`** (model có trong `codex debug models`, probe OK, tắt priority qua `-c` OK) | OpenAI |
| **Antigravity** (agy 1.5.8) | `--agent antigravity --model <id>` | Antigravity | `gemini-3.8-flash-{low,medium,high}`, `gemini-4-hydrogen-{medium,high}`, `gemini-4-argon-{medium,high}`, `claude-sonnet-5-5-{low,medium,high}`, `claude-opus-5-5-{medium,high}` | Google / Anthropic |
| **GitHub Copilot CLI** 1.0.112 | Terminal tự tạo (mục 4.3); Orca không có agent id `copilot` | GitHub `suThyyy` | **Chỉ `--model auto`** (Copilot Fusion chọn **GPT-5.6 Luna**). Mọi id cụ thể đều báo *"not available"* (gói chỉ có 1 model trong picker). Tính bằng **AI credits** (~0.44 credit cho 1 prompt thử). | OpenAI (theo model auto chọn) |

Không dùng:
- **OpenCode** (Go, Zen, free): bỏ theo quyết định của Owner.
- **Gemini CLI**: chưa cài, bỏ qua.
- **cursor, grok, devin, muse, zcode, omp**: chưa cài.
- **Biến môi trường `OPENAI_API_KEY`**: API trả phí, không agent nào dùng.

**Probe lại** trước mỗi epic, chạy ở thư mục tạm, mỗi lệnh phải in `OK`:

```bash
P="Reply with exactly the word OK and nothing else. Do not use tools."
codex exec --skip-git-repo-check -s read-only -m gpt-5.6-sol -c model_reasoning_effort=medium -c service_tier=default "$P"
agy -p "$P" --model gemini-4-hydrogen-medium --print-timeout 120s
agy -p "$P" --model gemini-3.8-flash-medium --print-timeout 120s
agy -p "$P" --model claude-sonnet-5-5-medium --print-timeout 120s
copilot -p "$P" --model auto
```

---

## 3. Chọn model

Nguyên tắc: **bắt đầu ở bậc rẻ nhất đủ làm; chỉ nâng khi task fail hoặc reviewer bác.**

### 3.1. Bậc

| Bậc | Dùng cho | Model theo thứ tự ưu tiên (cùng bậc = thay thế được cho nhau) |
|---|---|---|
| **B1 – cơ học** | Đổi nhãn/copy, test đơn giản, docs, kiểm tra nhanh, tick checklist | agy `gemini-3.8-flash-medium` · Copilot `auto` |
| **B2 – chuẩn** | Code tính năng, sửa lỗi, unit/integration test, endpoint | **Codex `gpt-5.6-sol` medium** · agy `claude-sonnet-5-5-medium` |
| **B2-dài – audit/dài** | Audit, rà soát nhiều file, task dài, migration | **agy `gemini-4-hydrogen-medium`** (mặc định) · Codex `gpt-5.6-sol` medium |
| **B3 – nâng** | Khi B2/B2-dài fail 2 lần hoặc reviewer bác 2 lần; task khó cần model Claude | agy `gemini-4-hydrogen-high` · agy `claude-opus-5-5-medium` |
| **B4 – hiếm** | Audit/review khó mà B3 không đạt. **Hạn chế tối đa** vì nhanh hết quota | agy `gemini-4-argon-high` · agy `claude-opus-5-5-high` |
| **Lead** | Kiến trúc, quyết định kỹ thuật, PRD/ROADMAP, task cực khó cần ngữ cảnh toàn dự án | Claude `claude-opus-5-5` (chính Lead) |

### 3.2. Leo thang và hết quota

- **Leo thang:** task **fail 2 lần ở một bậc** (worker báo failed, verify đỏ, hoặc reviewer bác) thì lên bậc trên **hoặc** đổi sang agent khác cùng bậc. Lead ghi lý do vào mục "Leo thang" trong `tasks/<id>.md`. Codex chỉ có một model, nên "nâng" Codex nghĩa là đổi agent.
- **Hết quota:** model báo hết hạn mức (usage limit, 429, rate limit, hết credit) thì **chuyển ngay** sang model cùng bậc ở agent khác (cột phải của bảng 3.1), ghi vào `STATE.md`, mục "Model tạm ngưng", không chờ. Chi tiết ở mục 7.1.
- Copilot hết AI credit của gói: **không** mua thêm (đó là chi phí ngoài subscription, mục 8). Đánh dấu tạm ngưng.
- Chạy song song tối đa **3 worker**.

### 3.3. Reviewer khác hãng

| Coder thuộc hãng | Reviewer mặc định | Reviewer thay thế |
|---|---|---|
| OpenAI (Codex, Copilot) | agy `gemini-4-hydrogen-medium` | agy `claude-sonnet-5-5-medium` |
| Google (Gemini) | Codex `gpt-5.6-sol` medium | Copilot `auto` (reviewer phụ, việc nhỏ) · agy `claude-sonnet-5-5-medium` |
| Anthropic (Claude, kể cả qua agy) | Codex `gpt-5.6-sol` medium | agy `gemini-4-hydrogen-medium` · Copilot `auto` (việc nhỏ) |

- Copilot **không** review code của Codex (cùng OpenAI).
- Copilot review thì xem dòng *"Copilot Fusion selected …"* trong output. Nếu `auto` chọn model cùng hãng với coder, kết quả review bị huỷ và giao lại.
- Coder bị đổi giữa chừng thì kiểm lại reviewer theo coder **cuối cùng**.

---

## 4. Vòng đời task

```
pending ─► ready ─► coder ─► worker_done ─► reviewer (khác hãng)
                      ▲                          │
                      └──── FAIL (send) ◄────────┤
                                                 ▼ PASS
                       merge --no-ff vào integration/mvp ─► hết epic: gate Owner ─► main
```

### 4.1. ID, nhánh, worktree

- ID task: `E<epic>-T<nn>` (vd. `E3-T02`). Slug viết thường, gạch nối, không dấu.
- Nhánh: **`task/<id>-<slug>`**, rẽ từ `integration/mvp`. Mỗi task một nhánh, một worktree.
- Lead làm việc ở checkout gốc, nhánh **`orch/lead`** (chứa `docs/orchestration/` và `docs/product/`). Lead merge `orch/lead` vào `integration/mvp` khi một tài liệu được duyệt và ở cuối mỗi epic.
- Reviewer dùng chính worktree của coder (không sửa file).

Lead tạo worktree bằng Orca để **chốt đúng tên nhánh**, vì `worker-start` không có cờ đặt tên nhánh:

```bash
orca worktree create --name <id>-<slug> --branch task/<id>-<slug> --base-branch integration/mvp \
  --parent-worktree active --setup skip --json
```

### 4.2. Lệnh điều phối (Lead)

```bash
orca orchestration run-current                     # Run đang gắn (id ghi trong STATE.md)
orca orchestration task-create --spec-file docs/orchestration/tasks/<id>.md \
  --task-title "<id> <tiêu đề>" --deps '["<task_id>"]'
orca orchestration task-list --ready --brief       # mỗi lần được đánh thức

# Worker agent native (Antigravity, Claude)
orca orchestration worker-start --task <task_id> --worktree branch:task/<id>-<slug> \
  --agent antigravity --model <model_id>

# Review: task riêng, phụ thuộc task code, cùng worktree
orca orchestration task-create --spec-file docs/orchestration/tasks/<id>.review.md \
  --task-title "<id> review" --deps '["<task_id_code>"]'

# FAIL: gửi việc sửa cho đúng coder đó
orca orchestration send --to dispatch:<dispatch_id> --subject "<id> sửa theo review" --body "<lỗi>"

# PASS: Lead merge (ở một worktree đang checkout integration/mvp, hoặc từ checkout gốc)
git merge --no-ff task/<id>-<slug>    # trên nhánh integration/mvp
```

- Start hết worker độc lập rồi **kết thúc lượt**. Orca sẽ đánh thức Lead. Không poll, không viết script theo dõi, không gõ vào terminal của worker.
- Thư `question`: trả lời bằng `orca orchestration reply --id <message_id> --body "<…>"` khi câu trả lời suy ra được từ spec, AGENTS.md, PRD hoặc ROADMAP. Nếu không, hỏi Owner.
- Thư `escalation` có `approval`: chỉ người mới cho phép được. Lead làm việc khác và báo Owner.
- Cuối mỗi lần thức: ghi và commit `STATE.md`.
- PowerShell: JSON trong nháy đơn (`'["…"]'`), nhóm địa chỉ trong nháy (`"@all"`).

### 4.3. Codex và Copilot qua terminal tự tạo

Orca không có cờ để truyền `-c service_tier` cho Codex, và không có agent id `copilot`. Hai agent này chạy theo cách *low-level topology* của Orca:

```bash
# Codex: gpt-5.6-sol, medium, tắt priority chỉ cho phiên này (không sửa ~/.codex/config.toml)
orca terminal create --worktree branch:task/<id>-<slug> --title "<id> codex" \
  --command "codex -m gpt-5.6-sol -c model_reasoning_effort=medium -c service_tier=default" --json
# Copilot
orca terminal create --worktree branch:task/<id>-<slug> --title "<id> copilot" \
  --command "copilot --model auto" --json

orca terminal wait --terminal <handle> --for tui-idle --timeout-ms 60000 --json
orca orchestration worker-start --task <task_id> --terminal <handle> --worktree branch:task/<id>-<slug>
```

- `service_tier=default` đã thử: Codex chấp nhận. Giá trị lạ thì Codex cảnh báo *"not advertised… will be omitted"*.
- **Cần xác minh ở task đầu tiên dùng mỗi agent (E1):** worker chạy kiểu này có nhận preamble và gửi được `worker_done` không. Không được thì `worker-show`/`worker-read` để xem lý do, ghi vào STATE.md, rồi dùng agent cùng bậc khác (mục 3.1) cho tới khi sửa xong.

### 4.4. Worker phải làm gì (ghi trong mỗi spec)

1. `git branch --show-current` phải ra `task/<id>-<slug>`. Sai thì `ask` Lead.
2. `npm ci` ở gốc worktree (theo `package-lock.json`, không thêm thư viện).
3. Chỉ sửa file trong mục "Được sửa". Cần sửa ngoài phạm vi thì `ask`.
4. **Commit WIP sau mỗi bước có nghĩa** (`wip(<id>): …`).
5. Dev server dùng cổng riêng **`5200 + nn`** (vd. task T03 → `npx vite --port 5203` trong `base-frontend-web`), rồi truyền baseUrl cho script. Không dùng 5173/5174.
6. Xong thì gửi `worker_done` (`--outcome succeeded|failed`) kèm bằng chứng: tóm tắt, commit cuối, đầu ra rút gọn của lệnh verify.

---

## 5. Mẫu task (`docs/orchestration/tasks/<id>.md`)

File này vừa là **spec** (`--spec-file`) vừa là **checkpoint**. Chỉ Lead ghi.

```markdown
# <id> – <tiêu đề>

- Epic: E<n> · Bậc: B1|B2|B2-dài|B3|B4 · Phụ thuộc: <id,…|không>
- Coder: <agent/model> · Reviewer: <agent/model> (khác hãng)
- Nhánh: task/<id>-<slug> · Rẽ từ: integration/mvp · Cổng dev: 52<nn>

## Mục tiêu
<1–3 câu: kết quả nhìn thấy/đo được>

## Được sửa
- <đường dẫn tương đối>
- Cấm: _old_web_DO_NOT_EDIT/, web_backup_*/, docs/{dac-ta,design-api,nghiep-vu,tich-hop,hdsd,json,pdf}/, package.json (trừ khi spec ghi rõ đã được duyệt)

## Tiêu chí nghiệm thu
- [ ] <đo được>
- [ ] Tuân thủ AGENTS.md. Test cũ vẫn xanh (đổi nhãn thì chỉ sửa selector, không bỏ test).

## Lệnh verify
npm run build && npm run lint && npm test          # ở gốc repo
npx vite --port 52<nn>                              # base-frontend-web, terminal riêng
node scripts/e2e-auth.mjs http://localhost:52<nn>
node scripts/screenshot.mjs <id> http://localhost:52<nn>   # so với docs/screenshots/baseline
(exit ≠ 0 = FAIL, trừ khi tiêu chí ghi khác)

---
<!-- Phần dưới do Lead ghi -->
## Checkpoint
| Lúc | Dispatch | Agent/model | Sự kiện | Commit |

## Tiến độ hiện tại
<xong / dở / bước tiếp — đủ để agent khác làm tiếp>

## Leo thang
| Lúc | Từ → sang | Lý do (fail lần 2 / reviewer bác / hết quota) |

## Review
<reviewer, hãng, PASS/FAIL, lý do>
```

`tasks/<id>.review.md` dùng cùng khung, với "Mục tiêu" = nghiệm thu `<id>`, "Được sửa" = không file nào, đầu ra = PASS/FAIL theo từng tiêu chí.

---

## 6. `STATE.md`

Lead ghi **sau mỗi quyết định** và commit lên `orch/lead`. Các mục bắt buộc:
- Giai đoạn, Run id, Lead hiện tại, terminal/session của Lead.
- Lệnh tiếp quản cho Codex.
- Đang chạy, Chờ, Gate đang mở.
- Quyết định gần nhất (10 dòng, mới nhất ở trên).
- Model tạm ngưng.

Mẫu là chính file `STATE.md` hiện tại.

---

## 7. Hết quota

### 7.1. Worker

Dấu hiệu: `escalation` có `stopReason`, `exited`/`lost`, hoặc `worker-read` cho thấy usage limit/429/hết credit.

1. Xác minh: `orca orchestration worker-show --dispatch <d>`, `orca orchestration worker-read --dispatch <d> --source auto`. Im lặng hay timeout **không** phải bằng chứng.
2. Worker còn sống mà treo thì chạy `orca orchestration worker-stop --dispatch <d>`. Gặp `stop_unknown` thì báo Owner.
3. Ghi checkpoint: đọc `git log task/<id>-<slug>`, điền "Tiến độ hiện tại" và "Leo thang". Ghi model vào "Model tạm ngưng" trong `STATE.md`.
4. Giao lại **cùng Task, cùng worktree, cùng nhánh** cho model cùng bậc ở agent khác:
   ```bash
   orca orchestration worker-start --task <task_id> --retry-of <d> \
     --worktree branch:task/<id>-<slug> --agent <agent> --model <model>
   # hoặc với Codex/Copilot: tạo terminal như 4.3 rồi
   orca orchestration worker-start --task <task_id> --retry-of <d> --terminal <handle> --worktree branch:task/<id>-<slug>
   ```
   Thư đầu cho worker mới: "Đọc `tasks/<id>.md`, mục *Tiến độ hiện tại*, và `git log`; làm tiếp, không làm lại."
5. Kiểm lại reviewer theo hãng của coder mới.
6. 3 lần start hỏng liên tiếp trong cùng chuỗi `--retry-of` thì Orca ngắt task. Khi đó **dừng và báo Owner**, không lách bằng Run hay Task mới.

### 7.2. Lead (tiếp quản)

**Điều kiện (cả hai):**
- (a) Lead không phản hồi: terminal Lead báo hết hạn mức/lỗi, hoặc có thư chưa đọc quá **15 phút** (`orca orchestration check --peek --terminal <lead_handle>`).
- (b) `STATE.md` ghi `Lead hiện tại: claude`, và không có dòng "đang bàn giao" mới hơn 15 phút.

**Người kích hoạt:** Owner, chạy **lệnh ghi sẵn trong `STATE.md`** từ thư mục gốc `base-workspace`. Chưa có watchdog (Owner quyết 15/11).

**Codex làm theo thứ tự:**
1. Đọc `AGENTS.md`, tài liệu này, `STATE.md`, `docs/product/ROADMAP.md`, các `tasks/<id>.md` đang chạy. Chạy `orca skills get orchestration --full`.
2. `orca orchestration run-use --id <run_id>`.
3. Đối chiếu: `orca orchestration run-show --id <run_id>`, `orca orchestration worker-list --run <run_id> --include-remote`, `orca orchestration task-list --run <run_id> --brief`, `orca orchestration inbox --terminal run:<run_id> --limit 50`.
4. Ghi `STATE.md`: `Lead hiện tại: codex`, thời điểm, lý do, sai lệch nếu có. Commit.
5. `orca orchestration check`, xử lý thư, rồi điều phối tiếp. Giữ nguyên mọi điểm dừng ở mục 8.
6. Không tự review task mà Codex/Copilot code (cùng OpenAI).

**Khi Claude có quota trở lại:**
- Việc đầu tiên là đọc `STATE.md`. Nếu `Lead hiện tại: codex` thì Claude **không chạy lệnh điều phối nào**, chỉ báo Owner.
- Trả quyền khi Owner yêu cầu hoặc Codex sắp hết quota:
  1. Codex ghi "đang bàn giao cho claude <giờ>" rồi kết thúc lượt.
  2. Claude chạy `orca orchestration run-use --id <run_id>`.
  3. Claude ghi `Lead hiện tại: claude`.
- Cả hai cùng hết quota: worker vẫn chạy tiếp, thư được giữ trong hộp thư Run. Báo Owner. Không ai tạo Run mới.

> Chưa kiểm chứng, theo dõi ở lần tiếp quản đầu tiên: `check --peek --terminal <lead_handle>` gọi từ terminal khác có đọc được hộp thư Lead không; sau `run-use` thì thư có chuyển ngay sang Codex không.

---

## 8. Điểm bắt buộc dừng hỏi Owner

Lead (hoặc Lead dự phòng) **dừng, mở gate và hỏi Owner trong chat** trước khi:

1. Duyệt PRD/roadmap (đã gộp vào lần dừng 15/11; PRD/ROADMAP sửa lớn thì hỏi lại).
2. Đổi phạm vi: thêm/bớt route, tính năng, epic; đổi tiêu chí đã duyệt.
3. Xoá dữ liệu: file mock, file repo, nhánh hoặc worktree còn commit chưa merge, `orchestration reset`.
4. Thêm thư viện (dependency mới trong bất kỳ `package.json` nào; với backend: lần đầu tạo `package.json` theo stack đã duyệt trong PRD thì được, dependency ngoài danh sách PRD thì hỏi).
5. **Merge vào `main`** (theo epic).
6. Chi phí ngoài subscription: API trả theo lượt, mua thêm credit Copilot, dịch vụ cloud trả phí.
7. Thay đổi schema DB (`database/`, migration, kiểu dữ liệu dùng chung với backend).

```bash
orca orchestration gate-create --task <task_id> --question "<câu hỏi>" --options '["Duyệt","Sửa","Huỷ"]'
orca orchestration gate-resolve --id <gate_id> --resolution "<câu trả lời của Owner>"   # chỉ sau khi Owner trả lời
```

Không bao giờ tự resolve gate thay Owner.

---

## 9. Quyết định của Owner (15/11/2026)

1. Duyệt tài liệu này, **bỏ Pilot**: review 8 route + sửa P0 thành epic E1.
2. Dùng nhánh tích hợp **`integration/mvp`**; Owner duyệt merge vào `main` theo epic.
3. Chưa có watchdog. Lệnh tiếp quản ghi sẵn trong `STATE.md`.
4. Worker Codex tắt `service_tier` priority bằng `-c service_tier=default` khi launch. Không sửa config chung.
5. Bỏ OpenCode.
6. Thêm Copilot CLI (đã đăng nhập, chỉ `auto`).
7. Codex chỉ dùng `gpt-5.6-sol` medium (đã xác nhận model tồn tại và chạy được).
8. Bảng bậc model và quy tắc leo thang/hết quota như mục 3.

---

## 10. Lộ trình

1. **Đã xong:** Lead soạn `docs/product/PRD.md` và `docs/product/ROADMAP.md`, rồi **DỪNG** chờ Owner duyệt. Đây là lần dừng duy nhất trước khi code.
2. **Sau khi duyệt:** chạy ROADMAP theo DAG (`task-list --ready`), tối đa 3 worker. Chỉ dừng ở các điểm của mục 8. Cuối mỗi epic: tóm tắt, mở gate merge `integration/mvp → main`.
