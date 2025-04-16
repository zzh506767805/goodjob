import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import Order, { OrderStatus, IOrder } from '@/models/Order'; // 导入 Order 模型、状态和类型
// 导入 AlipaySdk 类，从官方示例 alipay-sdk-nodejs-all 项目中正确引入
const { AlipaySdk } = require('alipay-sdk');
import { alipayConfig } from '@/lib/config';
import { addMonths } from 'date-fns'; // 用于计算会员到期日

// 注意：支付宝的异步通知不需要 CORS headers

// 初始化支付宝 SDK 实例 (用于验签)，并明确指定 keyType
const alipaySdk = new AlipaySdk({
  appId: alipayConfig.appId,
  privateKey: alipayConfig.privateKey, 
  alipayPublicKey: alipayConfig.alipayPublicKey,
  gateway: alipayConfig.gateway,
  keyType: 'PKCS8', // 指定密钥类型为PKCS8
});

export async function POST(req: NextRequest) {
  console.log('🔔 收到支付宝异步通知');
  let notificationData: Record<string, string> | null = null;

  try {
    const formData = await req.formData();
    notificationData = Object.fromEntries(formData.entries()) as Record<string, string>;
    console.log('📬 支付宝通知内容 (原始):', JSON.stringify(notificationData));

    // 1. 进行支付宝验签
    console.log('🔐 准备进行支付宝验签...');
    // 使用 checkNotifySign 方法验证支付宝异步通知请求的签名
    const checkSignResult = alipaySdk.checkNotifySign(notificationData);
    if (!checkSignResult) {
      console.error('❌ alipay-notify: 验签失败! 请求可能伪造或支付宝公钥配置错误。', notificationData);
      return new NextResponse('failure', { status: 400, headers: { 'Content-Type': 'text/plain' } });
    }
    console.log('✅ alipay-notify: 验签成功');

    // 2. 处理业务逻辑
    const trade_status = notificationData.trade_status;
    const out_trade_no = notificationData.out_trade_no;
    const total_amount = parseFloat(notificationData.total_amount);
    const trade_no = notificationData.trade_no; // 支付宝交易号
    const gmt_payment = notificationData.gmt_payment; // 支付时间字符串
    const expectedAmount = 0.01;

    console.log(`📊 alipay-notify: 订单号: ${out_trade_no}, 状态: ${trade_status}, 金额: ${total_amount}, 支付宝交易号: ${trade_no}`);

    // 检查支付状态
    if (trade_status === 'TRADE_SUCCESS') {
      
      // 检查金额是否匹配
      await connectToDatabase();
      try {
        const order: IOrder | null = await Order.findOne({ orderId: out_trade_no });

        if (!order) {
          console.error(`❌ alipay-notify: 找不到订单号 ${out_trade_no} 对应的订单记录!`);
          // 虽然找不到订单，但支付确实成功了，仍然返回 success 给支付宝，避免重发
          return new NextResponse('success', { headers: { 'Content-Type': 'text/plain' } });
        }

        // 检查订单状态是否已经是 paid，防止重复处理
        if (order.status === OrderStatus.Paid) {
          console.log(`🔁 alipay-notify: 订单 ${out_trade_no} 状态已为 Paid，无需重复处理。`);
          return new NextResponse('success', { headers: { 'Content-Type': 'text/plain' } });
        }
        
        // 检查金额是否匹配 (增加一个小的容差范围)
        if (Math.abs(total_amount - order.amount) > 0.01) {
            console.warn(`⚠️ alipay-notify: 订单 ${out_trade_no} 金额不匹配! 数据库记录金额: ${order.amount}, 通知金额: ${total_amount}`);
            // 金额不匹配，但支付可能成功，建议记录异常，但仍返回 success
            // 可以考虑将订单状态更新为异常状态
            await Order.findByIdAndUpdate(order._id, { status: OrderStatus.Failed, $push: { logs: `金额不匹配: 预期 ${order.amount}, 实际 ${total_amount}` } });
            return new NextResponse('success', { headers: { 'Content-Type': 'text/plain' } });
        }
        console.log(`✅ alipay-notify: 订单 ${out_trade_no} 金额匹配`);

        // 更新订单状态为 Paid，并记录支付信息
        order.status = OrderStatus.Paid;
        order.transactionId = trade_no;
        order.paidAt = gmt_payment ? new Date(gmt_payment) : new Date(); // 解析支付时间
        await order.save();
        console.log(`💾 alipay-notify: 订单 ${out_trade_no} 状态更新为 Paid`);

        // --- 订单更新成功后，才更新用户会员状态 ---
        const userId = order.userId;
        console.log(`👤 alipay-notify: 准备更新用户 ${userId} 的会员状态`);
        try {
            const newExpiryDate = addMonths(new Date(), 1); // 计算新的到期日
            const updatedUser = await User.findByIdAndUpdate(userId, {
                isMember: true,
                membershipExpiresAt: newExpiryDate,
            }, { new: true });

            if (!updatedUser) {
                console.error(`❌ alipay-notify: 更新用户 ${userId} 会员状态时未找到用户或更新失败`);
                // 订单已支付，但用户更新失败，需要记录错误，但仍返回 success 给支付宝
            } else {
                console.log(`✅✅ alipay-notify: 用户 ${userId} 会员状态已更新! 到期时间: ${newExpiryDate}`);
            }
            return new NextResponse('success', { headers: { 'Content-Type': 'text/plain' } });

        } catch (userUpdateError: any) {
            console.error(`❌❌ alipay-notify: 更新用户 ${userId} 数据库失败:`, userUpdateError);
            // 订单已支付，但用户更新失败，需要记录错误，但仍返回 success 给支付宝
            return new NextResponse('success', { headers: { 'Content-Type': 'text/plain' } });
        }
        // --- 用户更新结束 ---

      } catch (orderError: any) {
        console.error(`❌❌ alipay-notify: 处理订单 ${out_trade_no} 时数据库操作失败:`, orderError);
        // 数据库操作失败，返回 failure，让支付宝重试可能不是最佳选择
        // 最好记录错误，返回 success，然后手动检查
        return new NextResponse('success', { headers: { 'Content-Type': 'text/plain' } });
      }
      // --- 订单更新结束 ---

    } else {
      // 其他交易状态
      console.log(`ℹ️ alipay-notify: 订单 ${out_trade_no} 状态为 ${trade_status}，无需处理`);
      // 可以考虑根据 out_trade_no 更新数据库订单状态为 failed 或 cancelled
       try {
           await Order.findOneAndUpdate(
               { orderId: out_trade_no, status: OrderStatus.Pending }, // 仅更新待支付的订单
               { status: OrderStatus.Failed } // 或根据 trade_status 决定更合适的状态
           );
       } catch (updateError) {
           console.error(`❌ alipay-notify: 更新非成功状态订单 ${out_trade_no} 失败:`, updateError);
       }
      return new NextResponse('success', { headers: { 'Content-Type': 'text/plain' } });
    }

  } catch (error: any) {
    console.error('❌❌❌ alipay-notify: 处理支付宝通知时发生严重错误:', error);
    if (notificationData) {
      console.error('Failed notification data:', JSON.stringify(notificationData));
    }
    // 即使内部出错，也向支付宝返回 success，避免无限重试导致的问题
    // 依赖日志进行错误排查和手动处理
    return new NextResponse('success', { headers: { 'Content-Type': 'text/plain' } });
  }
} 