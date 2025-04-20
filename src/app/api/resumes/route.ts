import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import Resume from '@/models/Resume';
import User from '@/models/User';
import connectToDatabase from '@/lib/mongodb';
import OpenAI from 'openai';
import pdfParse from 'pdf-parse-fork';

// 初始化OpenAI客户端 (复用parse-resume中的配置)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://proxy.tainanle.online/v1', // 使用代理服务器
});

// 从parse-resume route迁移并调整的OpenAI Prompt
function createParsePrompt(resumeText: string): string {
  return `
  分析以下简历内容，提取结构化信息，包括：
  1. 个人信息（姓名、邮箱、电话）
  2. 技能列表
  3. 工作经验（公司、职位、时间段、职责描述）
  4. 教育经历（学校、学位、时间段）
  
  你必须以JSON格式返回，格式如下：
  {
    "personalInfo": {
      "name": "",
      "email": "",
      "phone": ""
    },
    "skills": ["技能1", "技能2", ...],
    "experience": [
      {
        "company": "",
        "position": "",
        "duration": "",
        "description": ""
      }
    ],
    "education": [
      {
        "institution": "",
        "degree": "",
        "period": ""
      }
    ]
  }
  
  简历内容：
  ${resumeText}
  
  注意：你的回复必须是有效的JSON格式，不要包含任何额外的文本、解释或代码块标记。
  `;
}

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

// 上传新简历并直接解析
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
        return NextResponse.json({ error: 'PDF文本提取结果不完整或无效' }, { status: 500 });
      }
    } catch (pdfError: any) {
      console.error('PDF解析错误:', pdfError);
      return NextResponse.json({ error: 'PDF解析失败', details: pdfError.message }, { status: 500 });
    }

    // 3. 调用OpenAI进行结构化
    let parsedData: any = {};
    try {
      const prompt = createParsePrompt(resumeText);
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_API_MODEL || "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        response_format: { type: "json_object" } // 强制JSON
      });
      const aiResponse = response.choices[0].message.content;
      if (!aiResponse) {
        throw new Error('AI服务返回了空响应');
      }
      try {
        parsedData = JSON.parse(aiResponse);
         // 基本验证确保核心结构存在
        if (!parsedData.personalInfo || !parsedData.skills || !parsedData.experience || !parsedData.education) {
          console.error('AI解析结果结构不完整:', parsedData);
          throw new Error('AI解析结果结构不完整');
        }
        console.log('AI解析成功');
      } catch (jsonError: any) {
        console.error('解析AI响应JSON失败:', jsonError, '原始响应:', aiResponse);
        throw new Error('无法解析AI响应');
      }
    } catch (openaiError: any) {
      console.error('调用OpenAI失败:', openaiError);
      return NextResponse.json({ error: '调用AI服务失败', details: openaiError.message }, { status: 500 });
    }

    // 4. 保存简历记录 (包含解析数据，不含fileUrl)
    const resume = await Resume.create({
      userId,
      name: resumeName,
      isDefault: true,
      parsedData: parsedData, // 保存解析后的数据
      rawText: resumeText, // 可选：保存原始文本
    });
    console.log(`创建新简历记录成功: ${resume._id}`);

    // 5. 更新用户默认简历ID
    await User.updateOne(
      { _id: userId },
      { $set: { defaultResumeId: resume._id } }
    );
    console.log(`更新用户 ${userId} 的默认简历ID为: ${resume._id}`);

    // 6. 返回成功响应
    return NextResponse.json({ 
      message: existingResume ? '简历已替换并解析成功' : '简历上传并解析成功',
      resume: {
        id: resume._id,
        name: resume.name,
        isDefault: resume.isDefault,
        parsedData: resume.parsedData, // 返回解析数据
        createdAt: resume.createdAt
      } 
    }, { status: 201 });
  } catch (error: any) {
    console.error('简历上传和解析失败:', error);
    return NextResponse.json({ error: '简历上传和解析失败', details: error.message }, { status: 500 });
  }
} 