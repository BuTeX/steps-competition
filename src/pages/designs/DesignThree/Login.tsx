import { useState } from 'react';
import { ArrowLeft, Loader2, Shield } from 'lucide-react';
import { Link } from 'react-router';
import { useAdminAuth } from '@/hooks/useAdmin';
import { BrandLogo } from '../shared/BrandLogo';
import { PatternBg } from '../shared/PatternBg';
import { DesignNav } from '../shared/DesignNav';
import './theme.css';

interface LoginProps {
  onLogin?: () => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [password, setPassword] = useState('');
  const { login, loading, error } = useAdminAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(password);
    onLogin?.();
  };

  return (
    <div className="design-three min-h-screen bg-[var(--d3-bg)] text-[var(--d3-text)] flex flex-col">
      <PatternBg pattern="1" opacity={0.04} />

      <header className="bg-white/80 backdrop-blur border-b border-[var(--d3-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <BrandLogo className="h-8" />
          <Link
            to="/v1"
            className="inline-flex items-center gap-2 text-sm font-medium text-[var(--d3-muted)] hover:text-[var(--d3-text)]"
          >
            <ArrowLeft className="h-4 w-4" />
            На дашборд
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-[var(--d3-radius)] bg-white border border-[var(--d3-border)] shadow-[var(--d3-shadow)] p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-2xl bg-[#FE5500]/10 text-[#FE5500]">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Админ-панель</h1>
              <p className="text-xs text-[var(--d3-muted)]">Введите пароль администратора</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="d1-password" className="block text-sm font-medium mb-1.5">
                Пароль
              </label>
              <input
                id="d1-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                className="w-full rounded-xl border border-[var(--d3-border)] bg-[var(--d3-surface)] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#FE5500]/30"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 text-red-700 text-sm p-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[var(--d3-primary)] text-[var(--d3-primary-text)] py-3 text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Войти
            </button>
          </form>
        </div>
      </main>

      <DesignNav />
    </div>
  );
}
