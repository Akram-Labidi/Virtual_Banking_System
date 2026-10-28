import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ArrowLeftRight,
  CreditCard,
  Calculator,
  BookOpenCheck,
  ShieldAlert,
  Activity,
  FileCheck2,
  LogOut,
  Building2,
  UserCheck,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

export const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [simRunning, setSimRunning] = useState(false);

  useEffect(() => {
    const checkSim = async () => {
      try {
        const res = await api.get('/simulator/status');
        setSimRunning(res.data.isRunning);
      } catch (error) {
        console.error('Unable to fetch simulator status', error);
      }
    };
    checkSim();
    const interval = setInterval(checkSim, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/', label: 'Tableau de Bord', icon: LayoutDashboard },
    { to: '/transfers', label: 'Virements & Dépôts', icon: ArrowLeftRight },
    { to: '/accounts', label: 'Comptes & Cartes', icon: CreditCard },
    { to: '/loans', label: 'Prêts & Amortissement', icon: Calculator },
    ...(user?.role !== 'CLIENT'
      ? [
          { to: '/ledger', label: 'Grand Livre (Ledger)', icon: BookOpenCheck },
          { to: '/fraud', label: 'Surveillance Fraude', icon: ShieldAlert },
          { to: '/simulator', label: 'Simulateur Trafic', icon: Activity, badge: simRunning ? 'LIVE' : undefined },
          { to: '/audit', label: 'Audit Immuable', icon: FileCheck2 },
        ]
      : []),
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-slate-800/80 bg-slate-900/60 flex flex-col justify-between p-4">
        <div>
          {/* Logo */}
          <div className="flex items-center gap-3 px-2 py-4 mb-4 border-b border-slate-800">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-sky-200 to-sky-400 bg-clip-text text-transparent">
                AuraBank
              </span>
              <div className="flex items-center gap-1.5 text-[10px] text-sky-400 font-mono tracking-wider uppercase">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Core Engine 2.0
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-sky-600/20 text-sky-400 border border-sky-500/30 shadow-sm'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                    }`
                  }
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* User Card */}
        <div className="border-t border-slate-800/80 pt-4 space-y-3">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sky-400 font-bold text-xs">
                {user?.firstName?.[0] || 'U'}{user?.lastName?.[0] || 'B'}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold truncate text-slate-200">
                  {user?.firstName} {user?.lastName}
                </p>
                <span className="inline-block px-1.5 py-0.2 text-[9px] font-mono rounded bg-slate-800 text-sky-400 border border-slate-700">
                  {user?.role}
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Se déconnecter"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-14 border-b border-slate-800/80 bg-slate-900/40 backdrop-blur px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <span className="text-slate-500">SYSTEM:</span>
            <span className="text-emerald-400 font-semibold">ACID_COMPLIANT</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-500">ISOLATION:</span>
            <span className="text-sky-400">PESSIMISTIC_LOCKS</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-500">LEDGER:</span>
            <span className="text-purple-400">DOUBLE_ENTRY</span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            {simRunning && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                Trafic en cours
              </span>
            )}
            <a
              href="http://localhost:3000/api/docs"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs transition"
            >
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              API Docs (Swagger)
            </a>
          </div>
        </header>

        {/* Scrollable Page Outlet */}
        <main className="flex-1 overflow-y-auto p-6 bg-slate-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
