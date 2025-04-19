'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

// 新增一个包裹组件来使用 useSearchParams，因为 PaymentSuccessPage 本身不是 Suspense 的子组件
const PaymentSuccessContent: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const outTradeNo = searchParams.get('out_trade_no');
  const tradeNo = searchParams.get('trade_no');

  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('正在确认订单状态...');

  useEffect(() => {
    if (!outTradeNo) {
      setStatusMessage('无法获取订单信息，请检查 URL 或联系客服。');
      setLoading(false);
      return;
    }

    console.log(`支付成功跳转，开始查询订单状态: ${outTradeNo}, 支付宝交易号: ${tradeNo}`);

    const checkStatus = async () => {
      setLoading(true);
      setStatusMessage('正在为您确认订单状态，请稍候...');
      try {
        const response = await fetch('/api/payment/check-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ outTradeNo }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          setStatusMessage(result.message || '会员状态已成功更新！');
        } else {
          setStatusMessage(result.error || '订单状态确认失败，请稍后刷新或联系客服。');
        }
      } catch (error) {
        console.error('查询订单状态失败:', error);
        setStatusMessage('网络请求失败，无法确认订单状态，请联系客服。');
      } finally {
        setLoading(false);
      }
    };

    checkStatus();

  }, [outTradeNo, tradeNo]);

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>🎉 支付确认中...</h1>
      <p style={styles.message}>
        {loading ? '请稍候...' : statusMessage}
      </p>
      {!loading && (
        <Link href="/dashboard" style={styles.link}>
          前往用户中心
        </Link>
      )}
    </div>
  );
};

/**
 * 支付成功后的跳转页面 - 使用 Suspense 包裹
 */
const PaymentSuccessPage: React.FC = () => {
  return (
    <Suspense fallback={<div style={styles.container}>正在加载支付结果...</div>}>
      <PaymentSuccessContent />
    </Suspense>
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