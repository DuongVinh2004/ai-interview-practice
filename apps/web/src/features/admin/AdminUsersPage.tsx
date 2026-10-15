import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { useAuthStore } from '../../stores/auth.store';
import { useI18nStore } from '../../stores/i18n.store';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { Shield, Lock, Unlock } from 'lucide-react';

export function AdminUsersPage() {
  const currentUser = useAuthStore(state => state.user);
  const { language } = useI18nStore();
  const isVi = language === 'vi';
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
        body: JSON.stringify({
          reason: isVi ? 'Tài khoản bị tạm khóa bởi quản trị viên' : 'Account suspended by administrator',
        }),
      });
      refetch();
    } catch (err: any) {
      setErrorMessage(
        err.message || (isVi ? 'Khóa tài khoản thất bại.' : 'Failed to lock user.'),
      );
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
      setErrorMessage(
        err.message || (isVi ? 'Mở khóa tài khoản thất bại.' : 'Failed to unlock user.'),
      );
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="bg-purple-100 text-purple-700 p-2.5 rounded-xl">
          <Shield className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {isVi ? 'Quản lý Người dùng' : 'User Administration'}
          </h1>
          <p className="text-sm text-slate-500">
            {isVi
              ? 'Quản lý tài khoản ứng viên, tìm kiếm và kiểm soát trạng thái truy cập'
              : 'Manage candidate accounts, search users, and apply soft locks'}
          </p>
        </div>
      </div>

      {errorMessage && <Alert variant="error">{errorMessage}</Alert>}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>{isVi ? 'Danh sách người dùng' : 'Registered Users'}</CardTitle>
            <div className="w-72">
              <Input
                placeholder={isVi ? 'Tìm theo email hoặc họ tên...' : 'Search by email or name...'}
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
                    <th className="px-6 py-3.5">{isVi ? 'Người dùng' : 'User'}</th>
                    <th className="px-6 py-3.5">{isVi ? 'Vai trò' : 'Role'}</th>
                    <th className="px-6 py-3.5">{isVi ? 'Trạng thái' : 'Status'}</th>
                    <th className="px-6 py-3.5">{isVi ? 'Số phiên' : 'Sessions'}</th>
                    <th className="px-6 py-3.5 text-right">{isVi ? 'Thao tác' : 'Actions'}</th>
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
                            {u.profile?.fullName || (isVi ? 'Chưa đặt tên' : 'No Name')}
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
                            <span className="text-xs text-slate-400 italic">
                              {isVi ? 'Tài khoản hiện tại' : 'Current User'}
                            </span>
                          ) : isLocked ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUnlock(u.id)}
                              className="gap-1 text-emerald-700 hover:text-emerald-800"
                            >
                              <Unlock className="h-3.5 w-3.5" />
                              <span>{isVi ? 'Mở khóa' : 'Unlock'}</span>
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleLock(u.id)}
                              className="gap-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            >
                              <Lock className="h-3.5 w-3.5" />
                              <span>{isVi ? 'Khóa' : 'Lock'}</span>
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
