import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { verifyAuth } from '@/lib/authUtils';
import User from '@/models/User';

// 本接口仅用于开发和测试环境
export async function POST(req: NextRequest) {
  try {
    // 1. 连接数据库
    await connectToDatabase();
    
    // 2. 验证用户身份 (这里应该有更严格的管理员验证)
    const userId = verifyAuth(req);
    if (!userId) {
      return NextResponse.json(
        { error: '未授权' },
        { status: 401 }
      );
    }
    
    // 3. 解析请求数据
    const { targetUserId, isMember, expiryDate } = await req.json();
    
    if (!targetUserId) {
      return NextResponse.json(
        { error: '缺少目标用户ID' },
        { status: 400 }
      );
    }
    
    // 4. 准备更新数据
    const updateData: any = {};
    
    if (typeof isMember === 'boolean') {
      updateData.isMember = isMember;
    }
    
    if (expiryDate) {
      updateData.membershipExpiry = new Date(expiryDate);
    } else if (isMember === false) {
      // 如果取消会员资格，清除到期时间
      updateData.membershipExpiry = null;
    }
    
    // 5. 更新用户
    const updatedUser = await User.findByIdAndUpdate(
      targetUserId,
      { $set: updateData },
      { new: true }
    ).select('name email isMember membershipExpiry');
    
    if (!updatedUser) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      );
    }
    
    // 6. 返回更新后的用户信息
    return NextResponse.json({
      message: '会员状态更新成功',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        isMember: updatedUser.isMember,
        membershipExpiry: updatedUser.membershipExpiry
      }
    });
    
  } catch (error: any) {
    console.error('更新会员状态失败:', error);
    return NextResponse.json(
      { error: '更新会员状态失败', details: error.message },
      { status: 500 }
    );
  }
} 