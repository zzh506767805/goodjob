'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';

// 定义用户状态类型
interface UserStatus {
  isMember: boolean;
  remainingSubmissions: number;
  limit: number;
}

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<UserStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStatus = async () => {
      if (user) {
        setStatusLoading(true);
        setError('');
        try {
          const token = localStorage.getItem('token'); // 从 localStorage 获取 token
          if (!token) {
            // 理论上 user 存在时 token 也应该存在，但作为健壮性检查
            console.warn('User context exists but token not found in localStorage.');
            // 可以选择在此处强制登出或忽略
            setStatusLoading(false);
            return;
          }
          
          const response = await fetch('/api/user/status', {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || '获取用户状态失败');
          }
          const data: UserStatus = await response.json();
          setStatus(data);
        } catch (err: any) {
          setError(err.message);
        } finally {
          setStatusLoading(false);
        }
      } else {
        setStatus(null); // 用户未登录，清空状态
      }
    };

    // 当用户信息加载完毕后再获取状态
    if (!authLoading) {
        fetchStatus();
    }

  }, [user, authLoading]); // 依赖用户和认证加载状态

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-6">
      <div className="max-w-6xl w-full flex flex-col items-center justify-center space-y-12 py-16">
        {/* 标题区域 */}
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bold text-gray-900">AI智能求职助手</h1>
          <p className="text-xl text-gray-600 max-w-2xl">
            一键解析简历、智能匹配职位、自动生成个性化投递信息，让求职更高效
          </p>
        </div>

        {/* 操作按钮/状态显示 */}
        <div className="flex flex-col items-center gap-4 min-h-[100px]">
          {authLoading ? (
            <p className="text-gray-600">正在加载用户状态...</p>
          ) : user ? (
            // 用户已登录
            <div className="text-center">
              <p className="text-lg text-gray-800">欢迎回来, {user.name || '用户'}!</p>
              {statusLoading ? (
                <p className="text-sm text-gray-500">正在获取会员状态...</p>
              ) : status ? (
                <p className="text-sm text-gray-600">
                  当前状态: {status.isMember ? '✨ Pro 会员' : '普通会员'} (今日剩余: {status.remainingSubmissions}/{status.limit})
                </p>
              ) : error ? (
                  <p className="text-sm text-red-500">获取状态失败: {error}</p>
              ) : null}
              <div className="mt-4 flex gap-4 justify-center">
                <Link href="/dashboard"
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
                >
                  进入控制台
                </Link>
                {!status?.isMember && (
                  <Link href="/pricing" // 假设定价页面路径为 /pricing
                    className="px-6 py-3 bg-yellow-500 text-white rounded-lg font-semibold hover:bg-yellow-600 transition"
                  >
                    升级 Pro
                  </Link>
                )}
              </div>
            </div>
          ) : (
            // 用户未登录
            <div className="flex gap-4">
              <Link href="/auth/login"
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                登录
              </Link>
              <Link href="/auth/register"
                className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                注册
              </Link>
            </div>
          )}
        </div>

        {/* 主要功能描述 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full mt-16">
          <FeatureCard 
            title="简历智能解析" 
            description="上传简历后自动提取关键信息，无需手动输入，支持多份简历管理" 
            icon="/icons/resume.svg"
          />
          <FeatureCard 
            title="职位智能匹配" 
            description="AI算法分析简历与职位的匹配度，优先推荐最适合你的工作" 
            icon="/icons/match.svg"
          />
          <FeatureCard 
            title="自动生成打招呼语" 
            description="根据简历和职位智能生成个性化的打招呼语，提高回复率" 
            icon="/icons/message.svg"
          />
        </div>

        {/* 浏览器插件介绍 */}
        <div className="w-full bg-gray-100 rounded-xl p-8 mt-12">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="md:w-1/2 space-y-4">
              <h2 className="text-2xl font-bold text-gray-900">浏览器插件助力求职</h2>
              <p className="text-gray-700">
                我们的Chrome浏览器插件可以帮助你在Boss直聘等求职平台上实现一键投递。
                无需频繁切换窗口，直接在招聘网站使用AI助手分析职位、生成打招呼语并发送。
              </p>
              <div className="pt-4">
                <Link href="/download-plugin"
                  className="px-4 py-2 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-900 transition"
                >
                  下载插件
                </Link>
              </div>
            </div>
            <div className="md:w-1/2">
              <div className="bg-white rounded-lg shadow-lg p-4">
                <div className="h-48 bg-gray-200 rounded flex items-center justify-center">
                  <p className="text-gray-500">插件截图展示</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function FeatureCard({ title, description, icon }: { title: string; description: string; icon: string }) {
  return (
    <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
        <span className="text-2xl">📄</span>
      </div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}
