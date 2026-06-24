import { Loader2 } from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdmin';

interface AdminRouteProps {
  login: React.ComponentType;
  admin: React.ComponentType;
}

export function AdminRoute({ login: Login, admin: Admin }: AdminRouteProps) {
  const { authenticated, loading } = useAdminAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-[#7856FF]" />
      </div>
    );
  }

  if (!authenticated) {
    return <Login />;
  }

  return <Admin />;
}
