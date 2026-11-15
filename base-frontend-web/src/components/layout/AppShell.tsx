import { useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { Container } from './Container'
import { Footer } from './Footer'
import { TopNav } from './TopNav'
import { useRouteScroll } from './hooks'

/** Trang công cụ dùng container rộng 1440px (chi tiết phòng); còn lại 1200px */
const isWideRoute = (pathname: string) => /^\/rooms\/[^/]+$/.test(pathname) && pathname !== '/rooms/new'

/** Khung cho các trang nội bộ: TopNav sticky + nội dung căn giữa + Footer (+ BottomNav trên mobile) */
export function AppShell() {
  const { pathname } = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  useRouteScroll(mainRef)

  return (
    <div className="pb-bottom-nav flex min-h-dvh flex-col bg-bg">
      <SkipLink />
      <TopNav />
      <main id="main" ref={mainRef} tabIndex={-1} className="min-w-0 flex-1 outline-none">
        <Container wide={isWideRoute(pathname)}>
          <Outlet />
        </Container>
      </main>
      <Footer />
      <BottomNav />
    </div>
  )
}

/** Link "Bỏ qua tới nội dung chính" — hiện khi focus bằng bàn phím */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only z-[200] rounded-btn bg-gold px-3 py-2 text-gold-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
    >
      Bỏ qua tới nội dung chính
    </a>
  )
}
