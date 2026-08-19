import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { useAuthStore } from '../../stores/auth.store';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { Shield, Lock, Unlock } from 'lucide-react';

export function AdminUsersPage() {
  const currentUser = useAuthStore(state => state.user);
  const [search, setSearch] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery<{ items: any[]; meta: any }>({
    queryKey: ['admin-users', search],
    queryFn: () => apiClient(`/admin/users?search=${encodeURIComponent(search)}`),
  });

  const users = data?.items || [];

  const handleLock = async (targetUserId: string) => {
    setErrorMessage(null);
    try {
      await apiClient(`/admin/users/${targetUserId}/lock`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Account suspended by administrator' }),
      });
      refetch();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to lock user.');
    }
  };

  const handleUnlock = async (targetUserId: string) => {
    setErrorMessage(null);
    try {
      await apiClient(`/admin/users/${targetUserId}/unlock`, {
        method: 'POST',
      });
      refetch();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to unlock user.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="bg-purple-100 text-purple-700 p-2.5 rounded-xl">
          <Shield className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Administration</h1>
          <p className="text-sm text-slate-500">
            Manage candidate accounts, search users, and apply soft locks
          </p>
        </div>
      </div>

      {errorMessage && <Alert variant="error">{errorMessage}</Alert>}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>Registered Users</CardTitle>
            <div className="w-72">
              <Input
                placeholder="Search by email or name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 text-center">
              <Spinner />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="px-6 py-3.5">User</th>
                    <th className="px-6 py-3.5">Role</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Sessions</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map(u => {
                    const isSelf = u.id === currentUser?.id;
                    const isLocked = u.status === 'LOCKED';

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-900">
                            {u.profile?.fullName || 'No Name'}
                          </div>
                          <div className="text-xs text-slate-500">{u.email}</div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={u.role === 'ADMIN' ? 'info' : 'default'}>{u.role}</Badge>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={isLocked ? 'danger' : 'success'}>{u.status}</Badge>
                          {isLocked && u.lockReason && (
                            <span className="block text-[10px] text-rose-600 mt-0.5">
                              {u.lockReason}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-600 font-mono text-xs">
                          {u.sessionCount || 0}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {isSelf ? (
                            <span className="text-xs text-slate-400 italic">Current User</span>
                          ) : isLocked ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUnlock(u.id)}
                              className="gap-1 text-emerald-700 hover:text-emerald-800"
                            >
                              <Unlock className="h-3.5 w-3.5" />
                              <span>Unlock</span>
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleLock(u.id)}
                              className="gap-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            >
                              <Lock className="h-3.5 w-3.5" />
                              <span>Lock</span>
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
