import { NextRequest, NextResponse } from 'next/server';
import Application from '@/models/Application';
import connectToDatabase from '@/lib/mongodb';

export async function PUT(
  req: NextRequest,
  context: { params: { id: string } }
) {
  try {
    await connectToDatabase();
    
    // 从请求头获取用户ID
    const userId = req.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    
    const applicationId = context.params.id;
    
    // 解析请求体
    const { notes } = await req.json();
    
    // 验证投递记录是否存在且属于该用户
    const application = await Application.findOne({ _id: applicationId, userId });
    if (!application) {
      return NextResponse.json({ error: '找不到投递记录' }, { status: 404 });
    }
    
    // 更新备注
    await Application.updateOne(
      { _id: applicationId },
      { $set: { notes } }
    );
    
    return NextResponse.json({ message: '更新备注成功' });
  } catch (error: any) {
    console.error('更新备注失败:', error);
    return NextResponse.json({ error: '更新备注失败', details: error.message }, { status: 500 });
  }
} 