// @deprecated – thay bằng TopNav (UI refactor 11/2026)
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, ChevronDown, LogOut, Search, UserRound } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useAuth, useToast } from '../../context/AppContext'
import { currentUser } from '../../mocks'
import { Avatar, LevelPill } from '../ui/primitives'

export function Topbar() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const { comingSoon, notify } = useToast()
  const searchRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')

  // Ctrl/⌘ + K để focus ô tìm kiếm
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Đóng menu khi click ra ngoài
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    if (!query.trim()) {
      searchRef.current?.focus()
      return
    }
    comingSoon(`Tìm kiếm "${query.trim()}"`)
  }

  return (
    <header className="flex h-[66px] items-center justify-between gap-6 pr-10 pl-[27px]">
      <form role="search" onSubmit={onSearch} className="w-[513px]">
        <label htmlFor="global-search" className="sr-only">
          Tìm phòng, người chơi, giải đấu
        </label>
        <div className="group flex h-10 items-center gap-3 rounded-[10px] border border-line bg-surface-2/80 pr-2 pl-4 transition-colors focus-within:border-gold/60 hover:border-line-strong">
          <Search size={19} aria-hidden className="text-fg-muted" />
          <input
            ref={searchRef}
            id="global-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm phòng, người chơi, giải đấu..."
            className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-fg outline-none placeholder:text-fg-muted"
          />
          <kbd className="rounded-md bg-surface-3 px-2 py-0.5 font-sans text-[12px] text-fg-muted ring-1 ring-white/5">
            Ctrl K
          </kbd>
        </div>
      </form>

      <div className="flex items-center gap-7">
        <button
          type="button"
          onClick={() => comingSoon('Thông báo')}
          aria-label="Thông báo (có thông báo mới)"
          className="relative grid size-10 place-items-center rounded-full text-fg transition-colors hover:bg-white/5"
        >
          <Bell size={23} aria-hidden strokeWidth={1.8} />
          <span aria-hidden className="absolute top-[7px] right-[8px] size-2 rounded-full bg-notify ring-2 ring-bg" />
        </button>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-3 rounded-[12px] py-1 pr-1 pl-1 transition-colors hover:bg-white/5"
          >
            <Avatar src={currentUser.avatar} alt="" size={42} rounded="lg" />
            <span className="flex flex-col items-start gap-0.5">
              <span className="text-[14px] leading-none font-semibold">{currentUser.name}</span>
              <LevelPill level={currentUser.level ?? 1} />
            </span>
            <ChevronDown
              size={16}
              aria-hidden
              className={cn('-mt-4 ml-1 text-fg-muted transition-transform', menuOpen && 'rotate-180')}
            />
          </button>

          {menuOpen && (
            <div
              role="menu"
              aria-label="Tài khoản"
              className="absolute top-[calc(100%+8px)] right-0 z-50 w-[220px] rounded-[12px] border border-line-strong bg-surface-2 p-1.5 shadow-[0_16px_40px_-12px_rgb(0_0_0/0.8)] [animation:pop-in_160ms_var(--ease-out-soft)]"
            >
              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  navigate('/profile')
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[14px] transition-colors hover:bg-white/5"
              >
                <UserRound size={17} aria-hidden className="text-gold" /> Hồ sơ của tôi
              </button>
              <div className="my-1 h-px bg-line" />
              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  logout()
                  notify('Đã đăng xuất (giả lập)', 'Bạn đang xem giao diện khách.')
                  navigate('/')
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[14px] text-fg-muted transition-colors hover:bg-white/5 hover:text-fg"
              >
                <LogOut size={17} aria-hidden /> Đăng xuất (giả lập)
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
