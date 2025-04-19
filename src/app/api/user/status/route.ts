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

    // 3. 查询用户信息 (确保查询 membershipExpiry)
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

    // **** 新增：判断用户是否为有效会员 ****
    const now = new Date();
    const isEffectivelyMember = !!user.isMember && !!user.membershipExpiry && user.membershipExpiry > now;
    console.log(`ℹ️ user/status: 用户 ${userId} - isMember: ${user.isMember}, expiry: ${user.membershipExpiry}, isEffectivelyMember: ${isEffectivelyMember}`);
    // **** 新增结束 ****

    // 4. 检查并可能重置每日投递次数
    const today = new Date();
    let dailySubmissions = user.dailySubmissions ?? 0;
    let needsReset = false;

    if (!user.lastSubmissionDate || !isSameDay(user.lastSubmissionDate, today)) {
      console.log(`🔄 user/status: 需要为用户 ${userId} 重置每日投递次数.`);
      dailySubmissions = 0;
      needsReset = true;
    }

    // 5. 计算剩余次数 (使用 isEffectivelyMember 判断限额)
    const submissionLimit = isEffectivelyMember ? 200 : 3; // 👈 使用实际有效会员状态
    const remainingSubmissions = Math.max(0, submissionLimit - dailySubmissions);
    console.log(`📊 user/status: 用户 ${userId} - 有效会员: ${isEffectivelyMember}, 限额: ${submissionLimit}, 今日已投递: ${dailySubmissions}, 剩余: ${remainingSubmissions}`);

    // 6. 如果需要重置，更新数据库 (后台静默更新)
    if (needsReset) {
      User.findByIdAndUpdate(userId, { dailySubmissions: 0, lastSubmissionDate: today })
        .exec()
        .then(() => console.log(`✅ user/status: 已在后台为用户 ${userId} 重置投递次数`))
        .catch(err => console.error(`❌ user/status: 后台重置用户 ${userId} 投递次数失败:`, err));
    }

    // 7. 准备用户信息 (返回 isEffectivelyMember 供前端精确判断)
    // 确保 user._id 存在且是 ObjectId 才调用 toString
    const userIdString = user._id instanceof mongoose.Types.ObjectId ? user._id.toString() : (user._id as any)?.toString();
    if (!userIdString) {
        console.error(`❌ user/status: Failed to convert user._id to string for user: ${JSON.stringify(user)}`);
        // 根据实际情况决定如何处理，这里暂时返回错误
        return NextResponse.json({ error: '无法处理用户ID' }, { status: 500, headers: corsHeaders });
    }
    const userInfo = {
      id: userIdString,
      name: user.name,
      email: user.email,
      isMember: user.isMember || false, // 保留原始 isMember 字段
      membershipExpiry: user.membershipExpiry || null,
      isEffectivelyMember: isEffectivelyMember // 👈 新增返回字段
    };

    // 8. 返回状态信息和用户信息
    return NextResponse.json(
      {
        user: userInfo,
        isMember: isEffectivelyMember, // 👈 isMember 也返回有效状态，保持兼容性或供简单判断
        membershipExpiry: user.membershipExpiry || null,
        remainingSubmissions: remainingSubmissions,
        limit: submissionLimit,
        isEffectivelyMember: isEffectivelyMember // 👈 明确返回有效会员状态
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