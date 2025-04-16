'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

/**
 * 支付成功后的跳转页面
 */
const PaymentSuccessPage: React.FC = () => {
  const router = useRouter();

  // 可选：几秒后自动跳转到用户中心或其他页面
  useEffect(() => {
    const timer = setTimeout(() => {
      // router.push('/dashboard'); // 跳转到仪表盘或其他目标页面
      console.log('支付成功，可以考虑跳转到用户中心');
    }, 5000); // 5秒后跳转

    return () => clearTimeout(timer); // 组件卸载时清除计时器
  }, [router]);

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>🎉 支付成功！</h1>
      <p style={styles.message}>
        感谢您的购买！您的会员权限将在几分钟内生效。
      </p>
      <p style={styles.message}>
        如果长时间未生效，请联系客服。
      </p>
      <Link href="/dashboard" style={styles.link}>
        返回用户中心
      </Link>
      {/* 
        或者显示一些订单信息（从 URL 参数获取，但要注意安全）
        例如：const searchParams = useSearchParams();
              const outTradeNo = searchParams.get('out_trade_no'); 
      */}
    </div>
  );
};

// 简单的内联样式
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '80vh',
    textAlign: 'center',
    padding: '20px',
    fontFamily: 'sans-serif',
  },
  title: {
    color: '#4CAF50', // 绿色
    marginBottom: '20px',
  },
  message: {
    fontSize: '1.1em',
    color: '#555',
    marginBottom: '15px',
    maxWidth: '500px',
  },
  link: {
    display: 'inline-block',
    marginTop: '20px',
    padding: '10px 20px',
    backgroundColor: '#007bff', // 蓝色
    color: 'white',
    textDecoration: 'none',
    borderRadius: '5px',
    transition: 'background-color 0.3s ease',
  },
};

export default PaymentSuccessPage; 