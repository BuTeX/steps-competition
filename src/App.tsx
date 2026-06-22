import { Footprints, Shield } from 'lucide-react';
import { Link, Route, Routes } from 'react-router';
import { Button } from '@/components/ui/button';
import { DashboardPage, DashboardRefreshButton } from '@/pages/DashboardPage';
import { useApiData } from '@/hooks/useApiData';
import { AdminPage } from '@/pages/AdminPage';
import './App.css';

function DashboardLayout() {
  const {
    records,
    users,
    daily,
    matrix,
    stats,
    loading,
    error,
    refetch,
  } = useApiData();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Footprints className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Шагомер</h1>
                <p className="text-xs text-slate-500 hidden sm:block">
                  Конкурс шагов — рейтинг и статистика
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DashboardRefreshButton onClick={refetch} loading={loading} />
              <Button variant="outline" size="sm" asChild className="gap-2">
                <Link to="/admin">
                  <Shield className="h-4 w-4" />
                  <span className="hidden sm:inline">Админ</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <DashboardPage
          records={records}
          users={users}
          daily={daily}
          matrix={matrix}
          stats={stats}
          loading={loading}
          error={error}
        />
      </main>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<DashboardLayout />} />
      <Route path="/admin" element={<AdminPage />} />
    </Routes>
  );
}

export default App;
