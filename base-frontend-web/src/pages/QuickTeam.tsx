import { useState } from 'react'
import type { TeamSplitMode } from '@customaov/team-core'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/primitives'
import { Button } from '../components/ui/Button'
import { emptyPlayers, generate, MODE_LABEL, RANK_CATALOG, score, shareText, swap, validate, type QuickResult } from '../features/quick-team/model'

const field = 'min-h-11 w-full min-w-0 rounded-btn border border-line bg-surface p-2 text-base'
export default function QuickTeam() {
  const [players, setPlayers] = useState(emptyPlayers)
  const [mode, setMode] = useState<TeamSplitMode>('random')
  const [result, setResult] = useState<QuickResult | null>(null)
  const [stale, setStale] = useState(false)
  const [manual, setManual] = useState(false)
  const [blue, setBlue] = useState(''), [red, setRed] = useState('')
  const [feedback, setFeedback] = useState(''), [fallback, setFallback] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const errors = validate(players, mode)
  const changed = () => { if (result) setStale(true); setBlue(''); setRed(''); setFeedback(''); setFallback('') }
  const reset = () => { setPlayers(emptyPlayers()); setMode('random'); setResult(null); setStale(false); setManual(false); setBlue(''); setRed(''); setFeedback(''); setFallback(''); setConfirmReset(false) }
  const copy = async () => {
    if (!result || stale) return
    const text = shareText(result, manual)
    try { await navigator.clipboard.writeText(text); setFeedback('Đã sao chép kết quả.'); setFallback('') }
    catch { setFeedback('Không thể sao chép tự động. Hãy chọn và sao chép nội dung bên dưới.'); setFallback(text) }
  }
  return <>
    <PageHeader title="Chia đội nhanh" description="Nhập 10 người chơi, chia đội và chia sẻ. Không cần đăng nhập." />
    <p className="mb-6 text-sm text-fg-muted">Dữ liệu chỉ ở trang này; rời trang hoặc tải lại sẽ xóa danh sách và kết quả.</p>
    <div className="grid min-w-0 gap-6 xl:grid-cols-2">
      <Card className="min-w-0 p-4 md:p-6">
        <h2 className="text-lg font-semibold">Danh sách người chơi</h2>
        <p className="my-3 text-sm text-fg-muted">Đã nhập {players.filter(p => p.name.trim()).length}/10 người chơi</p>
        <label className="block text-sm">Phương pháp<select className={field} value={mode} onChange={e => { changed(); setMode(e.target.value as TeamSplitMode) }}>{Object.entries(MODE_LABEL).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {players.map((p,i) => <div key={p.id} className="min-w-0">
            <label className="block text-sm" htmlFor={p.id}>Người chơi {i+1}</label>
            <input id={p.id} className={field} maxLength={60} value={p.name} aria-invalid={!!errors[i]} aria-describedby={`${p.id}-error`} onChange={e => { changed(); setPlayers(old => old.map(x => x.id === p.id ? { ...x, name: e.target.value } : x)) }} />
            {mode !== 'random' && <label className="mt-2 block text-sm">{mode === 'tier' ? 'Tier' : 'Rank'} cho người chơi {i+1}<select className={field} value={p[mode]} onChange={e => { changed(); setPlayers(old => old.map(x => x.id === p.id ? { ...x, [mode]: e.target.value } : x)) }}><option value="">Chọn {mode === 'tier' ? 'Tier' : 'Rank'}</option>{mode === 'tier' ? [1,2,3,4,5].map(t => <option key={t} value={t}>Mâm {t}</option>) : RANK_CATALOG.map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label>}
            <p id={`${p.id}-error`} className="mt-1 text-xs text-fg-muted">{errors[i]}</p>
          </div>)}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button disabled={errors.some(Boolean)} onClick={() => { try { setResult(generate(players,mode)); setStale(false); setManual(false); setBlue(''); setRed(''); setFeedback(''); setFallback('') } catch (e) { setFeedback(e instanceof Error ? e.message : 'Không thể chia đội.') } }}>{result ? 'Chia lại' : 'Chia đội'}</Button>
          <Button variant="outline" onClick={() => { if (result || players.some(p => p.name || p.tier || p.rank)) setConfirmReset(true); else reset() }}>Đặt lại</Button>
        </div>
        {confirmReset && <section className="mt-4 rounded-card border border-line p-4" aria-label="Xác nhận đặt lại"><p>Xóa toàn bộ danh sách và kết quả?</p><div className="mt-3 flex gap-3"><Button variant="outline" onClick={reset}>Xác nhận xóa</Button><Button variant="ghost" onClick={() => setConfirmReset(false)}>Hủy</Button></div></section>}
      </Card>
      <section className="min-w-0" aria-label="Kết quả chia đội">
        <h2 className="text-lg font-semibold">Kết quả</h2>
        {stale && <p role="status" className="my-3 text-gold">Dữ liệu đã thay đổi — cần chia lại</p>}
        {result && <p className="my-3 text-sm">{MODE_LABEL[result.mode]} · {manual ? 'Đã điều chỉnh thủ công' : 'Được chia bằng thuật toán'}</p>}
        {result?.warning && <p className="mb-3 text-sm">Chênh lệch còn cao; thuật toán đã chọn phương án dự phòng gần cân bằng nhất.</p>}
        <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2">
          {(['teamA','teamB'] as const).map((team,index) => <Card key={team} className={`min-w-0 p-4 ${index === 0 ? 'bg-team-blue-bg text-team-blue-fg' : 'bg-team-red-bg text-team-red-fg'}`}>
            <h3 className="text-lg font-semibold">{index === 0 ? 'Đội Xanh' : 'Đội Đỏ'}</h3>
            {!result ? <p className="mt-3 text-sm">Nhập đủ 10 người và bấm Chia đội để xem 5 người của đội.</p> : <ul className="mt-3 space-y-2">{result[team].map(p => <li key={p.id}><button className="min-h-11 w-full break-words rounded-btn border border-current/30 p-2 text-left disabled:opacity-50" disabled={stale} aria-pressed={(index === 0 ? blue : red) === p.id} onClick={() => index === 0 ? setBlue(blue === p.id ? '' : p.id) : setRed(red === p.id ? '' : p.id)}>{p.name}{(index === 0 ? blue : red) === p.id ? ' · Đã chọn' : ''}</button></li>)}</ul>}
          </Card>)}
        </div>
        {result && result.mode !== 'random' && <p className="mt-4 text-sm">Tổng trọng số: Xanh {result.teamA.reduce((n,p) => n + score(p,result.mode),0)} · Đỏ {result.teamB.reduce((n,p) => n + score(p,result.mode),0)} · Chênh lệch {Math.abs(result.teamA.reduce((n,p) => n + score(p,result.mode),0)-result.teamB.reduce((n,p) => n + score(p,result.mode),0))}. Đây là điểm quy ước, không phải MMR hoặc xác suất thắng được xác minh.</p>}
        <p className="mt-4 text-sm text-fg-muted">Chọn một người mỗi đội rồi bấm Đổi chỗ. Bấm lại để bỏ chọn.</p>
        <div className="mt-3 flex flex-wrap gap-3"><Button variant="outline" disabled={!result || stale || !blue || !red} onClick={() => { if (result) { setResult(swap(result,blue,red)); setManual(true); setBlue(''); setRed(''); setFeedback(''); setFallback('') } }}>Đổi chỗ</Button><Button variant="outline" disabled={!result || stale} onClick={() => void copy()}>Sao chép kết quả</Button></div>
        {feedback && <p role="status" className="mt-4 text-sm">{feedback}</p>}
        {fallback && <label className="mt-3 block text-sm">Nội dung chia sẻ<textarea className={`${field} mt-2`} rows={14} readOnly value={fallback} onFocus={e => e.target.select()} /></label>}
      </section>
    </div>
  </>
}
