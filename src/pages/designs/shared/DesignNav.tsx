import { Link, useLocation } from 'react-router';

const variants = [
  { path: '/v1', label: '1' },
  { path: '/v2', label: '2' },
  { path: '/v3', label: '3' },
  { path: '/v4', label: '4' },
];

export function DesignNav() {
  const location = useLocation();
  const isAdmin = location.pathname.includes('/admin');

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-1 rounded-full bg-black/80 px-3 py-2 text-xs text-white shadow-lg backdrop-blur">
      <span className="mr-2 text-white/60 hidden sm:inline">Дизайны:</span>
      {variants.map((v) => {
        const target = isAdmin ? `${v.path}/admin` : v.path;
        const active = location.pathname === target;
        return (
          <Link
            key={v.path}
            to={target}
            className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
              active
                ? 'bg-[#7856FF] text-white'
                : 'bg-white/10 text-white/80 hover:bg-white/20'
            }`}
            title={`Вариант ${v.label}`}
          >
            {v.label}
          </Link>
        );
      })}
      <Link
        to="/"
        className="ml-2 text-white/60 hover:text-white transition-colors"
        title="На основной дашборд"
      >
        ×
      </Link>
    </div>
  );
}
