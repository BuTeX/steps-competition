import { Suspense, lazy } from 'react';
import { Footprints, Loader2, Shield } from 'lucide-react';
import { Link, Route, Routes } from 'react-router';
import { Button } from '@/components/ui/button';
import { DashboardPage, DashboardRefreshButton } from '@/pages/DashboardPage';
import { useApiData } from '@/hooks/useApiData';
import { AdminPage } from '@/pages/AdminPage';
import { AdminRoute } from '@/pages/designs/shared/AdminRoute';
import './App.css';

const D1Dashboard = lazy(() => import('./pages/designs/DesignOne/Dashboard'));
const D1Login = lazy(() => import('./pages/designs/DesignOne/Login'));
const D1Admin = lazy(() => import('./pages/designs/DesignOne/Admin'));

const D2Dashboard = lazy(() => import('./pages/designs/DesignTwo/Dashboard'));
const D2Login = lazy(() => import('./pages/designs/DesignTwo/Login'));
const D2Admin = lazy(() => import('./pages/designs/DesignTwo/Admin'));

const D3Dashboard = lazy(() => import('./pages/designs/DesignThree/Dashboard'));
const D3Login = lazy(() => import('./pages/designs/DesignThree/Login'));
const D3Admin = lazy(() => import('./pages/designs/DesignThree/Admin'));

const D4Dashboard = lazy(() => import('./pages/designs/DesignFour/Dashboard'));
const D4Login = lazy(() => import('./pages/designs/DesignFour/Login'));
const D4Admin = lazy(() => import('./pages/designs/DesignFour/Admin'));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
    </div>
  );
}

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

      {/* Скрытые дизайны брендбука */}
      <Route
        path="/v1"
        element={
          <Suspense fallback={<PageLoader />}>
            <D1Dashboard />
          </Suspense>
        }
      />
      <Route
        path="/v1/admin"
        element={
          <Suspense fallback={<PageLoader />}>
            <AdminRoute login={D1Login} admin={D1Admin} />
          </Suspense>
        }
      />

      <Route
        path="/v2"
        element={
          <Suspense fallback={<PageLoader />}>
            <D2Dashboard />
          </Suspense>
        }
      />
      <Route
        path="/v2/admin"
        element={
          <Suspense fallback={<PageLoader />}>
            <AdminRoute login={D2Login} admin={D2Admin} />
          </Suspense>
        }
      />

      <Route
        path="/v3"
        element={
          <Suspense fallback={<PageLoader />}>
            <D3Dashboard />
          </Suspense>
        }
      />
      <Route
        path="/v3/admin"
        element={
          <Suspense fallback={<PageLoader />}>
            <AdminRoute login={D3Login} admin={D3Admin} />
          </Suspense>
        }
      />

      <Route
        path="/v4"
        element={
          <Suspense fallback={<PageLoader />}>
            <D4Dashboard />
          </Suspense>
        }
      />
      <Route
        path="/v4/admin"
        element={
          <Suspense fallback={<PageLoader />}>
            <AdminRoute login={D4Login} admin={D4Admin} />
          </Suspense>
        }
      />
    </Routes>
  );
}

export default App;
