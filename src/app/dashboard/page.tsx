'use client';

import { useEffect, useState, useRef } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface DashboardStats {
  applicationCount: number;
  remainingSubmissions: number;
  submissionLimit: number;
  recentApplications: any[];
  membershipInfo: {
    text: string;
    className: string;
  };
  loading: boolean;
}

export default function Dashboard() {
  const { token, user, refreshUserStatus } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    applicationCount: 0,
    remainingSubmissions: 0,
    submissionLimit: 0,
    recentApplications: [],
    membershipInfo: { 
      text: '加载中...', 
      className: 'bg-gray-100 text-gray-800' 
    },
    loading: true
  });
  
  // 使用ref来跟踪是否已经加载过数据
  const dataLoadedRef = useRef(false);

  // 格式化会员到期时间
  const formatExpiryDate = (date: Date | null | undefined) => {
    if (!date) return '无到期日期';
    try {
        return format(new Date(date), 'yyyy年MM月dd日', { locale: zhCN });
    } catch (error) {
        console.error("Error formatting date:", date, error);
        return '日期无效';
    }
  };
  
  // 根据用户信息计算会员状态
  const calculateMembershipInfo = (userData: any) => {
    if (!userData) return { text: '未登录', className: 'bg-gray-100 text-gray-800' };
    
    const now = new Date();
    const isEffectivelyMember = !!userData.isMember && !!userData.membershipExpiry && new Date(userData.membershipExpiry) > now;

    if (isEffectivelyMember) {
      // 是有效会员，显示到期时间
      const expiryText = formatExpiryDate(userData.membershipExpiry);
      return { 
        text: `高级会员 (有效期至 ${expiryText})`, 
        className: 'bg-green-100 text-green-800' // 有效会员用绿色
      };
    } else if (userData.isMember && !isEffectivelyMember) {
      // 曾经是会员，但已过期
      const expiryText = formatExpiryDate(userData.membershipExpiry);
      return { 
        text: `会员已过期 (${expiryText})`, 
        className: 'bg-red-100 text-red-800' // 过期会员用红色
      };
    } else {
      // 普通会员
      return { 
        text: '普通会员', 
        className: 'bg-blue-100 text-blue-800' // 普通会员用蓝色
      };
    }
  };

  useEffect(() => {
    // 只有当token存在且数据尚未加载时才执行加载
    if (token && !dataLoadedRef.current) {
      const loadData = async () => {
        try {
          await fetchDashboardData();
          // 标记数据已加载
          dataLoadedRef.current = true;
        } catch (error) {
          console.error('加载仪表盘数据失败:', error);
          // 确保即使加载失败也标记为已尝试加载，避免无限重试
          dataLoadedRef.current = true;
          setStats(prev => ({ ...prev, loading: false }));
        }
      };
      
      loadData();
    }
  }, [token]); // 只依赖于token

  const fetchDashboardData = async () => {
    // 设置所有卡片为加载状态
    setStats(prev => ({ 
      ...prev, 
      loading: true,
      membershipInfo: { text: '加载中...', className: 'bg-gray-100 text-gray-800' }
    }));
    
    try {
      console.log('开始获取仪表盘数据...');
      
      // 创建请求配置
      const requestConfig = {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      };
      
      // 并行请求用户状态和投递数据
      const [userStatusResponse, applicationResponse] = await Promise.all([
        fetch('/api/user/status', requestConfig),
        fetch('/api/applications', requestConfig)
      ]);

      // 准备接收数据的变量
      let userStatusData = { 
        remainingSubmissions: 0, 
        limit: 0,
        isEffectivelyMember: false,
        user: null
      };
      let applicationData = { applications: [] };
      
      // 分别处理响应
      if (userStatusResponse.ok) {
        userStatusData = await userStatusResponse.json();
        console.log('用户状态数据:', userStatusData);
      } else {
        console.error('获取用户状态数据失败:', userStatusResponse.status);
      }
      
      if (applicationResponse.ok) {
        applicationData = await applicationResponse.json();
      } else {
        console.error('获取投递数据失败:', applicationResponse.status);
      }
      
      // 计算会员状态信息 - 使用API返回的用户数据而不是context中的user
      const membershipInfo = calculateMembershipInfo(userStatusData.user || user);
      
      console.log('仪表盘数据获取成功', { 
        applicationCount: applicationData.applications.length,
        remainingSubmissions: userStatusData.remainingSubmissions,
        submissionLimit: userStatusData.limit
      });
      
      // 同时更新所有卡片数据，确保一致加载
      setStats({
        applicationCount: applicationData.applications.length,
        remainingSubmissions: userStatusData.remainingSubmissions || 0,
        submissionLimit: userStatusData.limit || 0,
        recentApplications: applicationData.applications.slice(0, 5),
        membershipInfo: membershipInfo,
        loading: false
      });
    } catch (error) {
      console.error('获取仪表盘数据失败:', error);
      // 出错时也更新加载状态，显示默认会员状态
      setStats(prev => ({ 
        ...prev, 
        loading: false,
        membershipInfo: calculateMembershipInfo(user)
      }));
    }
  };

  // 手动刷新仪表盘数据的函数 - 不再重复调用refreshUserStatus
  const refreshDashboardData = async () => {
    try {
      // 直接获取所有仪表盘数据，统一刷新
      await fetchDashboardData();
    } catch (error) {
      console.error('刷新仪表盘数据失败:', error);
      setStats(prev => ({ ...prev, loading: false }));
    }
  };

  const downloadUrl = 'https://github.com/zzh506767805/goodjob/releases/download/v1.0.0/goodjoblatest.zip';
  const downloadFilename = 'goodjob.zip';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* 欢迎标题 */}
        <h1 className="text-2xl font-bold text-gray-900">欢迎回来, {user?.name}</h1>
        
        {/* 数据卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard 
            title="已投递数量" 
            value={stats.loading ? '加载中...' : stats.applicationCount.toString()} 
            icon="📨" 
            color="bg-green-100"
          />
          <StatCard
            title="会员状态"
            value={stats.loading ? '加载中...' : stats.membershipInfo.text}
            icon="👑"
            color="bg-yellow-100"
            className={stats.loading ? 'text-gray-500' : stats.membershipInfo.className}
          />
          <StatCard 
            title="今日剩余投递次数" 
            value={stats.loading ? '加载中...' : `${stats.remainingSubmissions}/${stats.submissionLimit}`} 
            icon="🚀" 
            color="bg-purple-100"
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">投递时间</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stats.recentApplications.map((app) => (
                    <tr key={app._id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{app.companyName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{app.positionName}</td>
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
        
        {/* 开始使用指南 - 更新内容 */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">开始使用</h2>
          <div className="space-y-4">
            {/* 第一步：下载和安装插件 */}
            <div className="flex">
              <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-bold">
                1
              </div>
              <div className="ml-4">
                <h3 className="text-md font-medium text-gray-900">下载并安装浏览器插件</h3>
                <p className="text-sm text-gray-500 mb-2">
                  点击下方按钮下载插件压缩包 (.zip)，然后按照说明手动加载到 Chrome 浏览器。
                </p>
                <a
                  href={downloadUrl}
                  download={downloadFilename}
                  className="inline-block px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 mb-2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  下载插件 (v1.0.0)
                </a>
                <details className="text-xs text-gray-500 cursor-pointer">
                    <summary>查看安装说明</summary>
                    <ol className="list-decimal list-inside space-y-1 mt-1 pl-2">
                        <li>下载插件压缩包 (.zip 文件)。</li>
                        <li>将下载的 .zip 文件解压到一个您方便找到的文件夹。</li>
                        <li>打开Chrome浏览器，在地址栏输入 <code>chrome://extensions/</code> 并按回车键。</li>
                        <li>在页面右上角，打开"开发者模式"的开关。</li>
                        <li>点击页面左上角的"加载已解压的扩展程序"按钮。</li>
                        <li>选择您刚才解压出来的那个插件文件夹。</li>
                        <li>安装完成！插件图标会出现在浏览器工具栏。</li>
                    </ol>
                </details>
              </div>
            </div>
            
            {/* 第二步：登录同步 */}
            <GuideStep 
              number="2" 
              title="登录账号同步" 
              description="在插件弹窗和本官网上使用相同的账号登录，以便同步您的会员权限和投递记录。"
            />
            
            {/* 第三步：开始投递 */}
            <GuideStep 
              number="3" 
              title="开始投递职位" 
              description="打开 Boss 直聘网站，浏览职位列表或职位详情页时，点击浏览器右上角的插件图标，即可开始使用一键打招呼、批量投递等功能。"
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function StatCard({ title, value, icon, color, className }: { title: string; value: string; icon: string; color: string; className?: string }) {
  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center">
        <div className={`w-12 h-12 ${color} rounded-full flex items-center justify-center text-xl`}>
          {icon}
        </div>
        <div className="ml-4">
          <h3 className="text-sm font-medium text-gray-500">{title}</h3>
          <p className={`text-lg font-semibold ${className || 'text-gray-900'}`}>{value}</p>
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
