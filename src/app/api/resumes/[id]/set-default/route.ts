import { NextRequest, NextResponse } from 'next/server';
import Resume from '@/models/Resume';
import User from '@/models/User';
import connectToDatabase from '@/lib/mongodb';

// 定义标准的路由参数类型
type RouteParams = {
  params: { 
    id: string;
  };
};

export async function PUT(
  req: NextRequest,
  { params }: RouteParams // 使用标准的路由参数接收方式
) {
  try {
    await connectToDatabase();
    
    // 从请求头获取用户ID
    const userId = req.headers.get('x-user-id');
    if (!userId) {
      console.error('❌ set-default: Missing x-user-id header for user identification.');
      return NextResponse.json({ error: '未授权或无法识别用户' }, { status: 401 });
    }
    console.log(`✅ set-default: Processing request for user: ${userId}`);
    
    // 通过 params.id 获取 resumeId
    const resumeId = params.id;
    console.log(`📄 set-default: Target resumeId: ${resumeId}`);
    
    // 验证简历是否存在且属于该用户
    const resume = await Resume.findOne({ _id: resumeId, userId });
    if (!resume) {
      console.log(`❌ set-default: Resume not found or does not belong to user ${userId}. ResumeId: ${resumeId}`);
      return NextResponse.json({ error: '找不到简历或无权操作' }, { status: 404 });
    }
    console.log(`✅ set-default: Resume found for user ${userId}.`);
    
    // 2. 直接更新 User 表中的 defaultResumeId 字段
    console.log(`👤 set-default: Updating defaultResumeId for user ${userId} to ${resumeId}...`);
    const updateUserResult = await User.updateOne(
      { _id: userId }, // 查询条件：用户 ID
      { $set: { defaultResumeId: resumeId } } // 更新操作：设置 defaultResumeId
    );

    // 检查用户更新操作是否成功
    if (updateUserResult.matchedCount === 0) {
      console.error(`❌ set-default: User not found when trying to update defaultResumeId. UserId: ${userId}`);
      // 理论上不应该发生，因为前面已经验证过用户（通过简历）
      // 但作为健壮性检查，如果用户记录真的找不到了，需要报错
      return NextResponse.json({ error: '更新用户信息失败，找不到用户' }, { status: 404 });
    }
    if (updateUserResult.modifiedCount === 0 && updateUserResult.matchedCount === 1) {
       console.log(`ℹ️ set-default: User ${userId} defaultResumeId was already set to ${resumeId}. No change made.`);
       // 如果用户存在但没有修改，说明该简历已经是默认简历
    } else {
       console.log(`✅ set-default: Successfully updated defaultResumeId for user ${userId}.`);
    }
    
    return NextResponse.json({ message: '设置默认简历成功' });
  } catch (error: any) {
    console.error('❌ set-default: Error setting default resume:', error);
    return NextResponse.json({ error: '设置默认简历失败', details: error.message }, { status: 500 });
  }
} 