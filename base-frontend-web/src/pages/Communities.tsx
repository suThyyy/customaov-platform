import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { UsersRound, Shield, Trophy } from 'lucide-react'
import { communityService, useCommunities } from '../api/community'
import { DATA_SOURCE } from '../api'
import { useAuth } from '../context/AppContext'
import { canManageCommunity, communityPersonas, type CommunityActor } from '../mocks/communities'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/primitives'
import { Button, ButtonLink } from '../components/ui/Button'
import { normalizeVi } from '../lib/text'
import { CommunityAnnouncements } from '../components/domain/CommunityAnnouncements'

const field = 'w-full min-w-0 rounded-btn border border-line bg-surface-2 p-3 text-base'
const roleLabel = { owner: 'Chủ cộng đồng', manager: 'Quản lý', member: 'Thành viên' }
export default function Communities() {
  const communities = useCommunities()
  const { communityId } = useParams()
  const navigate = useNavigate()
  const { loggedIn, role } = useAuth()
  const [adminIdentity, setAdminIdentity] = useState(() => {
    try { return sessionStorage.getItem('customaov.community-admin') === 'other' ? 'other' : 'owner' } catch { return 'owner' }
  })
  const persona = role === 'admin' ? adminIdentity : role === 'super_admin' ? 'platform' : 'member'
  useEffect(() => {
    if (DATA_SOURCE === 'mock') {
      try { sessionStorage.setItem('customaov.community-admin', adminIdentity) } catch { /* Keep in-memory identity. */ }
    }
  }, [adminIdentity])
  const actor: CommunityActor | null = loggedIn && DATA_SOURCE === 'mock' && role ? communityPersonas.find(p => p.id === persona) ?? null : null
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') ?? 'overview'
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState(params.get('filter') === 'managed' ? 'managed' : 'all')
  const [visibility, setVisibility] = useState('all')
  const [sort, setSort] = useState('name')
  const [message, setMessage] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const [confirmLeave, setConfirmLeave] = useState(false)
  const community = communities.find(c => c.id === communityId)
  const manage = community && canManageCommunity(community, actor)
  const act = (fn: () => void) => { try { fn(); setMessage('Đã cập nhật dữ liệu mẫu trong phiên này.') } catch (e) { setMessage(e instanceof Error ? e.message : 'Không thể thực hiện.') } }
  const member = community?.members.find(m => m.id === actor?.id)
  const request = community?.requests.find(r => r.id === actor?.id)
  const showPrivate = community && (!community.private || member || manage)
  const tabs = [['overview', 'Tổng quan'], ['members', 'Thành viên'], ['activity', 'Hoạt động'], ['tournaments', 'Giải đấu'], ['rules', 'Nội quy'], ...(manage ? [['manage', 'Quản lý']] : [])]
  return <div className="min-w-0 space-y-6 py-6">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-gold/30 bg-gold-tint p-4 text-sm">
      <p>Dữ liệu cộng đồng mẫu · Lưu trên trình duyệt này, chưa kết nối máy chủ.</p>
      {DATA_SOURCE === 'mock' && <Button variant="ghost" onClick={() => {
        if (window.confirm('Khôi phục cộng đồng mẫu? Các thay đổi cộng đồng trên trình duyệt này sẽ bị xóa.')) {
          communityService.resetDemo(); setMessage('Đã khôi phục cộng đồng mẫu.'); navigate('/communities')
        }
      }}>Khôi phục cộng đồng mẫu</Button>}
      {loggedIn && DATA_SOURCE === 'mock' && role === 'admin' && <label>MOCK · Danh tính quản trị viên<select className={field} value={adminIdentity} onChange={e => { setAdminIdentity(e.target.value); setMessage(''); setConfirmLeave(false) }}>{communityPersonas.filter(p => p.role === 'admin').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
    </div>
    <PageHeader title={community?.name ?? (communityId === 'new' ? 'Tạo cộng đồng' : 'Cộng đồng')} description={community?.description ?? 'Kết nối đồng đội. Cùng xây dựng dấu ấn thi đấu của bạn.'} />
    {message && <p role="status" className="rounded-card border border-line p-4">{message}</p>}
    {communityId === 'new' ? actor && actor.role !== 'user' ? <CommunityForm onSave={input => act(() => { const id = communityService.create(actor, input); navigate(`/communities/${id}`) })} /> : <p role="alert">Đăng nhập bằng quản trị viên mẫu để tạo cộng đồng.</p> : communityId && !community ? <p role="alert">Không tìm thấy cộng đồng. <Link to="/communities" className="text-gold">Khám phá cộng đồng</Link></p> : community ? <>
      <div className="flex flex-wrap gap-3"><ButtonLink to="/communities" variant="ghost">Tất cả cộng đồng</ButtonLink><span className="rounded-full bg-surface-3 px-4 py-2 text-sm">{community.private ? 'Riêng tư' : 'Công khai'} · {community.members.length} thành viên</span><span className="py-2 text-sm">Chủ cộng đồng: {community.members.find(m => m.id === community.owner)?.name}</span>
        {member ? <span className="py-2 text-gold">{roleLabel[member.role]}</span> : request?.status === 'pending' ? <span className="py-2 text-warning">Chờ duyệt</span> : actor ? <Button onClick={() => act(() => communityService.change(community.id, actor, { type: 'join' }))}>{community.private ? 'Yêu cầu tham gia' : 'Tham gia cộng đồng'}</Button> : <ButtonLink variant="outline" to={`/?login=login&next=${encodeURIComponent(`/communities/${community.id}`)}`}>Đăng nhập để tham gia</ButtonLink>}
        {request?.status === 'rejected' && <p>Yêu cầu trước đã bị từ chối. Bạn có thể gửi lại.</p>}
        {member && actor?.id !== community.owner && <Button variant="outline" onClick={() => setConfirmLeave(true)}>Rời cộng đồng</Button>}
      </div>
      {confirmLeave && <section aria-label="Xác nhận rời cộng đồng" className="rounded-card border border-danger p-4"><p>Bạn muốn rời cộng đồng này?</p><Button variant="outline" onClick={() => act(() => { communityService.change(community.id, actor, { type: 'leave' }); setConfirmLeave(false) })}>Xác nhận rời</Button><Button variant="ghost" onClick={() => setConfirmLeave(false)}>Hủy</Button></section>}
      <nav aria-label="Nội dung cộng đồng" className="flex flex-wrap gap-2">{tabs.map(([id, label]) => <Button key={id} variant={tab === id ? 'gold-outline' : 'ghost'} onClick={() => { setParams({ tab: id }); setQuery('') }}>{label}</Button>)}</nav>
      {tab === 'overview' && <div className="grid min-w-0 gap-6 md:grid-cols-2"><Card className="space-y-4 p-6"><UsersRound className="text-gold" /><h2 className="text-lg">Cùng nhau tiến xa</h2><p>{community.description}</p><p className="text-fg-muted">{community.members.length} thành viên · {community.tournaments.length} giải đấu liên kết</p></Card><Card className="space-y-4 p-6"><Shield className="text-gold" /><h2 className="text-lg">Nội quy cộng đồng</h2><p className="whitespace-pre-wrap">{community.rules}</p></Card></div>}
      {tab === 'rules' && <Card className="whitespace-pre-wrap p-6">{community.rules}</Card>}
      {(tab === 'members' || tab === 'manage') && showPrivate && <Card className="space-y-4 p-6"><h2 className="text-lg">Thành viên</h2><input className={field} aria-label="Tìm thành viên" value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm tên thành viên" />{community.members.filter(m => normalizeVi(m.name).includes(normalizeVi(query))).map(m => <div key={m.id} className="flex min-w-0 flex-wrap items-center gap-3 border-b border-line py-3"><span className="min-w-0 flex-1 break-words">{m.name} · {roleLabel[m.role]}</span>{tab === 'manage' && actor?.id === community.owner && m.id !== community.owner && <><Button variant="outline" onClick={() => act(() => communityService.change(community.id, actor, { type: 'promote', member: m.id }))}>{m.role === 'manager' ? 'Gỡ quyền quản lý' : 'Giao quyền quản lý'}</Button><Button variant="ghost" onClick={() => { if (window.confirm(`Mời ${m.name} ra khỏi cộng đồng?`)) act(() => communityService.change(community.id, actor, { type: 'remove', member: m.id })) }}>Mời ra</Button></>}</div>)}</Card>}
      {(tab === 'members' || tab === 'activity') && !showPrivate && <p>Nội dung riêng tư. Tham gia và được duyệt để xem.</p>}
      {tab === 'activity' && showPrivate && <CommunityAnnouncements key={`${community.id}:${actor?.id ?? 'guest'}`} community={community} actor={actor} />}
      {tab === 'tournaments' && <Card className="space-y-4 p-6"><Trophy className="text-gold" /><h2 className="text-lg">Giải đấu cộng đồng</h2><p className="text-sm text-fg-muted">Liên kết giới thiệu mẫu; tham gia cộng đồng không tự đăng ký thi đấu.</p>{community.tournaments.map(t => <ButtonLink key={t.slug} variant="outline" to={`/tournaments/${t.slug}`}>{t.name}</ButtonLink>)}{!community.tournaments.length && <p>Chưa có giải đấu liên kết.</p>}<ButtonLink variant="ghost" to="/tournaments">Khám phá tất cả giải đấu</ButtonLink></Card>}
      {tab === 'manage' && manage && <div className="space-y-6"><CommunityForm initial={community} onSave={input => act(() => communityService.change(community.id, actor, { type: 'edit', ...input }))} /><Card className="space-y-4 p-6"><h2 className="text-lg">Yêu cầu tham gia</h2>{!community.requests.some(r => r.status === 'pending') && <p>Không có yêu cầu đang chờ.</p>}{community.requests.filter(r => r.status === 'pending').map(r => <div key={r.id} className="flex flex-wrap items-center gap-3"><span>{r.name}</span>{[true, false].map(approve => <Button variant="outline" key={String(approve)} onClick={() => act(() => communityService.change(community.id, actor, { type: 'review', member: r.id, approve }))}>{approve ? 'Duyệt' : 'Từ chối'}</Button>)}</div>)}</Card><form className="space-y-3" onSubmit={e => { e.preventDefault(); act(() => { communityService.change(community.id, actor, { type: 'announce', title: announcement }); setAnnouncement('') }) }}><label className="block">Thông báo mới<textarea required maxLength={1000} className={field} value={announcement} onChange={e => setAnnouncement(e.target.value)} /></label><Button variant="outline" type="submit">Đăng thông báo</Button></form></div>}
    </> : <>
      <div className="flex flex-wrap gap-3"><input className={field} aria-label="Tìm cộng đồng" placeholder="Tìm cộng đồng, đồng đội của bạn…" value={query} onChange={e => setQuery(e.target.value)} /><label>Danh sách<select className={field} value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Khám phá</option><option value="joined">Đã tham gia</option><option value="managed">Đang quản lý</option></select></label><label>Quyền truy cập<select className={field} value={visibility} onChange={e => setVisibility(e.target.value)}><option value="all">Tất cả</option><option value="public">Công khai</option><option value="private">Riêng tư</option></select></label><label>Sắp xếp<select className={field} value={sort} onChange={e => setSort(e.target.value)}><option value="name">Theo tên</option><option value="members">Số thành viên</option></select></label>{actor && actor.role !== 'user' && <ButtonLink to="/communities/new">Tạo cộng đồng</ButtonLink>}</div>
      <div className="grid min-w-0 gap-6 md:grid-cols-2 xl:grid-cols-3">{communities.filter(c => normalizeVi(c.name + c.description).includes(normalizeVi(query)) && (visibility === 'all' || c.private === (visibility === 'private')) && (filter === 'all' || filter === 'joined' && c.members.some(m => m.id === actor?.id) || filter === 'managed' && canManageCommunity(c, actor))).sort((a, b) => sort === 'members' ? b.members.length - a.members.length : a.name.localeCompare(b.name, 'vi')).map(c => <Card key={c.id} className="flex min-w-0 flex-col gap-4 p-6"><div className="flex items-center gap-3 text-gold"><UsersRound /><span className="text-sm">{c.private ? 'Riêng tư' : 'Công khai'}</span></div><h2 className="break-words text-lg font-semibold">{c.name}</h2><p className="flex-1 text-fg-muted">{c.description}</p><p className="text-sm">{c.members.length} thành viên · {c.tournaments.length} giải đấu</p><p className="text-sm">Chủ cộng đồng: {c.members.find(m => m.id === c.owner)?.name}</p><ButtonLink variant="outline" to={`/communities/${c.id}`}>{canManageCommunity(c, actor) ? 'Xem và quản lý' : c.members.some(m => m.id === actor?.id) ? 'Đã tham gia · Xem cộng đồng' : 'Xem cộng đồng'}</ButtonLink></Card>)}</div>
      {!communities.some(c => normalizeVi(c.name + c.description).includes(normalizeVi(query)) && (visibility === 'all' || c.private === (visibility === 'private')) && (filter === 'all' || filter === 'joined' && c.members.some(m => m.id === actor?.id) || filter === 'managed' && canManageCommunity(c, actor))) && <p role="status">Không tìm thấy cộng đồng phù hợp.</p>}
    </>}
  </div>
}

function CommunityForm({ initial, onSave }: { initial?: { name: string; description: string; rules: string; private: boolean }; onSave: (input: { name: string; description: string; rules: string; private: boolean }) => void }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [rules, setRules] = useState(initial?.rules ?? '')
  const [privateCommunity, setPrivate] = useState(initial?.private ?? false)
  return <form className="max-w-2xl space-y-4 rounded-card border border-line bg-surface p-6" onSubmit={e => { e.preventDefault(); onSave({ name, description, rules, private: privateCommunity }) }}><h2 className="text-lg">{initial ? 'Thông tin cộng đồng' : 'Xây dựng cộng đồng của bạn'}</h2><p className="text-sm text-fg-muted">Ảnh đại diện dùng biểu tượng thương hiệu. Nội dung biểu mẫu giữ khi bạn chỉnh sửa tại màn này.</p><label className="block">Tên cộng đồng<input required minLength={3} maxLength={80} className={field} value={name} onChange={e => setName(e.target.value)} /></label><label className="block">Mô tả<textarea required maxLength={500} className={field} value={description} onChange={e => setDescription(e.target.value)} /></label><label className="block">Nội quy<textarea required className={field} value={rules} onChange={e => setRules(e.target.value)} /></label><label className="block">Quyền truy cập<select className={field} value={String(privateCommunity)} onChange={e => setPrivate(e.target.value === 'true')}><option value="false">Công khai · tham gia ngay</option><option value="true">Riêng tư · cần duyệt yêu cầu</option></select></label><Button variant="outline" type="submit">{initial ? 'Lưu thông tin' : 'Tạo cộng đồng'}</Button></form>
}
