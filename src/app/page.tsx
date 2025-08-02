'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';

export default function Home() {
  const { user, isAuthenticated, isLoading } = useAuth();

  // **** 新增：判断有效会员状态 ****
  const isEffectivelyMember = 
    user?.isMember && user?.membershipExpiry && new Date(user.membershipExpiry) > new Date();

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-8 md:p-24 bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-6xl w-full flex flex-col items-center justify-center space-y-12 py-16">
        {/* 标题区域 */}
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bold text-gray-900">AI智能求职助手</h1>
          <p className="text-xl text-gray-600 max-w-2xl">
            一键解析简历、智能匹配职位、自动生成个性化投递信息，让求职更高效
          </p>
        </div>

        {/* 操作按钮 或 用户状态 */}
        <div className="flex gap-4">
          {isLoading ? (
            <p className="text-gray-500">加载中...</p>
          ) : isAuthenticated && user ? (
            // 用户已登录
            <div className="flex flex-col items-center gap-2">
              <span className="text-lg font-semibold text-gray-800">欢迎, {user.name}!</span>
              <span className={`px-3 py-1 text-sm font-medium rounded-full ${isEffectivelyMember ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                {isEffectivelyMember ? '高级会员' : '普通会员'}
              </span>
              <Link href="/dashboard"
                className="mt-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                进入仪表盘
              </Link>
            </div>
          ) : (
            // 用户未登录
            <>
              <Link href="/auth/login"
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                登录
              </Link>
              <Link href="/auth/register"
                className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                注册，开始使用
              </Link>
            </>
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

        {/* 浏览器插件介绍 - 更新 */}
        <div className="w-full bg-gray-100 rounded-xl p-8 mt-12">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="md:w-1/2 space-y-4">
              <h2 className="text-2xl font-bold text-gray-900">浏览器插件助力求职</h2>
              <p className="text-gray-700">
                安装我们的Chrome浏览器插件，即可在Boss直聘等求职平台实现一键投递。
                无需频繁切换窗口，直接在招聘网站使用AI助手分析职位、生成打招呼语并发送。
              </p>
              <p className="text-gray-700 pt-2">
                {isAuthenticated ? (
                  <>
                    您可以前往 <Link href="/dashboard" className="text-blue-600 hover:underline">我的控制台</Link> 下载并安装插件。
                  </>
                ) : (
                  <>
                    请 <Link href="/auth/login" className="text-blue-600 hover:underline">登录</Link> 或 <Link href="/auth/register" className="text-blue-600 hover:underline">注册</Link> 后，前往控制台下载并安装插件。
                  </>
                )}
              </p>
            </div>
            <div className="md:w-1/2">
              <div className="bg-white rounded-lg shadow-lg overflow-hidden"> 
                {/* 替换为新的截图 */}
                <Image 
                  src="/images/screenshot-20250420-234506.png" 
                  alt="智能求职助手插件截图"
                  width={600} // 根据实际图片调整
                  height={400} // 根据实际图片调整
                  className="object-contain" // 或者 object-cover 根据需要调整
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* 友情链接区域 */}
      <footer className="w-full bg-white border-t mt-8 py-6 flex flex-col items-center">
        <div className="text-gray-500 text-sm mb-2">Friend Links</div>
        <div className="flex flex-wrap gap-4 justify-center">
          <a href="https://chinesenamegenerate.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Chinesenamegenerate.com</a>
          <a href="https://dressmeai.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">dressmeai.com</a>
          <a href="https://checkios.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">checkios.com</a>
          <a href="https://dreamfinityx.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Dreamfinityx.com</a>
          <a href="https://ainails.pro" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">ainails.pro</a>
          <a href="https://charactereadcanon.pro" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Charactereadcanon.pro</a>
          <a href="https://elfname.pro" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Elfname.pro</a>

        </div>
      </footer>
    </main>
  );
}

function FeatureCard({ title, description, icon }: { title: string; description: string; icon: string }) {
  return (
    <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
        <div className="w-6 h-6 bg-blue-500 rounded" />
      </div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}
