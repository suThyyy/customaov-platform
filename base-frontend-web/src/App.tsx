import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppProviders } from './context/AppContext'
import { AppShell } from './components/layout/AppShell'
import { RequireAuth } from './components/layout/RequireAuth'
import HomeGuest from './pages/HomeGuest'
import HomeUser from './pages/HomeUser'
import RoomDetail from './pages/RoomDetail'
import CreateRoom from './pages/CreateRoom'
import Tournaments from './pages/Tournaments'
import TournamentDetail from './pages/TournamentDetail'
import Profile from './pages/Profile'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomeGuest />} />
          <Route element={<AppShell />}>
            {/* Công khai: khách xem được */}
            <Route path="/tournaments" element={<Tournaments />} />
            <Route path="/tournaments/:slug" element={<TournamentDetail />} />
            {/* Nội bộ: cần session (mock) — khách bị chuyển tới /?login=login&next=<route> */}
            <Route element={<RequireAuth />}>
              <Route path="/dashboard" element={<HomeUser />} />
              <Route path="/rooms/new" element={<CreateRoom />} />
              <Route path="/rooms/:roomId" element={<RoomDetail />} />
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
