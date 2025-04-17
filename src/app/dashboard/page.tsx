'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';

interface DashboardStats {
  resumeCount: number;
  applicationCount: number;
  recentApplications: any[];
  loading: boolean;
}

export default function Dashboard() {
  const { token, user, refreshUserStatus } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    resumeCount: 0,
    applicationCount: 0,
    recentApplications: [],
    loading: true
  });

  useEffect(() => {
    // 添加一个标志位来确保组件挂载时一定会执行一次
    let isMounted = true;
    
    const loadData = async () => {
      if (isMounted) {
        // 首先刷新用户状态
        await refreshUserStatus();
        
        if (token) {
          // 然后获取仪表盘数据
          await fetchDashboardData();
        }
      }
    };
    
    loadData();
    
    // 清理函数，组件卸载时更新标志位
    return () => { isMounted = false; };
  }, []); // 不再依赖token，确保只在组件挂载时执行一次

  const fetchDashboardData = async () => {
    try {
      console.log('开始获取仪表盘数据...');
      // 获取简历数量
      const resumeResponse = await fetch('/api/resumes', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // 获取投递数量和最近投递
      const applicationResponse = await fetch('/api/applications', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (resumeResponse.ok && applicationResponse.ok) {
        const resumeData = await resumeResponse.json();
        const applicationData = await applicationResponse.json();
        
        console.log('仪表盘数据获取成功', { 
          resumeCount: resumeData.resumes.length, 
          applicationCount: applicationData.applications.length 
        });
        
        setStats({
          resumeCount: resumeData.resumes.length,
          applicationCount: applicationData.applications.length,
          recentApplications: applicationData.applications.slice(0, 5),
          loading: false
        });
      } else {
        console.error('获取仪表盘数据接口错误', { 
          resumeStatus: resumeResponse.status, 
          appStatus: applicationResponse.status 
        });
      }
    } catch (error) {
      console.error('获取仪表盘数据失败:', error);
      setStats(prev => ({ ...prev, loading: false }));
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">欢迎回来, {user?.name}</h1>
          {user && (
            <span className={`px-3 py-1 text-sm font-medium rounded-full ${user.isMember ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
              {user.isMember ? '高级会员' : '普通会员'}
            </span>
          )}
        </div>
        
        {/* 数据卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <StatCard 
            title="简历数量" 
            value={stats.loading ? '加载中...' : stats.resumeCount.toString()} 
            icon="📄" 
            color="bg-blue-100"
          />
          <StatCard 
            title="投递数量" 
            value={stats.loading ? '加载中...' : stats.applicationCount.toString()} 
            icon="📨" 
            color="bg-green-100"
          />
          <StatCard
            title="会员状态"
            value={user?.isMember ? '高级会员' : '普通会员'}
            icon="👑"
            color="bg-yellow-100"
          />
        </div>
        
        {/* 最近投递 */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">最近投递</h2>
          {stats.loading ? (
            <p className="text-gray-500">加载中...</p>
          ) : stats.recentApplications.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">公司</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">职位</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">投递时间</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stats.recentApplications.map((app) => (
                    <tr key={app._id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{app.companyName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{app.positionName}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          app.status === 'applied' ? 'bg-yellow-100 text-yellow-800' :
                          app.status === 'replied' ? 'bg-blue-100 text-blue-800' :
                          app.status === 'interviewing' ? 'bg-purple-100 text-purple-800' :
                          app.status === 'offer' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {app.status === 'applied' ? '已投递' :
                           app.status === 'replied' ? '已回复' :
                           app.status === 'interviewing' ? '面试中' :
                           app.status === 'offer' ? '已录用' : '已拒绝'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(app.appliedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500">暂无投递记录</p>
          )}
        </div>
        
        {/* 开始使用指南 */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">开始使用</h2>
          <div className="space-y-4">
            <GuideStep 
              number="1" 
              title="上传您的简历" 
              description="前往简历管理页面上传并解析您的简历，系统将自动提取关键信息" 
            />
            <GuideStep 
              number="2" 
              title="安装浏览器插件" 
              description="下载并安装我们的Chrome插件，以便在Boss直聘上自动操作" 
            />
            <GuideStep 
              number="3" 
              title="开始投递职位" 
              description="在Boss直聘浏览职位时，插件会自动计算匹配度并协助您投递" 
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function StatCard({ title, value, icon, color }: { title: string; value: string; icon: string; color: string }) {
  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center">
        <div className={`w-12 h-12 ${color} rounded-full flex items-center justify-center text-xl`}>
          {icon}
        </div>
        <div className="ml-4">
          <h3 className="text-sm font-medium text-gray-500">{title}</h3>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function GuideStep({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex">
      <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-bold">
        {number}
      </div>
      <div className="ml-4">
        <h3 className="text-md font-medium text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
    </div>
  );
} 