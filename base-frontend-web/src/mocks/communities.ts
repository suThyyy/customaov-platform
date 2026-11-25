export interface CommunityActor { id: string; name: string; role: 'user' | 'admin' | 'superadmin' }
export interface Community {
  id: string; name: string; description: string; rules: string; private: boolean; owner: string
  members: { id: string; name: string; role: 'owner' | 'manager' | 'member' }[]
  requests: { id: string; name: string; status: 'pending' | 'rejected' }[]
  announcements: { id: string; title: string; author: string; authorId?: string }[]
  tournaments: { slug: string; name: string }[]
}
export const communityPersonas: CommunityActor[] = [
  { id: 'member', name: 'Minh Anh', role: 'user' }, { id: 'owner', name: 'Suthy', role: 'admin' },
  { id: 'other', name: 'Hải Nam', role: 'admin' }, { id: 'platform', name: 'Quản trị nền tảng', role: 'superadmin' },
]
export const seedCommunities = (): Community[] => [
  { id: 'ngu-kiet', name: 'Ngũ Kiệt Arena', description: 'Tìm đồng đội, luyện chiến thuật và cùng chinh phục giải đấu cộng đồng.', rules: 'Tôn trọng đồng đội. Không gian lận. Có mặt đúng giờ thi đấu.', private: false, owner: 'owner', members: [{ id: 'owner', name: 'Suthy', role: 'owner' }, { id: 'member', name: 'Minh Anh', role: 'member' }], requests: [], announcements: [{ id: 'welcome', title: 'Chào mừng mùa giải mới! Cùng chuẩn bị đội hình năm người.', author: 'Suthy' }], tournaments: [{ slug: 'ngu-kiet-cup', name: 'Ngũ Kiệt Cup' }] },
  { id: 'chien-thuat', name: 'Phòng chiến thuật', description: 'Nhóm luyện tập riêng dành cho các đội muốn tiến xa hơn.', rules: 'Đăng ký trước khi tham gia buổi tập. Giữ kín chiến thuật của nhóm.', private: true, owner: 'other', members: [{ id: 'other', name: 'Hải Nam', role: 'owner' }], requests: [{ id: 'member', name: 'Minh Anh', status: 'pending' }], announcements: [], tournaments: [] },
  { id: 'sinh-vien', name: 'Liên Quân Sinh Viên', description: 'Kết nối người chơi sinh viên, giao lưu vui vẻ mỗi cuối tuần.', rules: 'Ứng xử văn minh và hỗ trợ người chơi mới.', private: false, owner: 'other', members: [{ id: 'other', name: 'Hải Nam', role: 'owner' }], requests: [], announcements: [], tournaments: [] },
]
export const canManageCommunity = (c: Community, actor: CommunityActor | null) => Boolean(actor && actor.role !== 'user' && c.members.some(m => m.id === actor.id && (m.role === 'owner' || m.role === 'manager')))
export type CommunityAction =
  | { type: 'join' | 'leave' }
  | { type: 'review'; member: string; approve: boolean }
  | { type: 'remove' | 'promote'; member: string }
  | { type: 'announce'; title: string }
  | { type: 'editAnnouncement'; id: string; title: string }
  | { type: 'deleteAnnouncement'; id: string }
  | { type: 'edit'; name: string; description: string; rules: string; private: boolean }
export function changeCommunity(c: Community, actor: CommunityActor | null, action: CommunityAction): Community {
  if (!actor) throw new Error('Đăng nhập để thực hiện thao tác này.')
  const next = structuredClone(c)
  const member = c.members.find(m => m.id === actor.id)
  if (action.type === 'join') {
    if (member || c.requests.some(r => r.id === actor.id && r.status === 'pending')) throw new Error('Bạn đã tham gia hoặc đang chờ duyệt.')
    next.requests = next.requests.filter(r => r.id !== actor.id)
    if (c.private) next.requests.push({ id: actor.id, name: actor.name, status: 'pending' })
    else next.members.push({ id: actor.id, name: actor.name, role: 'member' })
  } else if (action.type === 'leave') {
    if (c.owner === actor.id) throw new Error('Chủ cộng đồng không thể rời cộng đồng.')
    if (!member) throw new Error('Bạn chưa là thành viên.')
    next.members = next.members.filter(m => m.id !== actor.id)
  } else {
    if (!canManageCommunity(c, actor)) throw new Error('Bạn không có quyền quản lý cộng đồng này.')
    if (action.type === 'review') {
      const request = next.requests.find(r => r.id === action.member && r.status === 'pending')
      if (!request) throw new Error('Yêu cầu không còn chờ duyệt.')
      if (action.approve) { next.members.push({ id: request.id, name: request.name, role: 'member' }); next.requests = next.requests.filter(r => r.id !== request.id) }
      else request.status = 'rejected'
    } else if (action.type === 'remove' || action.type === 'promote') {
      if (action.member === c.owner || actor.id !== c.owner) throw new Error('Chỉ chủ cộng đồng có thể thay đổi vai trò hoặc mời thành viên ra. Không thể thay đổi chủ cộng đồng.')
      const target = next.members.find(m => m.id === action.member)
      if (!target) throw new Error('Không tìm thấy thành viên.')
      if (action.type === 'remove') next.members = next.members.filter(m => m.id !== action.member)
      else target.role = target.role === 'manager' ? 'member' : 'manager'
    } else if (action.type === 'announce') {
      if (!action.title.trim() || action.title.length > 1000) throw new Error('Thông báo cần từ 1 đến 1000 ký tự.')
      next.announcements.unshift({ id: crypto.randomUUID(), title: action.title.trim(), author: actor.name, authorId: actor.id })
    } else if (action.type === 'editAnnouncement' || action.type === 'deleteAnnouncement') {
      const post = next.announcements.find(p => p.id === action.id)
      if (!post || post.authorId !== actor.id) throw new Error('Bạn chỉ được sửa hoặc xóa thông báo do mình đăng.')
      if (action.type === 'deleteAnnouncement') next.announcements = next.announcements.filter(p => p.id !== action.id)
      else {
        if (!action.title.trim() || action.title.length > 1000) throw new Error('Thông báo cần từ 1 đến 1000 ký tự.')
        post.title = action.title.trim()
      }
    } else if (action.type === 'edit') {
      validateCommunity(action)
      Object.assign(next, { name: action.name.trim(), description: action.description.trim(), rules: action.rules.trim(), private: action.private })
    }
  }
  return next
}
export function validateCommunity(input: Pick<Community, 'name' | 'description' | 'rules'>) {
  if (input.name.trim().length < 3 || input.name.length > 80 || !input.description.trim() || input.description.length > 500 || !input.rules.trim()) throw new Error('Tên cần 3–80 ký tự, mô tả cần 1–500 ký tự và phải có nội quy.')
}
export function createCommunity(actor: CommunityActor | null, input: Pick<Community, 'name' | 'description' | 'rules' | 'private'>): Community {
  if (!actor || actor.role === 'user') throw new Error('Chỉ quản trị viên được tạo cộng đồng.')
  validateCommunity(input)
  return { ...input, name: input.name.trim(), id: crypto.randomUUID(), owner: actor.id, members: [{ id: actor.id, name: actor.name, role: 'owner' }], requests: [], announcements: [], tournaments: [] }
}
