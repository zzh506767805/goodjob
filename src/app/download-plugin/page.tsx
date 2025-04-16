'use client';

import DashboardLayout from '@/components/layouts/DashboardLayout';
import { useState } from 'react';
import Link from 'next/link';

export default function DownloadPlugin() {
  const [copied, setCopied] = useState(false);

  const handleCopyClick = () => {
    const apiKeyElement = document.getElementById('api-key') as HTMLInputElement;
    if (apiKeyElement) {
      apiKeyElement.select();
      document.execCommand('copy');
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">下载浏览器插件</h1>

        {/* 插件介绍 */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">插件功能</h2>
          <p className="text-gray-600 mb-4">
            AI智能求职助手浏览器插件可以帮助您在Boss直聘上高效求职:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-gray-600">
            <li>自动分析职位描述与您的简历匹配度</li>
            <li>一键生成个性化打招呼消息</li>
            <li>快速筛选最适合您的工作机会</li>
            <li>所有操作与网页端同步，方便管理投递记录</li>
          </ul>
        </div>

        {/* 安装步骤 */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">安装步骤</h2>
          
          <div className="space-y-6">
            {/* 步骤1 */}
            <div className="flex">
              <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-bold">
                1
              </div>
              <div className="ml-4">
                <h3 className="text-md font-medium text-gray-900">下载插件文件</h3>
                <p className="text-sm text-gray-500 mb-3">
                  点击下方按钮下载最新版本的插件压缩包
                </p>
                <a
                  href="#" // 这里应该是实际的下载链接
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  下载插件 (v1.0.0)
                </a>
              </div>
            </div>
            
            {/* 步骤2 */}
            <div className="flex">
              <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-bold">
                2
              </div>
              <div className="ml-4">
                <h3 className="text-md font-medium text-gray-900">在Chrome中安装</h3>
                <p className="text-sm text-gray-500">
                  1. 打开Chrome浏览器，在地址栏输入: <span className="font-mono bg-gray-100 px-1">chrome://extensions</span><br />
                  2. 开启右上角的"开发者模式"<br />
                  3. 将下载的插件压缩包解压到一个固定位置<br />
                  4. 点击"加载已解压的扩展程序"，选择解压后的文件夹<br />
                  5. 安装完成后，您可以在Chrome工具栏看到插件图标
                </p>
              </div>
            </div>
            
            {/* 步骤3 */}
            <div className="flex">
              <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-bold">
                3
              </div>
              <div className="ml-4">
                <h3 className="text-md font-medium text-gray-900">配置API密钥</h3>
                <p className="text-sm text-gray-500 mb-3">
                  复制下方API密钥，并在插件设置中粘贴
                </p>
                <div className="flex items-center mt-2">
                  <input
                    id="api-key"
                    type="text"
                    readOnly
                    value="ai-resume-xxxx-yyyy-zzzz"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleCopyClick}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-r-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    {copied ? '已复制' : '复制'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 使用指南 */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">使用指南</h2>
          <p className="text-gray-600 mb-4">
            安装完成后，您可以按照以下步骤使用插件:
          </p>
          <ol className="list-decimal pl-5 space-y-2 text-gray-600">
            <li>登录Boss直聘，浏览职位列表</li>
            <li>点击扩展图标打开插件面板</li>
            <li>选择要使用的简历</li>
            <li>查看职位匹配分析和推荐</li>
            <li>生成个性化打招呼语并发送</li>
          </ol>
          <div className="mt-4">
            <Link
              href="#" // 这应该是详细使用指南的链接
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              查看详细使用文档 →
            </Link>
          </div>
        </div>

        {/* 问题反馈 */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">问题反馈</h2>
          <p className="text-gray-600">
            如果您在使用过程中遇到任何问题，或有功能建议，请通过以下方式联系我们:
          </p>
          <ul className="mt-3 space-y-1 text-gray-600">
            <li>• 邮箱: support@airesume.com</li>
            <li>• 微信: AI求职助手</li>
          </ul>
        </div>
      </div>
    </DashboardLayout>
  );
} 