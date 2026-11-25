import { useState } from 'react'
import { communityService } from '../../api/community'
import { canManageCommunity, type Community, type CommunityActor } from '../../mocks/communities'
import { Button } from '../ui/Button'
import { Card } from '../ui/primitives'

export function CommunityAnnouncements({ community, actor }: { community: Community; actor: CommunityActor | null }) {
  const [editing, setEditing] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const change = (action: Parameters<typeof communityService.change>[2]) => {
    try { communityService.change(community.id, actor, action); setError(''); setMessage('Đã cập nhật thông báo.'); setEditing(null) }
    catch (e) { setError(e instanceof Error ? e.message : 'Không thể cập nhật thông báo.') }
  }
  return <Card className="space-y-4 p-6">
    <h2 className="text-lg">Thông báo cộng đồng</h2>
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    {!community.announcements.length && <p>Chưa có thông báo.</p>}
    {community.announcements.map(post => <article key={post.id} className="space-y-3 border-b border-line py-4">
      <p className="whitespace-pre-wrap break-words">{post.title}</p><p className="text-sm text-fg-muted">{post.author} · Ban quản lý</p>
      {canManageCommunity(community, actor) && post.authorId === actor?.id && <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={() => { setEditing(post.id); setText(post.title); setError('') }}>Sửa thông báo</Button>
        <Button variant="ghost" onClick={() => { if (window.confirm('Xóa thông báo này?')) change({ type: 'deleteAnnouncement', id: post.id }) }}>Xóa thông báo</Button>
      </div>}
      {editing === post.id && canManageCommunity(community, actor) && post.authorId === actor?.id && <form className="space-y-3" onSubmit={e => { e.preventDefault(); change({ type: 'editAnnouncement', id: post.id, title: text }) }}>
        <label className="block">Nội dung thông báo<textarea required maxLength={1000} className="w-full rounded-btn border border-line bg-surface p-3" value={text} onChange={e => setText(e.target.value)} /></label>
        <Button variant="outline" type="submit">Lưu thông báo</Button><Button variant="ghost" onClick={() => setEditing(null)}>Hủy</Button>
      </form>}
    </article>)}
  </Card>
}
