import { startTransition } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { useAuth, useToast } from '../context/AppContext'
import { currentUser } from '../api'
import { Button } from './ui/Button'
import { Modal } from './ui/Modal'
import { Avatar, LevelPill } from './ui/primitives'

export type LoginIntent = 'login' | 'register' | 'start'

const TITLES: Record<LoginIntent, string> = {
  login: 'Đăng nhập',
  register: 'Đăng ký tài khoản',
  start: 'Bắt đầu với customAOV',
}

/**
 * Đăng nhập/đăng ký thật đang phát triển.
 * Modal cho phép giả lập đăng nhập bằng tài khoản mẫu để xem giao diện người dùng.
 */
export function LoginModal({
  intent,
  onClose,
  redirectTo = '/dashboard',
}: {
  intent: LoginIntent | null
  onClose: () => void
  redirectTo?: string
}) {
  const { login } = useAuth()
  const { notify } = useToast()
  const navigate = useNavigate()

  return (
    <Modal open={intent !== null} onClose={onClose} title={intent ? TITLES[intent] : ''}>
      <p className="text-sm leading-relaxed text-fg-muted">
        Tính năng {intent === 'register' ? 'đăng ký' : 'đăng nhập'} thật đang phát triển. Bạn có thể vào bằng tài
        khoản mẫu để xem giao diện người dùng.
      </p>
      <div className="mt-5 flex items-center gap-3 rounded-btn border border-line bg-surface-2 p-3">
        <Avatar src={currentUser.avatar} alt="" size={44} rounded="lg" />
        <div className="flex flex-col gap-1">
          <span className="text-base font-semibold">{currentUser.name}</span>
          <LevelPill level={currentUser.level ?? 1} className="self-start" />
        </div>
        <span className="ml-auto text-xs text-fg-subtle">Tài khoản mẫu</span>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>
          Để sau
        </Button>
        <Button
          data-autofocus
          leftIcon={<LogIn size={17} aria-hidden />}
          onClick={() => {
            notify('Đã đăng nhập (giả lập)', `Xin chào ${currentUser.name}!`)
            // Không gọi onClose trước: onClose xoá query ?next= ở landing và làm mất trang cần quay lại.
            // Điều hướng đi sẽ tự gỡ modal.
            navigate(redirectTo, { replace: true })
            // login phải nằm cùng transition với điều hướng (React Router v7 dùng startTransition).
            // Nếu gọi login() đồng bộ, landing render <Navigate> (= null) trong lúc chờ → trang trắng.
            startTransition(login)
          }}
        >
          Vào bằng tài khoản mẫu
        </Button>
      </div>
    </Modal>
  )
}
