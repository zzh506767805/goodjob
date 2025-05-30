import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { verifyAuth } from '@/lib/authUtils';
import Application from '@/models/Application';
import User, { IUser } from '@/models/User';
import { cleanJobDescription } from '@/lib/textUtils';
import { isSameDay } from 'date-fns';

// --- CORS Headers --- 
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // 更安全的做法是指定插件的ID
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// 处理 OPTIONS 预检请求 (CORS 必需)
export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204, // No Content
    headers: corsHeaders,
  });
}

export async function POST(req: NextRequest) {
  console.log('📩 收到投递记录请求');
  try {
    // 连接数据库
    await connectToDatabase();
    console.log('✅ 数据库连接成功');

    // 验证用户身份
    const userId = verifyAuth(req);
    if (!userId) {
      console.log('❌ track-submission: User verification failed (userId is null).');
      return NextResponse.json(
        { error: '未授权' }, 
        { status: 401, headers: corsHeaders }
      );
    }
    console.log('✅ track-submission: User verified. Proceeding with userId:', userId);

    // --- 获取用户信息并检查投递限制 ---
    console.log(`🔍 track-submission: Attempting to find user and check submission limits for userId: ${userId}`);
    // 同时获取默认简历ID和会员/投递信息 (确保包含 membershipExpiry)
    const user: IUser | null = await User.findById(userId).select('+defaultResumeId +isMember +dailySubmissions +lastSubmissionDate +membershipExpiry');

    if (!user) {
      console.log('❌ track-submission: User not found in database for userId:', userId);
      return NextResponse.json(
        { error: '找不到用户信息，请确认用户是否有效' }, 
        { status: 404, headers: corsHeaders }
      );
    }
    if (!user.defaultResumeId) {
      console.log('❌ track-submission: User found, but defaultResumeId is not set for userId:', userId);
      return NextResponse.json(
        { error: '操作失败：请先在您的个人资料中设置一个默认简历。' }, 
        { status: 400, headers: corsHeaders }
      );
    }

    // **** 新增：判断用户是否为有效会员 ****
    const now = new Date();
    const isEffectivelyMember = !!user.isMember && !!user.membershipExpiry && user.membershipExpiry > now;
    console.log(`ℹ️ track-submission: 用户 ${userId} - isMember: ${user.isMember}, expiry: ${user.membershipExpiry}, isEffectivelyMember: ${isEffectivelyMember}`);
    // **** 新增结束 ****

    const today = new Date();
    let dailySubmissions = user.dailySubmissions ?? 0;

    // 检查是否需要重置每日投递次数
    if (!user.lastSubmissionDate || !isSameDay(user.lastSubmissionDate, today)) {
      console.log(`🔄 track-submission: Resetting daily submissions for user ${userId}.`);
      dailySubmissions = 0; // 重置计数
      // 注意：这里不直接更新数据库，让 /api/user/status 去处理后台更新
    }

    // 定义会员和非会员的限制 (使用 isEffectivelyMember)
    const submissionLimit = isEffectivelyMember ? 200 : 3; // 👈 使用实际有效会员状态
    console.log(`📊 track-submission: User ${userId} status - isEffectivelyMember: ${isEffectivelyMember}, Limit: ${submissionLimit}, Current submissions: ${dailySubmissions}`);

    // 检查是否达到投递上限
    if (dailySubmissions >= submissionLimit) {
      console.log(`🚫 track-submission: User ${userId} has reached the submission limit of ${submissionLimit}.`);
      const message = isEffectivelyMember
        ? `您今天的 ${submissionLimit} 次投递机会已用完。`
        : `非会员每日投递上限为 ${submissionLimit} 次。升级会员可享每日 200 次投递特权！`;
      return NextResponse.json(
        { error: message, limitReached: true },
        { status: 429, headers: corsHeaders }
      );
    }
    console.log(`👍 track-submission: User ${userId} is within submission limits.`);
    // --- 检查结束 ---

    // 解析请求数据
    const submissionData = await req.json();
    console.log('📝 track-submission: Received submission data:', JSON.stringify(submissionData).substring(0, 500) + '...');
    
    // 基本验证
    if (!submissionData || !submissionData.jobTitle || !submissionData.companyName) {
      console.log('❌ track-submission: Request data missing required fields.');
      return NextResponse.json(
        { error: '缺少必要信息', receivedData: submissionData }, 
        { status: 400, headers: corsHeaders }
      );
    }

    // 创建投递记录 (保存到Application模型)
    try {
      // **清理职位描述**
      console.log('🧹 track-submission: Cleaning job description before saving...');
      console.log('   [Before Clean]:', submissionData.jobDescription?.substring(0, 200) + '...');
      const cleanedDescription = cleanJobDescription(submissionData.jobDescription);
      console.log('   [After Clean]:', cleanedDescription?.substring(0, 200) + '...');
      
      // 准备数据对象，移除 status 和 platformLink
      const applicationData = {
        userId,
        resumeId: user.defaultResumeId,
        companyName: submissionData.companyName,
        positionName: submissionData.jobTitle,
        jobDescription: cleanedDescription,
        appliedAt: submissionData.timestamp ? new Date(submissionData.timestamp) : new Date(),
        messageContent: submissionData.greeting || '',
        matchScore: 0,
        notes: ''
      };
      
      // 清理 applicationData 中的 null/undefined 字段 (可选但推荐)
      Object.keys(applicationData).forEach(key => 
        (applicationData as any)[key] === undefined && delete (applicationData as any)[key]
      );
      
      console.log('🔍 track-submission: Preparing to create Application data (simplified): ', JSON.stringify(applicationData).substring(0, 500) + '...');
      
      const newApplication = await Application.create(applicationData);
      
      console.log('✅✅ track-submission: Application record created successfully:', newApplication._id);
      
      // *** 重要：记录本次投递，但不立即增加 dailySubmissions 计数 ***
      // 而是更新 lastSubmissionDate，让 /api/user/status 下次调用时根据日期差重置或维持计数
      // （如果需要实时计数，则需要在这里 +1 并更新数据库）
      
      // 只是记录，暂时不在这里增加计数和更新数据库
      // const newSubmissionCount = dailySubmissions + 1;
      // await User.findByIdAndUpdate(userId, { 
      //     dailySubmissions: newSubmissionCount,
      //     lastSubmissionDate: today 
      // });
      console.log(`✅ track-submission: 允许用户 ${userId} 投递，今日计数将在下次状态查询时更新。`);

      // --- 更新用户投递次数和日期 ---
      user.dailySubmissions = dailySubmissions + 1;
      user.lastSubmissionDate = today;
      await user.save();
      console.log(`📈 track-submission: Updated user ${userId} submission count to ${user.dailySubmissions}, last submission date to ${today.toISOString().split('T')[0]}`);
      // --- 更新结束 ---

      // 返回成功响应
      return NextResponse.json(
        { message: '投递请求已记录（计数将在下次刷新时更新）' }, 
        { status: 200, headers: corsHeaders }
      );
      
    } catch (dbError: any) {
      console.error('❌❌ 创建投递记录失败:', dbError);
      // 添加更详细的错误信息
      let errorDetails = dbError.message;
      if (dbError.errors) {
        errorDetails = Object.keys(dbError.errors).map(key => 
          `${key}: ${dbError.errors[key].message}`
        ).join(', ');
      }
      
      return NextResponse.json(
        { error: '保存投递记录失败', details: errorDetails }, 
        { status: 500, headers: corsHeaders }
      );
    }
    
  } catch (error: any) {
    console.error('❌❌❌ 处理投递记录请求失败:', error);
    return NextResponse.json(
      { error: '处理请求失败', details: error.message }, 
      { status: 500, headers: corsHeaders }
    );
  }
} 