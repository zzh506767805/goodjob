import { NextRequest, NextResponse } from 'next/server';
import Application from '@/models/Application';
import Resume from '@/models/Resume';
import connectToDatabase from '@/lib/mongodb';

// 获取用户的所有投递记录
export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    
    // 从请求头获取用户ID
    const userId = req.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    // 解析查询参数
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const resumeId = searchParams.get('resumeId');
    
    // 构建查询条件
    const query: any = { userId };
    if (status) {
      query.status = status;
    }
    if (resumeId) {
      query.resumeId = resumeId;
    }

    // 查询投递记录
    const applications = await Application.find(query)
      .sort({ appliedAt: -1 })
      .populate('resumeId', 'name fileUrl');
    
    return NextResponse.json({ applications });
  } catch (error: any) {
    console.error('获取投递记录失败:', error);
    return NextResponse.json({ error: '获取投递记录失败', details: error.message }, { status: 500 });
  }
}

// 创建新的投递记录
export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    
    // 从请求头获取用户ID
    const userId = req.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    // 解析请求数据
    const {
      resumeId,
      companyName,
      positionName,
      jobDescription,
      messageContent,
      platformLink,
      matchScore
    } = await req.json();

    // 验证必要字段
    if (!resumeId || !companyName || !positionName || !jobDescription || !messageContent || !platformLink) {
      return NextResponse.json({ error: '请提供完整的投递信息' }, { status: 400 });
    }

    // 验证简历是否存在且属于该用户
    const resume = await Resume.findOne({ _id: resumeId, userId });
    if (!resume) {
      return NextResponse.json({ error: '简历不存在或无权访问' }, { status: 404 });
    }

    // 创建投递记录
    const application = await Application.create({
      userId,
      resumeId,
      companyName,
      positionName,
      jobDescription,
      messageContent,
      platformLink,
      matchScore: matchScore || 0,
      status: 'applied',
      appliedAt: new Date(),
      notes: ''
    });

    return NextResponse.json({
      message: '创建投递记录成功',
      application: {
        id: application._id,
        companyName: application.companyName,
        positionName: application.positionName,
        status: application.status,
        appliedAt: application.appliedAt
      }
    }, { status: 201 });
  } catch (error: any) {
    console.error('创建投递记录失败:', error);
    return NextResponse.json({ error: '创建投递记录失败', details: error.message }, { status: 500 });
  }
} 