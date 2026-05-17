import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const NAV = [
  { to: '/patients', label: 'Pacientes' },
  { to: '/reports', label: 'Relatórios' },
  { to: '/settings', label: 'Configurações' },
];

export function Layout() {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {isOpen && (
        <div
          data-testid="sidebar-backdrop"
          aria-hidden="true"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-20 bg-slate-900/50 md:hidden"
        />
      )}
      <aside
        role="complementary"
        data-open={isOpen}
        className={[
          'fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-slate-200 bg-white transition-transform duration-200',
          'md:static md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <div className="p-4 text-lg font-semibold">Physio Portal</div>
        <nav className="flex flex-1 flex-col gap-1 px-2">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setIsOpen(false)}
              className={({ isActive }) =>
                [
                  'rounded px-3 py-2 text-sm font-medium',
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col md:ml-0">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:px-6">
          <button
            type="button"
            aria-label={isOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={isOpen}
            onClick={() => setIsOpen((v) => !v)}
            className="-ml-1 rounded p-2 text-slate-700 hover:bg-slate-100 md:hidden"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              {isOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
          <span className="text-sm text-slate-600">{user?.fullName}</span>
          <button
            type="button"
            onClick={() => logout()}
            className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
          >
            Sair
          </button>
        </header>
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
