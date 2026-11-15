import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Mail, MessageCircle, Share2 } from 'lucide-react'
import { useAuth } from '../../context/AppContext'
import { Brand } from './Brand'
import { Container } from './Container'
import { loginHref } from './nav'

/** Footer chung: liên kết, mạng xã hội, tuyên bố không liên kết với Garena/Tencent */
export function Footer() {
  const { loggedIn } = useAuth()
  const year = new Date().getFullYear()

  const columns: Array<{ title: string; links: Array<{ label: string; to?: string; href?: string }> }> = [
    {
      title: 'Sản phẩm',
      links: [
        { label: 'Tạo phòng custom', to: loggedIn ? '/rooms/new' : loginHref('start', '/rooms/new') },
        { label: 'Giải đấu cộng đồng', to: '/tournaments' },
        { label: 'Hồ sơ người chơi', to: loggedIn ? '/profile' : loginHref('login', '/profile') },
      ],
    },
    {
      title: 'Cộng đồng',
      // TODO: thay bằng link thật khi có kênh chính thức
      links: [
        { label: 'Discord', href: '#' },
        { label: 'Facebook', href: '#' },
        { label: 'YouTube', href: '#' },
      ],
    },
  ]

  return (
    <footer className="mt-16 border-t border-line bg-sidebar">
      <Container wide className="grid gap-8 py-10 md:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,1fr))]">
        <div className="flex flex-col gap-3">
          <Brand to={loggedIn ? '/dashboard' : '/'} variant="compact" />
          <p className="max-w-[44ch] text-sm leading-relaxed text-fg-muted">
            Nền tảng hỗ trợ chơi custom Liên Quân: tạo phòng, chia đội công bằng và tổ chức giải đấu cộng đồng.
          </p>
          <ul className="mt-1 flex gap-2" aria-label="Mạng xã hội">
            <SocialLink label="Discord" icon={<MessageCircle size={18} />} />
            <SocialLink label="Chia sẻ trang" icon={<Share2 size={18} />} />
            <SocialLink label="Liên hệ qua email" icon={<Mail size={18} />} />
          </ul>
        </div>

        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="text-sm font-semibold text-fg">{col.title}</h2>
            <ul className="mt-3 flex flex-col">
              {col.links.map((l) => (
                <li key={l.label}>
                  {l.to ? (
                    <Link to={l.to} className="inline-flex min-h-11 items-center text-sm text-fg-muted transition-colors hover:text-fg">
                      {l.label}
                    </Link>
                  ) : (
                    <a href={l.href} className="inline-flex min-h-11 items-center text-sm text-fg-muted transition-colors hover:text-fg">
                      {l.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </Container>

      <div className="border-t border-line">
        <Container wide className="flex flex-col gap-2 py-5 text-xs leading-relaxed text-fg-muted md:flex-row md:justify-between">
          <p>© {year} customAOV · Đấu Trường Lập Đội. Dự án cộng đồng phi lợi nhuận.</p>
          <p className="max-w-[72ch]">
            customAOV không liên kết, không được tài trợ hay xác nhận bởi Garena hoặc Tencent. Liên Quân Mobile và các
            tài sản liên quan thuộc về chủ sở hữu tương ứng.
          </p>
        </Container>
      </div>
    </footer>
  )
}

function SocialLink({ label, icon }: { label: string; icon: ReactNode }) {
  return (
    <li>
      {/* TODO: gắn URL mạng xã hội thật */}
      <a
        href="#"
        aria-label={label}
        className="grid size-11 place-items-center rounded-full border border-line text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
      >
        <span aria-hidden>{icon}</span>
      </a>
    </li>
  )
}
