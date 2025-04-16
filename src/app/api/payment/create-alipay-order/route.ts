import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { verifyAuth } from '@/lib/authUtils';
import User from '@/models/User';
import Order, { OrderStatus } from '@/models/Order'; // 导入 Order 模型和状态枚举
// 导入 AlipaySdk 类，从官方示例 alipay-sdk-nodejs-all 项目中正确引入
const { AlipaySdk } = require('alipay-sdk');
import { alipayConfig, appConfig } from '@/lib/config';

// --- CORS Headers (如果前端直接调用此接口，可能需要) ---
const corsHeaders = {
  'Access-Control-Allow-Origin': appConfig.baseUrl || '*', // 允许你的前端来源
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS(request: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  console.log('💰 收到创建支付宝订单请求 (真实流程)');
  try {
    await connectToDatabase();
    console.log('✅ payment/create: 数据库连接成功');

    const userId = verifyAuth(req); // 恢复获取 userId 的代码
    if (!userId) {
      console.log('❌ payment/create: 用户验证失败');
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: corsHeaders });
    }
    console.log(`✅ payment/create: 用户已验证: ${userId}`);

    // 1. 查找用户，确保用户存在
    const user = await User.findById(userId); // 恢复查找用户的代码
    if (!user) {
      console.log(`❌ payment/create: 找不到用户 ${userId}`);
      return NextResponse.json({ error: '找不到用户信息' }, { status: 404, headers: corsHeaders });
    }

    // 2. 创建内部订单记录 (数据库)
    const internalOrderId = `MEMBER_${userId}_${Date.now()}`; // 内部订单号
    const orderAmount = 0.01; // 测试金额
    console.log(`📝 payment/create: 准备为用户 ${userId} 创建数据库订单 ${internalOrderId}, 金额 ${orderAmount}`);

    // --- 新增：创建订单记录到数据库 ---
    try {
      const newOrder = new Order({
        orderId: internalOrderId,
        userId: userId,
        amount: orderAmount,
        status: OrderStatus.Pending, // 初始状态为待支付
        paymentGateway: 'alipay',
      });
      await newOrder.save();
      console.log(`💾 payment/create: 订单 ${internalOrderId} 已保存到数据库，状态: ${OrderStatus.Pending}`);
    } catch (dbError: any) {
      console.error('❌ payment/create: 保存订单到数据库失败:', dbError);
      // 如果订单号已存在 (unique constraint)，理论上不应发生，但也处理一下
      if (dbError.code === 11000) {
          console.error(`订单号 ${internalOrderId} 已存在，可能重复请求?`);
          return NextResponse.json({ error: '订单创建失败，请稍后重试' }, { status: 500, headers: corsHeaders });
      }
      return NextResponse.json({ error: '订单创建失败' }, { status: 500, headers: corsHeaders });
    }
    // --- 新增结束 ---

    // 初始化支付宝 SDK
    const alipaySdk = new AlipaySdk({ // 恢复 SDK 初始化代码
      appId: alipayConfig.appId,
      privateKey: alipayConfig.privateKey,
      alipayPublicKey: alipayConfig.alipayPublicKey,
      gateway: alipayConfig.gateway,
      keyType: 'PKCS8', // 指定密钥类型为PKCS8
    });

    // 准备业务参数
    const bizContent = { // 恢复业务参数代码
      out_trade_no: internalOrderId,
      total_amount: orderAmount.toFixed(2),
      subject: '智能求职助手 Pro 会员 - 测试支付', // 可以修改标题以区分
      product_code: 'FAST_INSTANT_TRADE_PAY',
    };

    // 调用支付宝接口生成支付页面 URL
    try { // 恢复调用支付宝接口的代码
      console.log('⚙️ payment/create: 调用支付宝 pageExecute (真实)...', bizContent);
      // 使用 pageExecute 方法生成支付链接
      const result = alipaySdk.pageExecute('alipay.trade.page.pay', 'GET', {
        bizContent,
        notifyUrl: alipayConfig.notifyUrl,
        returnUrl: alipayConfig.returnUrl
      });

      console.log('✅ payment/create: 支付宝订单创建/获取支付链接成功 (真实)');
      // result 是支付宝支付页面的 URL
      return NextResponse.json({ success: true, paymentUrl: result }, { headers: corsHeaders });

    } catch (alipayError: any) {
      console.error('❌ payment/create: 调用支付宝 SDK 失败 (真实):', alipayError);
      // 考虑更新数据库中的订单状态为 Failed
      try {
          await Order.findOneAndUpdate({ orderId: internalOrderId }, { status: OrderStatus.Failed });
          console.log(`🔄 payment/create: 订单 ${internalOrderId} 状态更新为 ${OrderStatus.Failed}`);
      } catch (updateError) {
          console.error(`❌ payment/create: 更新订单 ${internalOrderId} 状态为 Failed 失败:`, updateError);
      }
      // 返回错误给前端
      if (alipayError.message && (alipayError.message.includes('error sign') || alipayError.message.includes('invalid sign'))) {
        console.error('支付宝签名错误，请检查 .env.local 中的 appId, privateKey, alipayPublicKey 配置是否正确且匹配!');
      }
      if (alipayError.response) {
        console.error('支付宝返回错误详情:', alipayError.response);
        return NextResponse.json({ error: '创建支付订单失败', details: alipayError.response.subMsg || alipayError.message }, { status: 500, headers: corsHeaders });
      } else {
        return NextResponse.json({ error: '创建支付订单失败', details: alipayError.message }, { status: 500, headers: corsHeaders });
      }
    }

  } catch (error: any) { // 恢复错误处理代码
    console.error('❌❌❌ payment/create: 处理创建订单请求失败 (真实):', error);
    return NextResponse.json(
      { error: '处理请求失败', details: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}