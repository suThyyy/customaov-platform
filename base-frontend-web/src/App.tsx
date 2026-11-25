import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppProviders } from './context/AppContext'
import { AppShell } from './components/layout/AppShell'
import { RequireAuth } from './components/layout/RequireAuth'
import HomeGuest from './pages/HomeGuest'
import HomeUser from './pages/HomeUser'
import RoomDetail from './pages/RoomDetail'
import CreateRoom from './pages/CreateRoom'
import JoinRoom from './pages/JoinRoom'
import Tournaments from './pages/Tournaments'
import TournamentDetail from './pages/TournamentDetail'
import CreateTournament from './pages/CreateTournament'
import Profile from './pages/Profile'
import Activities from './pages/Activities'
import { RequireRole } from './components/layout/RequireRole'
import { MockPersonaSelector } from './components/layout/MockPersonaSelector'
import NotFound from './pages/NotFound'
import QuickTeam from './pages/QuickTeam'
import { DATA_SOURCE } from './api'

export default function App() {
  if (DATA_SOURCE === 'invalid') return <main className="p-8"><h1 className="text-2xl">Chưa cấu hình nguồn dữ liệu</h1><p>Đặt VITE_DATA_SOURCE thành supabase, api hoặc mock rồi khởi động lại ứng dụng.</p></main>
  return (
    <AppProviders>
      {DATA_SOURCE === 'mock' && <div role="status" className="bg-surface-2 p-2 text-center text-sm">Chế độ demo · Dữ liệu mẫu, không lưu lên máy chủ</div>}
      {DATA_SOURCE === 'supabase' && <div role="status" className="bg-surface-2 p-2 text-center text-sm">Auth, hồ sơ và phòng dùng Supabase. Giải đấu, hoạt động, tìm kiếm và chat chỉ là demo.</div>}
      <BrowserRouter>
        <MockPersonaSelector />
        <Routes>
          <Route path="/" element={<HomeGuest />} />
          <Route element={<AppShell />}>
            <Route path="/quick-team" element={<QuickTeam />} />
            <Route element={<RequireRole superAdmin />}>
              <Route path="/platform-admin" element={<section className="py-6"><h1 className="text-2xl">Quản trị nền tảng</h1><p>Quản lý quyền đang được phát triển. Chưa có thao tác quản trị tại đây.</p></section>} />
            </Route>
            {/* Công khai: khách xem được */}
            <Route path="/tournaments" element={<Tournaments />} />
            <Route element={<RequireRole />}>
              <Route path="/tournaments/new" element={<CreateTournament />} />
              <Route path="/rooms/new" element={<CreateRoom />} />
            </Route>
            <Route path="/tournaments/:slug" element={<TournamentDetail />} />
            {/* Nội bộ: cần session (mock) — khách bị chuyển tới /?login=login&next=<route> */}
            <Route element={<RequireAuth />}>
              <Route path="/dashboard" element={<HomeUser />} />
              <Route path="/activities" element={<Activities />} />
              <Route path="/rooms/:roomId" element={<RoomDetail />} />
              <Route path="/join/:inviteCode" element={<JoinRoom />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/profile/:userId" element={<Profile />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProviders>
  )
}
