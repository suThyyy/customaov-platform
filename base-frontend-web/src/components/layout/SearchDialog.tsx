import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Gamepad2, Search, Trophy, UserRound } from 'lucide-react'
import { normalizeVi } from '../../lib/text'
import { players, roomFullTitle, rooms, tournaments } from '../../mocks'
import { Modal } from '../ui/Modal'

interface Hit {
  key: string
  to: string
  label: string
  sub: string
}

const norm = normalizeVi

/**
 * Hộp tìm kiếm toàn cục (mở bằng Ctrl/⌘ K hoặc nút tìm kiếm ở TopNav, đóng bằng Esc).
 * Tìm trên mock data. TODO: thay bằng API tìm kiếm khi có backend.
 */
export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')

  const groups = useMemo(() => {
    const q = norm(query.trim())
    const match = (...fields: string[]) => !q || fields.some((f) => norm(f).includes(q))
    const roomHits: Hit[] = rooms
      .filter((r) => match(roomFullTitle(r), r.id, r.host.name))
      .map((r) => ({ key: r.id, to: `/rooms/${r.id}`, label: roomFullTitle(r), sub: `#${r.id} · ${r.modeLabel}` }))
    const tourHits: Hit[] = tournaments
      .filter((t) => match(t.name, t.organizer))
      .map((t) => ({ key: t.slug, to: `/tournaments/${t.slug}`, label: t.name, sub: t.timeLabel }))
    const playerHits: Hit[] = Object.values(players)
      .filter((p) => match(p.name))
      .map((p) => ({ key: p.id, to: `/profile/${p.id}`, label: p.name, sub: 'Người chơi' }))
    const limit = q ? 5 : 3
    return [
      { title: 'Phòng', icon: <Gamepad2 size={16} />, hits: roomHits.slice(0, limit) },
      { title: 'Giải đấu', icon: <Trophy size={16} />, hits: tourHits.slice(0, limit) },
      { title: 'Người chơi', icon: <UserRound size={16} />, hits: playerHits.slice(0, limit) },
    ].filter((g) => g.hits.length > 0)
  }, [query])

  // Phải ổn định: Modal dùng onClose trong deps của effect quản lý focus
  const close = useCallback(() => {
    setQuery('')
    onClose()
  }, [onClose])

  return (
    <Modal open={open} onClose={close} title="Tìm kiếm" placement="top" className="max-w-[560px]">
      <form role="search" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="global-search" className="sr-only">
          Tìm phòng, người chơi, giải đấu
        </label>
        <div className="flex h-11 items-center gap-3 rounded-btn border border-line-strong bg-surface-2 px-3.5 transition-colors focus-within:border-gold/60">
          <Search size={18} aria-hidden className="shrink-0 text-fg-muted" />
          <input
            id="global-search"
            data-autofocus
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm phòng, người chơi, giải đấu..."
            className="h-full min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-muted"
          />
          <kbd className="hidden rounded-btn bg-surface-3 px-2 py-0.5 font-sans text-xs text-fg-muted sm:inline">Esc</kbd>
        </div>
      </form>

      <div className="mt-4 max-h-[55vh] overflow-y-auto" aria-live="polite">
        {groups.length === 0 ? (
          <p className="py-8 text-center text-sm text-fg-muted">Không tìm thấy kết quả cho "{query.trim()}".</p>
        ) : (
          <>
            {!query.trim() && <p className="mb-2 text-xs text-fg-muted">Gợi ý</p>}
            {groups.map((g) => (
              <Group key={g.title} title={g.title} icon={g.icon}>
                {g.hits.map((h) => (
                  <li key={h.key}>
                    <Link
                      to={h.to}
                      onClick={close}
                      className="flex min-h-11 flex-col justify-center rounded-btn px-3 py-1.5 transition-colors hover:bg-white/5"
                    >
                      <span className="text-sm font-medium text-fg">{h.label}</span>
                      <span className="text-xs text-fg-muted">{h.sub}</span>
                    </Link>
                  </li>
                ))}
              </Group>
            ))}
          </>
        )}
      </div>
    </Modal>
  )
}

function Group({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-3 last:mb-0" aria-label={title}>
      <h3 className="mb-1 flex items-center gap-2 px-3 text-xs font-semibold tracking-wide text-gold uppercase">
        <span aria-hidden>{icon}</span>
        {title}
      </h3>
      <ul>{children}</ul>
    </section>
  )
}
