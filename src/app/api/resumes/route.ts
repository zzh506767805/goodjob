import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import Resume from '@/models/Resume';
import User from '@/models/User';
import connectToDatabase from '@/lib/mongodb';
import pdfParse from 'pdf-parse-fork';

// 获取用户所有简历
export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    
    // 从请求头获取用户ID
    const userId = req.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    // 获取用户的简历 (现在每个用户只有一份简历)
    const resume = await Resume.findOne({ userId });
    
    // 如果没有简历，返回空数组
    if (!resume) {
      return NextResponse.json({ resumes: [] });
    }
    
    // 返回简历，保持数组格式以兼容现有前端代码
    return NextResponse.json({ resumes: [resume] });
  } catch (error: any) {
    console.error('获取简历失败:', error);
    return NextResponse.json({ error: '获取简历失败', details: error.message }, { status: 500 });
  }
}

// 上传简历并触发后台解析
export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    
    // 从请求头获取用户ID
    const userId = req.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    // 使用formData获取文件
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const resumeName = formData.get('name') as string | null;
    
    if (!file || !resumeName) {
      return NextResponse.json({ error: '请提供简历文件和名称' }, { status: 400 });
    }

    // 仅支持PDF
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: '仅支持PDF格式的简历' }, { status: 400 });
    }

    // 查找用户是否已有简历，如果有则删除旧记录 (不再需要删除文件)
    const existingResume = await Resume.findOne({ userId });
    if (existingResume) {
      await Resume.deleteOne({ _id: existingResume._id });
      console.log(`删除了用户 ${userId} 的旧简历记录: ${existingResume._id}`);
    }

    // 1. 读取文件到内存 Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 2. 在内存中解析PDF文本
    let resumeText = '';
    try {
      const pdfData = await pdfParse(buffer, { max: 50 });
      resumeText = pdfData.text;
      console.log(`PDF文本提取成功，长度: ${resumeText.length}`);
      if (!resumeText || resumeText.length < 50) {
        console.warn('提取的PDF文本过短');
        // 文本过短也先保存，让后台解析尝试处理，不在此处直接报错返回
        // return NextResponse.json({ error: 'PDF文本提取结果不完整或无效' }, { status: 500 });
      }
    } catch (pdfError: any) {
      console.error('PDF解析错误:', pdfError);
      // 解析失败也先保存，让后台解析尝试处理，记录原始错误
      // return NextResponse.json({ error: 'PDF解析失败', details: pdfError.message }, { status: 500 });
      resumeText = `PDF解析失败: ${pdfError.message}`; // 记录错误信息到rawText
    }

    // 3. 保存简历记录 (只包含原始文本，parsedData为空)
    const resume = await Resume.create({
      userId,
      name: resumeName,
      isDefault: true,
      parsedData: {}, // 初始为空
      rawText: resumeText, // 保存原始文本或错误信息
    });
    console.log(`创建新简历记录成功: ${resume._id}`);

    // 4. 更新用户默认简历ID
    await User.updateOne(
      { _id: userId },
      { $set: { defaultResumeId: resume._id } }
    );
    console.log(`更新用户 ${userId} 的默认简历ID为: ${resume._id}`);

    // 5. 触发后台解析 (异步，非阻塞)
    const resumeIdStr = resume._id.toString();
    // 获取当前部署的 URL 或默认 localhost
    const backendUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'; 
    const parseApiUrl = `${backendUrl}/api/parse-resume`;
    console.log(`触发后台解析: ${parseApiUrl} for resumeId: ${resumeIdStr}`);
    
    fetch(parseApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 注意：后台任务通常需要某种认证方式，这里暂时省略
        // 如果 parse-resume API 需要认证，需要在这里添加相应的头
        // 'Authorization': `Bearer YOUR_INTERNAL_TOKEN`
        // 或者使用其他内部认证机制
      },
      body: JSON.stringify({ resumeId: resumeIdStr, userId: userId }) // 传递 resumeId 和 userId
    })
    .then(async (response) => {
      if (!response.ok) {
        // 记录后台任务触发失败，但不影响主流程
        const errorText = await response.text();
        console.error(`后台解析任务触发失败: ${response.status} ${response.statusText}`, errorText);
      } else {
        console.log(`后台解析任务成功触发 for resumeId: ${resumeIdStr}`);
      }
    })
    .catch(error => {
      // 网络或其他错误导致触发失败
      console.error('触发后台解析任务时发生网络错误:', error);
    });

    // 6. 返回成功响应 (告知用户上传成功，正在后台解析)
    return NextResponse.json({ 
      message: existingResume ? '简历已替换，正在后台解析' : '简历上传成功，正在后台解析',
      resume: {
        id: resume._id,
        name: resume.name,
        isDefault: resume.isDefault,
        // 不再返回 parsedData
        createdAt: resume.createdAt
      } 
    }, { status: 201 });

  } catch (error: any) {
    console.error('简历上传或触发解析失败:', error);
    return NextResponse.json({ error: '简历上传或触发解析失败', details: error.message }, { status: 500 });
  }
} 