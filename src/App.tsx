import { Suspense, lazy } from 'react';
import { Loader2 } from 'lucide-react';
import { Route, Routes } from 'react-router';
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

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <Suspense fallback={<PageLoader />}>
            <D3Dashboard basePath="/" />
          </Suspense>
        }
      />
      <Route
        path="/admin"
        element={
          <Suspense fallback={<PageLoader />}>
            <AdminRoute login={<D3Login basePath="/" />} admin={<D3Admin basePath="/" />} />
          </Suspense>
        }
      />

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
            <AdminRoute login={<D1Login />} admin={<D1Admin />} />
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
            <AdminRoute login={<D2Login />} admin={<D2Admin />} />
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
            <AdminRoute login={<D3Login />} admin={<D3Admin />} />
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
            <AdminRoute login={<D4Login />} admin={<D4Admin />} />
          </Suspense>
        }
      />
    </Routes>
  );
}

export default App;
