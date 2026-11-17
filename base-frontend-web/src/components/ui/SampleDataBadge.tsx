import { Badge } from './primitives'

export function SampleDataBadge({ show, className }: { show?: boolean; className?: string }) {
  if (!show) return null
  return <Badge tone="neutral" className={className}>Dữ liệu mẫu</Badge>
}
