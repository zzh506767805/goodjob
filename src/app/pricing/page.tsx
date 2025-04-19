'use client'; // 标记为客户端组件，因为我们后面会添加交互逻辑

import React, { useState } from 'react'; // 引入 useState
import { Button } from '@/components/ui/button'; // 修正为@别名
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'; // 修正为@别名
import { CheckCircle, Loader2 } from 'lucide-react'; // 引入图标和加载图标
import { useAuth } from '@/contexts/AuthContext'; // <-- 引入 useAuth
import DashboardLayout from '@/components/layouts/DashboardLayout'; // 引入布局
import { format } from 'date-fns'; // 添加日期格式化
import { zhCN } from 'date-fns/locale'; // 添加中文日期格式化支持

// 假设后端 API 地址定义在环境变量中
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '/api'; // Fallback to relative path

const PricingPage: React.FC = () => {
  const { token, user } = useAuth(); // <-- 使用 useAuth 获取 token 和 user
  const [isLoading, setIsLoading] = useState(false); // 添加加载状态
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // 添加错误消息状态

  // 判断用户是否为有效会员
  const isValidMember = user?.isMember && user?.membershipExpiry && new Date(user.membershipExpiry) > new Date();

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

  // 处理升级/续费点击
  const handleUpgradeClick = async () => {
    if (!token) {
      setErrorMessage('请先登录后再进行操作。');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    console.log('会员购买按钮点击! 尝试创建订单...');
    await createOrder('/payment/create-alipay-order', setIsLoading);
  };

  // 统一的创建订单逻辑
  const createOrder = async (endpoint: string, setLoading: (loading: boolean) => void) => {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('创建订单失败:', data);
        throw new Error(data.error || '创建订单失败，请稍后重试');
      }

      if (data.success && data.paymentUrl) {
        console.log('订单创建成功, 跳转至支付宝...', data.paymentUrl);
        window.location.href = data.paymentUrl;
        // 成功跳转后不需要设置 setLoading(false)
      } else {
        console.error('服务器响应无效:', data);
        throw new Error('无法获取支付链接，请联系客服');
      }
    } catch (error: any) {
      console.error('创建订单过程中出错:', error);
      setErrorMessage(error.message || '发生未知错误，请稍后重试');
      setLoading(false); // 发生错误时停止加载
    }
  }

  return (
    // 使用 DashboardLayout 包裹
    <DashboardLayout>
      <div className="container mx-auto py-12 px-4 md:px-6">
        <h1 className="text-3xl font-bold text-center mb-8">选择您的会员计划</h1>
        
        {/* 显示错误信息 */}
        {errorMessage && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative text-center mb-6" role="alert">
            <span className="block sm:inline">{errorMessage}</span>
          </div>
        )}

        {/* 显示会员状态 */}
        {isValidMember && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative text-center mb-6" role="alert">
            <span className="block sm:inline">
              您当前已是高级会员，有效期至: {formatExpiryDate(user?.membershipExpiry)}
            </span>
          </div>
        )}

        <div className="flex justify-center">
          {/* 正式会员卡片 */}
          <Card className="w-full max-w-sm shadow-lg">
            <CardHeader className="bg-primary text-primary-foreground p-6 rounded-t-lg">
              <CardTitle className="text-2xl font-semibold">Pro 会员</CardTitle>
              <CardDescription className="text-lg">解锁全部潜能</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="text-center mb-6">
                <span className="text-4xl font-bold">¥66</span>
                <span className="text-muted-foreground"> / 月</span>
              </div>
              <ul className="space-y-3">
                <li className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                  <span>每日最多 200 次投递</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                  <span>优先客服支持 (即将推出)</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                  <span>未来所有高级功能权限</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter className="p-6 border-t">
              <Button
                className="w-full text-lg py-3"
                onClick={handleUpgradeClick}
                disabled={isLoading} // 只需检查 isLoading
              >
                {isLoading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> 处理中...</>
                ) : (
                  isValidMember ? '续费会员' : '立即升级'
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
        
        <p className="text-center text-muted-foreground mt-8 text-sm">
          您可以随时取消您的订阅。
        </p>
      </div>
    </DashboardLayout>
  );
};

export default PricingPage; 