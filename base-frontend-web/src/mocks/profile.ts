import { asset } from '../lib/asset'
import { currentUser } from './players'
import type { UserProfile } from './types'

const items = (row: number): string[] => Array.from({ length: 6 }, (_, k) => asset(`item-${row}-${k}.jpg`))

export const profile: UserProfile = {
  player: { ...currentUser, avatar: asset('av-suthy-lg.png') },
  // Trước Phase 4c là "#AOV-1024" — trùng mã phòng AOV-1024
  publicId: '@suthy',
  uid: '102394',
  roleBadge: 'Chủ phòng (Host)',
  playerBadge: 'Người chơi Custom',
  bio: 'Custom vui là chính',
  // Khớp hoạt động a2 ("Theo dõi giải Custom League #3"); suthy chưa đăng ký Ngũ Kiệt Cup (promo vẫn mời đăng ký)
  bioExtra: 'Đang theo dõi giải Custom League #3',
  achievements: [
    { id: 'ac1', title: 'MVP 25 trận', description: 'Đạt MVP trong 25 trận custom.', date: '12/11/2026', icon: 'star' },
    { id: 'ac2', title: 'Chủ phòng chăm chỉ', description: 'Tổ chức 50 phòng custom.', date: '08/11/2026', icon: 'users' },
    { id: 'ac3', title: 'Chuỗi 5 trận thắng', description: 'Thắng 5 trận custom liên tiếp.', date: '02/11/2026', icon: 'swords' },
    // Khớp nhánh Cup Mùa Thu 2026: Bạch Hổ thua Team Xanh ở tứ kết (25/10)
    { id: 'ac4', title: 'Góp mặt Cup Mùa Thu 2026', description: 'Thi đấu cho Bạch Hổ, dừng ở tứ kết.', date: '25/10/2026', icon: 'trophy' },
  ],
  stats: { totalMatches: 128, winRate: 56.3, customMatches: 89, mvp: 27 },
  champions: [
    { name: 'Violet', image: asset('champ-violet.jpg'), avatar: asset('champ-av-violet.png'), matches: 36, winRate: 61 },
    { name: 'Lauriel', image: asset('champ-lauriel.jpg'), avatar: asset('champ-av-lauriel.png'), matches: 28, winRate: 57 },
    { name: 'Krixi', image: asset('champ-krixi.jpg'), avatar: asset('champ-av-krixi.png'), matches: 19, winRate: 63 },
    { name: "Tel'Annas", image: asset('champ-telannas.jpg'), matches: 16, winRate: 50 },
    { name: 'Yue', image: asset('champ-yue.jpg'), matches: 12, winRate: 58 },
  ],
  roles: [
    { role: 'Xạ Thủ', icon: 'ad', percent: 38 },
    { role: 'Pháp Sư', icon: 'mage', percent: 26 },
    { role: 'Đi Rừng', icon: 'jungle', percent: 18 },
    { role: 'Đường Giữa', icon: 'mid', percent: 11 },
    { role: 'Đỡ Đòn / Trợ Thủ', icon: 'tank', percent: 7 },
  ],
  history: [
    {
      id: 'h1',
      mode: 'Custom 5v5',
      roomName: 'Kèo giao hữu – Team A vs B',
      champion: { name: 'Violet', avatar: asset('champ-av-violet.png') },
      result: 'win',
      kda: [10, 2, 6],
      kdaRatio: 8.0,
      items: items(0),
      timeAgo: '18 phút trước',
    },
    {
      id: 'h2',
      mode: 'Custom 5v5',
      roomName: 'Giao hữu đội – Full Custom',
      champion: { name: 'Lauriel', avatar: asset('champ-av-lauriel.png') },
      result: 'win',
      kda: [8, 4, 12],
      kdaRatio: 5.0,
      items: items(1),
      timeAgo: '36 phút trước',
    },
    {
      id: 'h3',
      mode: 'Custom 5v5',
      roomName: 'Đấu tập – Cộng đồng',
      champion: { name: 'Krixi', avatar: asset('champ-av-krixi.png') },
      result: 'loss',
      kda: [3, 6, 5],
      kdaRatio: 1.3,
      items: items(2),
      timeAgo: '1 giờ trước',
    },
    {
      id: 'h4',
      mode: 'Custom 5v5',
      roomName: 'Kèo rank nội bộ',
      champion: { name: "Tel'Annas", avatar: asset('champ-telannas.jpg') },
      result: 'win',
      kda: [7, 3, 9],
      kdaRatio: 5.3,
      items: items(0),
      timeAgo: 'Hôm qua',
    },
    {
      id: 'h5',
      mode: 'Custom 3v3',
      roomName: 'Thử nghiệm tướng mới',
      champion: { name: 'Yue', avatar: asset('champ-yue.jpg') },
      result: 'loss',
      kda: [4, 5, 3],
      kdaRatio: 1.4,
      items: items(1),
      timeAgo: '2 ngày trước',
    },
    {
      id: 'h6',
      mode: 'Custom 5v5',
      roomName: 'Giao lưu cộng đồng #05',
      champion: { name: 'Violet', avatar: asset('champ-av-violet.png') },
      result: 'win',
      kda: [12, 1, 4],
      kdaRatio: 16.0,
      items: items(2),
      timeAgo: '3 ngày trước',
    },
  ],
}
