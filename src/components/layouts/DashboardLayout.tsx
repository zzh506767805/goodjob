'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface NavItem {
  name: string;
  href: string;
  icon: string;
}

const navigation: NavItem[] = [
  { name: '仪表盘', href: '/dashboard', icon: '📊' },
  { name: '简历管理', href: '/resumes', icon: '📄' },
  { name: '投递记录', href: '/applications', icon: '📨' },
  { name: '插件下载', href: '/download-plugin', icon: '🔌' },
  { name: '会员中心', href: '/pricing', icon: '👑' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 移动端侧边栏 */}
      <div className={`fixed inset-0 z-40 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)}></div>
        <div className="fixed inset-y-0 left-0 flex flex-col w-64 bg-white">
          <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
            <span className="text-xl font-semibold">AI求职助手</span>
            <button
              type="button"
              className="p-2 text-gray-500 rounded-md hover:text-gray-700"
              onClick={() => setSidebarOpen(false)}
            >
              <span className="sr-only">关闭侧边栏</span>
              <span className="text-2xl">×</span>
            </button>
          </div>
          <nav className="flex-1 px-2 py-4 overflow-y-auto">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center px-4 py-3 text-sm rounded-md mb-1 ${
                  pathname === item.href
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="mr-3 text-lg">{item.icon}</span>
                {item.name}
              </Link>
            ))}
          </nav>
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={logout}
              className="flex items-center w-full px-4 py-2 text-sm text-red-600 rounded-md hover:bg-red-50"
            >
              <span className="mr-3 text-lg">🚪</span>
              退出登录
            </button>
          </div>
        </div>
      </div>

      {/* 桌面端侧边栏 */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-1 min-h-0 bg-white border-r border-gray-200">
          <div className="flex items-center h-16 px-4 border-b border-gray-200">
            <span className="text-xl font-semibold">AI求职助手</span>
          </div>
          <nav className="flex-1 px-2 py-4 overflow-y-auto">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center px-4 py-3 text-sm rounded-md mb-1 ${
                  pathname === item.href
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="mr-3 text-lg">{item.icon}</span>
                {item.name}
              </Link>
            ))}
          </nav>
          <div className="p-4 border-t border-gray-200">
            {user && (
              <div className="mb-3 p-3 bg-gray-50 rounded-md">
                <div className="text-sm font-medium text-gray-700">{user.name}</div>
              </div>
            )}
            <button
              onClick={logout}
              className="flex items-center w-full px-4 py-2 text-sm text-red-600 rounded-md hover:bg-red-50"
            >
              <span className="mr-3 text-lg">🚪</span>
              退出登录
            </button>
          </div>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="lg:pl-64 flex flex-col">
        {/* 顶部导航 */}
        <div className="sticky top-0 z-10 flex items-center justify-between h-16 px-4 bg-white border-b border-gray-200 lg:hidden">
          <button
            type="button"
            className="p-2 text-gray-500 rounded-md lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <span className="sr-only">打开侧边栏</span>
            <span className="text-2xl">☰</span>
          </button>
          <span className="text-xl font-semibold">AI求职助手</span>
          <div className="flex items-center">
            {user && (
              <span className="text-sm text-gray-700">{user.name}</span>
            )}
          </div>
        </div>

        {/* 页面内容 */}
        <main className="flex-1 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
} 