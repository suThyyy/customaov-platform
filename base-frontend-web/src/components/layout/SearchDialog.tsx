import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Gamepad2, Search, Trophy, UserRound } from 'lucide-react'
import { roomFullTitle, useSearch } from '../../api'
import { Modal } from '../ui/Modal'
import { ListStatus, SkeletonRows } from '../ui/ListStatus'

interface Hit {
  key: string
  to: string
  label: string
  sub: string
}

/**
 * Hộp tìm kiếm toàn cục (mở bằng Ctrl/⌘ K hoặc nút tìm kiếm ở TopNav, đóng bằng Esc).
 * Tìm trên mock data. TODO: thay bằng API tìm kiếm khi có backend.
 */
export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const search = useSearch(query)

  const groups = useMemo(() => {
    const roomHits: Hit[] = search.data.rooms
      .map((r) => ({ key: r.id, to: `/rooms/${r.id}`, label: roomFullTitle(r), sub: `#${r.id} · ${r.modeLabel}` }))
    const tourHits: Hit[] = search.data.tournaments
      .map((t) => ({ key: t.slug, to: `/tournaments/${t.slug}`, label: t.name, sub: t.timeLabel }))
    const playerHits: Hit[] = search.data.players
      .map((p) => ({ key: p.id, to: `/profile/${p.id}`, label: p.name, sub: 'Người chơi' }))
    return [
      { title: 'Phòng', icon: <Gamepad2 size={16} />, hits: roomHits },
      { title: 'Giải đấu', icon: <Trophy size={16} />, hits: tourHits },
      { title: 'Người chơi', icon: <UserRound size={16} />, hits: playerHits },
    ].filter((g) => g.hits.length > 0)
  }, [search.data])

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
        <ListStatus status={search.status} onRetry={search.retry} label="kết quả tìm kiếm" skeleton={<SkeletonRows count={3} />}>
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
        </ListStatus>
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
