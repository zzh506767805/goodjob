import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { verifyAuth } from '@/lib/authUtils';
import User, { IUser } from '@/models/User';
import { isSameDay } from 'date-fns';
import mongoose from 'mongoose';

// --- CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // 允许来自任何源的请求，生产环境建议指定插件ID
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// 处理 OPTIONS 预检请求 (CORS 必需)
export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204, // No Content
    headers: corsHeaders,
  });
}

// 处理 GET 请求
export async function GET(req: NextRequest) {
  console.log('📊 收到获取用户状态请求');
  try {
    // 1. 连接数据库
    await connectToDatabase();
    console.log('✅ user/status: 数据库连接成功');

    // 2. 验证用户身份
    const userId = verifyAuth(req);
    if (!userId) {
      console.log('❌ user/status: 用户验证失败 (userId is null)');
      return NextResponse.json(
        { error: '未授权' },
        { status: 401, headers: corsHeaders }
      );
    }
    console.log(`✅ user/status: 用户已验证，用户ID: ${userId}`);

    // 3. 查询用户信息
    console.log(`🔍 user/status: 正在查找用户 ${userId} 的状态信息...`);
    const user: IUser | null = await User.findById(userId).select('+isMember +dailySubmissions +lastSubmissionDate +membershipExpiry');

    if (!user) {
      console.log(`❌ user/status: 找不到用户 ${userId} 的信息`);
      return NextResponse.json(
        { error: '找不到用户信息' },
        { status: 404, headers: corsHeaders }
      );
    }
    console.log(`✅ user/status: 找到用户 ${userId} 的信息`);

    // 4. 检查并可能重置每日投递次数
    const today = new Date();
    let dailySubmissions = user.dailySubmissions ?? 0; // 使用 ?? 运算符提供默认值 0
    let needsReset = false;

    if (!user.lastSubmissionDate || !isSameDay(user.lastSubmissionDate, today)) {
      console.log(`🔄 user/status: 需要为用户 ${userId} 重置每日投递次数. 上次投递: ${user.lastSubmissionDate}, 今天: ${today}`);
      dailySubmissions = 0; // 重置计数
      needsReset = true; // 标记需要更新数据库
    }

    // 5. 计算剩余次数
    const submissionLimit = user.isMember ? 200 : 3;
    const remainingSubmissions = Math.max(0, submissionLimit - dailySubmissions); // 确保不为负数
    console.log(`📊 user/status: 用户 ${userId} - 会员: ${user.isMember}, 限额: ${submissionLimit}, 今日已投递 (重置后): ${dailySubmissions}, 剩余: ${remainingSubmissions}`);

    // 6. 如果需要重置，更新数据库 (后台静默更新，不影响本次返回)
    if (needsReset) {
      User.findByIdAndUpdate(userId, { dailySubmissions: 0, lastSubmissionDate: today })
        .exec() // 执行更新
        .then(() => console.log(`✅ user/status: 已在后台为用户 ${userId} 重置投递次数`))
        .catch(err => console.error(`❌ user/status: 后台重置用户 ${userId} 投递次数失败:`, err));
    }

    // 7. 准备用户信息
    const userInfo = {
      id: user._id instanceof mongoose.Types.ObjectId ? user._id.toString() : user._id,
      name: user.name,
      email: user.email,
      isMember: user.isMember || false,
      membershipExpiry: user.membershipExpiry || null
    };

    // 8. 返回状态信息和用户信息
    return NextResponse.json(
      {
        user: userInfo,
        isMember: user.isMember || false,
        membershipExpiry: user.membershipExpiry || null,
        remainingSubmissions: remainingSubmissions,
        limit: submissionLimit, // 把总限额也返回给前端，方便显示 "X / Y 次"
      },
      { headers: corsHeaders }
    );

  } catch (error: any) {
    console.error('❌❌❌ user/status: 处理获取用户状态请求失败:', error);
    return NextResponse.json(
      { error: '处理请求失败', details: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
} 