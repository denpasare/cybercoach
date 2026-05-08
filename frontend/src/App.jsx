import { Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { LayoutDashboard, Search, Flame } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Scrape from './pages/Scrape';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Flame className="text-brand-500" size={24} />
              <span className="font-bold text-xl text-gray-900">Airbnb Lead Scraper</span>
              <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-medium ml-1">
                Miami
              </span>
            </div>
            <nav className="flex items-center gap-1">
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-50 text-brand-600'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`
                }
              >
                <LayoutDashboard size={16} />
                Dashboard
              </NavLink>
              <NavLink
                to="/scrape"
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-50 text-brand-600'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`
                }
              >
                <Search size={16} />
                Scrape
              </NavLink>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/scrape" element={<Scrape />} />
        </Routes>
      </main>
    </div>
  );
}
