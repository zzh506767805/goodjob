import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import Order, { OrderStatus, IOrder } from '@/models/Order';
const { AlipaySdk } = require('alipay-sdk');
import { alipayConfig } from '@/lib/config';
import { addMonths } from 'date-fns';
// 注意：如果需要验证用户身份，可以取消注释下一行并确保 verifyAuth 正确实现
// import { verifyAuth } from '@/lib/authUtils';

// 初始化支付宝 SDK 实例 (仅用于查询)
const alipaySdk = new AlipaySdk({
  appId: alipayConfig.appId,
  privateKey: alipayConfig.privateKey,
  alipayPublicKey: alipayConfig.alipayPublicKey,
  gateway: alipayConfig.gateway,
  keyType: 'PKCS8',
});

export async function POST(req: NextRequest) {
  console.log('🔍 收到前端查询订单状态请求');
  let outTradeNo: string | undefined;

  try {
    // 可选：验证用户身份
    // const userIdFromAuth = verifyAuth(req);
    // if (!userIdFromAuth) {
    //   console.log('❌ check-status: 用户验证失败');
    //   return NextResponse.json({ success: false, error: '未授权' }, { status: 401 });
    // }
    // console.log(`✅ check-status: 用户已验证: ${userIdFromAuth}`);

    const body = await req.json();
    outTradeNo = body.outTradeNo;

    if (!outTradeNo) {
      console.log('❌ check-status: 请求中缺少 outTradeNo');
      return NextResponse.json({ success: false, error: '缺少订单号' }, { status: 400 });
    }
    console.log(`📊 check-status: 准备查询订单号: ${outTradeNo}`);

    // 1. 调用支付宝查询接口
    console.log('⚙️ check-status: 调用支付宝 alipay.trade.query...');
    let queryResult;
    try {
        // 使用 exec 方法执行查询
        queryResult = await alipaySdk.exec('alipay.trade.query', {
          bizContent: { out_trade_no: outTradeNo },
        }, {
          // 可选：指定验签、加解密等选项，如果支付宝有要求
        });
        console.log('📬 check-status: 支付宝查询接口原始返回:', JSON.stringify(queryResult));

        // 检查返回码是否成功 (支付宝接口规范)
        if (queryResult.code !== '10000') {
            console.error(`❌ check-status: 支付宝查询失败: code=${queryResult.code}, subCode=${queryResult.subCode}, subMsg=${queryResult.subMsg}`);
            // 根据 subCode 判断是否需要重试或返回特定错误
            if (queryResult.subCode === 'ACQ.TRADE_NOT_EXIST') {
                 return NextResponse.json({ success: false, error: '支付宝侧未找到该订单' }, { status: 404 });
            }
            return NextResponse.json({ success: false, error: `查询支付宝订单失败: ${queryResult.subMsg || queryResult.msg}` }, { status: 500 });
        }

    } catch (alipayError: any) {
      console.error('❌ check-status: 调用支付宝查询 SDK 失败:', alipayError);
       if (alipayError.message && (alipayError.message.includes('error sign') || alipayError.message.includes('invalid sign'))) {
        console.error('支付宝签名/验签错误，请检查 .env 中的 appId, privateKey, alipayPublicKey 配置是否正确且匹配!');
      }
      if (alipayError.response) {
          console.error('支付宝查询返回错误详情:', alipayError.response);
          return NextResponse.json({ success: false, error: '查询支付宝订单时出错', details: alipayError.response.subMsg || alipayError.message }, { status: 500 });
      } else {
          return NextResponse.json({ success: false, error: '查询支付宝订单时出错', details: alipayError.message }, { status: 500 });
      }
    }

    // 2. 处理业务逻辑
    const tradeStatus = queryResult.tradeStatus; // 获取支付状态
    const tradeNo = queryResult.tradeNo;       // 获取支付宝交易号
    const totalAmount = parseFloat(queryResult.totalAmount); // 获取订单金额
    const buyerPayAmount = parseFloat(queryResult.buyerPayAmount); // 用户实付金额 (更可靠)

    console.log(`ℹ️ check-status: 支付宝返回状态: ${tradeStatus}, 交易号: ${tradeNo}, 金额: ${totalAmount}, 实付: ${buyerPayAmount}`);

    if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') { // TRADE_FINISHED 也算成功
      await connectToDatabase();
      try {
        const order: IOrder | null = await Order.findOne({ orderId: outTradeNo });

        if (!order) {
          console.error(`❌ check-status: 数据库找不到订单号 ${outTradeNo}!`);
          // 虽然支付宝确认支付，但我们库里没订单，这不正常，返回错误
          return NextResponse.json({ success: false, error: '系统内部错误：找不到订单记录' }, { status: 500 });
        }

        // 检查订单用户是否匹配 (如果做了用户验证)
        // if (order.userId.toString() !== userIdFromAuth) {
        //   console.error(`❌ check-status: 订单用户 ${order.userId} 与当前登录用户 ${userIdFromAuth} 不匹配!`);
        //   return NextResponse.json({ success: false, error: '无权操作该订单' }, { status: 403 });
        // }

        // 检查订单状态是否已经是 Paid，防止重复处理
        if (order.status === OrderStatus.Paid) {
          console.log(`🔁 check-status: 订单 ${outTradeNo} 状态已为 Paid，无需重复处理。`);
          return NextResponse.json({ success: true, message: '您的会员权限已生效。' });
        }

        // 再次检查金额是否匹配 (使用 buyerPayAmount 可能更准)
        if (Math.abs(buyerPayAmount - order.amount) > 0.01) {
            console.warn(`⚠️ check-status: 订单 ${outTradeNo} 金额不匹配! 数据库记录金额: ${order.amount}, 支付宝实付金额: ${buyerPayAmount}`);
            // 金额不匹配，可能需要人工介入，更新订单为异常状态
            await Order.findByIdAndUpdate(order._id, { status: OrderStatus.Failed, $push: { logs: `金额不匹配: 预期 ${order.amount}, 实际支付 ${buyerPayAmount}` } });
            return NextResponse.json({ success: false, error: '支付金额异常，请联系客服处理' }, { status: 400 });
        }
        console.log(`✅ check-status: 订单 ${outTradeNo} 金额匹配`);

        // 更新订单状态为 Paid
        order.status = OrderStatus.Paid;
        order.transactionId = tradeNo; // 记录支付宝交易号
        order.paidAt = new Date(); // 记录支付确认时间（或从支付宝获取 gmt_payment）
        await order.save();
        console.log(`💾 check-status: 订单 ${outTradeNo} 状态更新为 Paid`);

        // 更新用户会员状态
        const userId = order.userId;
        console.log(`👤 check-status: 准备更新用户 ${userId} 的会员状态`);
        try {
            const newExpiryDate = addMonths(new Date(), 1); // 计算新的到期日
            
            // --- 改用 .save() 方式更新 ---
            const userToUpdate = await User.findById(userId);
            if (!userToUpdate) {
                console.error(`❌ check-status: 更新时再次查询用户 ${userId} 未找到!`);
                return NextResponse.json({ success: true, message: '支付成功，会员状态更新可能稍有延迟。' });
            }

            userToUpdate.isMember = true;
            userToUpdate.membershipExpiry = newExpiryDate;
            userToUpdate.markModified('membershipExpiry');
            const savedUser = await userToUpdate.save(); // 调用 save 方法
            // --- 更新结束 ---

            // 增加日志：打印保存后的 user 对象，看 expiry 是否存在
            console.log('💾 check-status: User object after save:', JSON.stringify(savedUser)); 

            if (!savedUser) { // 理论上 save 失败会抛错，但加个保险
                console.error(`❌ check-status: 更新用户 ${userId} 会员状态时 save 返回为空或失败`);
                 return NextResponse.json({ success: true, message: '支付成功，会员状态更新可能稍有延迟，请稍后刷新。' });
            } else {
                // 检查保存后的对象中是否有 membershipExpiry (进一步确认)
                if (savedUser.membershipExpiry) {
                    console.log(`✅✅ check-status: 用户 ${userId} 会员状态已更新 (通过 save)! 到期时间: ${savedUser.membershipExpiry}`);
                } else {
                    console.error(`❌ check-status: 用户 ${userId} save 后返回的对象中没有 membershipExpiry!`);
                }
                return NextResponse.json({ success: true, message: '支付成功，会员已开通！' });
            }
        } catch (userUpdateError: any) {
            console.error(`❌❌ check-status: 更新用户 ${userId} 数据库失败 (save 抛错):`, userUpdateError);
            return NextResponse.json({ success: true, message: '支付成功，会员状态更新处理中，请稍后查看。' });
        }

      } catch (dbError: any) {
        console.error(`❌❌ check-status: 处理订单 ${outTradeNo} 时数据库操作失败:`, dbError);
        return NextResponse.json({ success: false, error: '系统内部错误，请联系客服' }, { status: 500 });
      }
    } else if (tradeStatus === 'WAIT_BUYER_PAY') {
      console.log(`⏳ check-status: 订单 ${outTradeNo} 状态为等待支付`);
      return NextResponse.json({ success: false, error: '订单尚未支付，请完成后再试' }, { status: 400 });
    } else if (tradeStatus === 'TRADE_CLOSED') {
       console.log(`🚫 check-status: 订单 ${outTradeNo} 已关闭`);
        // 可以考虑更新本地订单状态为 Failed 或 Cancelled
        try {
             await Order.findOneAndUpdate(
               { orderId: outTradeNo, status: OrderStatus.Pending },
               { status: OrderStatus.Failed }
           );
        } catch (e) {/* ignore */}
       return NextResponse.json({ success: false, error: '订单已关闭' }, { status: 400 });
    } else {
      // 其他未知状态
      console.log(`❓ check-status: 订单 ${outTradeNo} 状态未知: ${tradeStatus}`);
      return NextResponse.json({ success: false, error: `订单状态异常: ${tradeStatus}` }, { status: 400 });
    }

  } catch (error: any) {
    console.error('❌❌❌ check-status: 处理查询请求时发生严重错误:', error);
    if (outTradeNo) {
        console.error('Failed query for outTradeNo:', outTradeNo);
    }
    return NextResponse.json(
      { success: false, error: '处理请求失败', details: error.message },
      { status: 500 }
    );
  }
} 