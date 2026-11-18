import { useCallback, useEffect, useId, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Gamepad2, Search, Trophy, UserRound } from 'lucide-react'
import { SEARCH_MIN_LENGTH, roomFullTitle, searchAdapter, useSearch } from '../../api'
import { cn } from '../../lib/cn'
import { Modal } from '../ui/Modal'
import { ListStatus, SkeletonRows } from '../ui/ListStatus'
import { SampleDataBadge } from '../ui/SampleDataBadge'

interface Hit {
  key: string
  to: string
  label: string
  sub: string
}

interface HitGroup {
  title: string
  icon: ReactNode
  hits: Hit[]
}

/**
 * Hộp tìm kiếm toàn cục (mở bằng Ctrl/⌘ K hoặc nút tìm kiếm ở TopNav, đóng bằng Esc).
 * - mock: lọc trên mock data, ô trống hiện gợi ý.
 * - nguồn api: `GET /api/search?q=` (debounce 250ms, huỷ request cũ), cần ≥ 2 ký tự.
 * Bàn phím: ↑/↓ chọn kết quả, Enter mở kết quả đang chọn (focus luôn ở ô nhập – mẫu combobox).
 */
export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const search = useSearch(query)
  const navigate = useNavigate()
  const baseId = useId()
  const listboxId = `${baseId}-results`
  const optionId = (index: number) => `${baseId}-option-${index}`

  const groups = useMemo<HitGroup[]>(() => {
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

  const hits = useMemo(() => groups.flatMap((g) => g.hits), [groups])
  const status = search.pending ? 'loading' : search.status
  const showList = !search.tooShort && status === 'ready' && hits.length > 0

  // Chỉ số kết quả đang chọn; gắn với danh sách hiện tại nên đổi kết quả là tự về 0.
  const [active, setActive] = useState<{ hits: Hit[]; index: number }>({ hits, index: 0 })
  const activeIndex = active.hits === hits ? Math.min(active.index, hits.length - 1) : 0
  const activeId = showList && activeIndex >= 0 ? optionId(activeIndex) : undefined

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView?.({ block: 'nearest' })
  }, [activeId])

  // Phải ổn định: Modal dùng onClose trong deps của effect quản lý focus
  const close = useCallback(() => {
    setQuery('')
    onClose()
  }, [onClose])

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!showList) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActive({ hits, index: (activeIndex + step + hits.length) % hits.length })
    } else if (e.key === 'Enter') {
      const hit = hits[activeIndex]
      if (!hit) return
      e.preventDefault()
      navigate(hit.to)
      close()
    }
  }

  const trimmed = query.trim()
  let flatIndex = 0

  return (
    <Modal open={open} onClose={close} title="Tìm kiếm" placement="top" className="max-w-[560px]">
      <SampleDataBadge show={searchAdapter.showsSampleBadge} className="mb-3" />
      <form role="search" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="global-search" className="sr-only">
          Tìm phòng, người chơi, giải đấu
        </label>
        <div className="flex h-11 items-center gap-3 rounded-btn border border-line-strong bg-surface-2 px-3.5 transition-colors focus-within:border-gold/60">
          <Search size={18} aria-hidden className="shrink-0 text-fg-muted" />
          <input
            id="global-search"
            data-autofocus
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showList}
            aria-controls={listboxId}
            aria-activedescendant={activeId}
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Tìm phòng, người chơi, giải đấu..."
            className="h-full min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-muted"
          />
          <kbd className="hidden rounded-btn bg-surface-3 px-2 py-0.5 font-sans text-xs text-fg-muted sm:inline">Esc</kbd>
        </div>
      </form>

      <div className="mt-4 max-h-[55vh] overflow-y-auto" aria-live="polite">
        {search.tooShort ? (
          <p className="py-8 text-center text-sm text-fg-muted">
            Nhập ít nhất {SEARCH_MIN_LENGTH} ký tự để tìm phòng, giải đấu, người chơi.
          </p>
        ) : (
          <ListStatus status={status} onRetry={search.retry} label="kết quả tìm kiếm" skeleton={<SkeletonRows count={3} />}>
            {groups.length === 0 ? (
              <p className="py-8 text-center text-sm text-fg-muted">Không tìm thấy kết quả cho "{trimmed}".</p>
            ) : (
              <>
                {!trimmed && <p className="mb-2 text-xs text-fg-muted">Gợi ý</p>}
                <div id={listboxId} role="listbox" aria-label="Kết quả tìm kiếm">
                  {groups.map((g, gi) => (
                    <Group key={g.title} id={`${baseId}-group-${gi}`} title={g.title} icon={g.icon}>
                      {g.hits.map((h) => {
                        const index = flatIndex++
                        const selected = index === activeIndex
                        return (
                          <Link
                            key={h.key}
                            id={optionId(index)}
                            role="option"
                            aria-selected={selected}
                            tabIndex={-1}
                            to={h.to}
                            onClick={close}
                            onMouseMove={() => {
                              if (!selected) setActive({ hits, index })
                            }}
                            className={cn(
                              'flex min-h-11 flex-col justify-center rounded-btn px-3 py-1.5 transition-colors hover:bg-white/5',
                              selected && 'bg-white/5 ring-1 ring-gold/40 ring-inset',
                            )}
                          >
                            <span className="text-sm font-medium text-fg">{h.label}</span>
                            <span className="text-xs text-fg-muted">{h.sub}</span>
                          </Link>
                        )
                      })}
                    </Group>
                  ))}
                </div>
              </>
            )}
          </ListStatus>
        )}
      </div>
    </Modal>
  )
}

function Group({ id, title, icon, children }: { id: string; title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div role="group" aria-labelledby={id} className="mb-3 last:mb-0">
      <div id={id} className="mb-1 flex items-center gap-2 px-3 text-xs font-semibold tracking-wide text-gold uppercase">
        <span aria-hidden>{icon}</span>
        {title}
      </div>
      <div className="flex flex-col">{children}</div>
    </div>
  )
}
