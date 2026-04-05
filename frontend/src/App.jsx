import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  NavLink,
  Outlet,
  Link,
} from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import Scan from './pages/Scan';
import ProfileSetup from './pages/ProfileSetup';
import Dashboard from './pages/Dashboard';
import HistoryPage from './pages/HistoryPage';
import MealPlanner from './pages/MealPlanner';
import Community from './pages/Community';

export const PROFILE_KEY = 'healthProfile';

export function loadHealthProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function hasHealthProfile() {
  return loadHealthProfile() != null;
}

function TopNav() {
  const profile = loadHealthProfile();
  const name = profile?.displayName?.trim() || 'You';
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="glass-nav sticky top-0 z-50">
      <div className="foodsync-content mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link to="/dashboard" className="flex min-w-0 items-center gap-2">
          <span className="font-display text-lg font-extrabold tracking-tight text-text sm:text-xl">
            FoodSync
            <span className="font-semibold text-muted">: Health Scanner</span>
          </span>
        </Link>

        <nav className="flex flex-wrap items-center justify-center gap-4 sm:gap-7">
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `nav-link-fs ${isActive ? 'active' : ''}`}
            end
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/history"
            className={({ isActive }) => `nav-link-fs ${isActive ? 'active' : ''}`}
          >
            My scans
          </NavLink>
          <NavLink
            to="/meal"
            className={({ isActive }) => `nav-link-fs ${isActive ? 'active' : ''}`}
          >
            Meal planner
          </NavLink>
          <NavLink
            to="/community"
            className={({ isActive }) => `nav-link-fs ${isActive ? 'active' : ''}`}
          >
            Community
          </NavLink>
        </nav>

        <Link
          to="/profile"
          className="flex items-center gap-2 rounded-full border border-glass-border bg-white/40 py-1.5 pl-1.5 pr-3 backdrop-blur-md transition-colors hover:bg-white/60"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-sage to-sage-dark text-xs font-bold text-white shadow-sm">
            {initials}
          </span>
          <span className="hidden max-w-[120px] truncate text-sm font-semibold text-text sm:inline">
            {name}
          </span>
          <ChevronDown className="h-4 w-4 text-muted" />
        </Link>
      </div>
    </header>
  );
}

function AppShell() {
  return (
    <div className="foodsync-shell min-h-screen">
      <TopNav />
      <main className="foodsync-content min-h-[calc(100vh-4rem)]">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function SetupHeader() {
  return (
    <header className="glass-nav">
      <div className="foodsync-content mx-auto max-w-6xl px-4 py-3 sm:px-6">
        <span className="font-display text-lg font-extrabold tracking-tight text-text sm:text-xl">
          FoodSync<span className="font-semibold text-muted">: Health Scanner</span>
        </span>
      </div>
    </header>
  );
}

function RequireProfile() {
  if (!hasHealthProfile()) {
    return <Navigate to="/setup" replace />;
  }
  return <Outlet />;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route
          path="/setup"
          element={
            <div className="foodsync-shell min-h-screen">
              <SetupHeader />
              <div className="foodsync-content mx-auto max-w-2xl px-4 py-10 sm:px-6">
                <ProfileSetup />
              </div>
            </div>
          }
        />
        <Route element={<RequireProfile />}>
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/scan" element={<Scan />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/profile" element={<ProfileSetup />} />
            <Route path="/meal" element={<MealPlanner />} />
            <Route path="/community" element={<Community />} />
          </Route>
        </Route>
        <Route
          path="/"
          element={<Navigate to={hasHealthProfile() ? '/dashboard' : '/setup'} replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
