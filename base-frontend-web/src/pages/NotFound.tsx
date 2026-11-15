import { Compass } from 'lucide-react'
import { ButtonLink } from '../components/ui/Button'
import { EmptyState } from '../components/domain/EmptyState'

export default function NotFound() {
  return (
    <EmptyState
      as="h1"
      className="mt-8 min-h-96"
      icon={<Compass size={28} />}
      title="Không tìm thấy trang"
      description="Đường dẫn không tồn tại hoặc đã bị thay đổi."
      action={<ButtonLink to="/">Về trang chủ</ButtonLink>}
    />
  )
}
