import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import Resume from '@/models/Resume';
import connectToDatabase from '@/lib/mongodb';
// 不再需要 path 和 fs
// import path from 'path';
// import fs from 'fs/promises';
// 不再需要 verifyAuth，因为 userId 会从请求体传递
// import { verifyAuth } from '../../../lib/authUtils'; 

// 初始化OpenAI客户端，使用代理服务器
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://proxy.tainanle.online/v1', // 使用代理服务器
});

// 从旧代码迁移并保持不变的 Prompt 函数
function createParsePrompt(resumeText: string): string {
  return `
  分析以下简历内容，提取结构化信息，包括：
  1. 个人信息（姓名、邮箱、电话）
  2. 技能列表
  3. 工作经验（公司、职位、时间段、项目及业绩情况）
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

// 这个API现在作为后台任务处理程序
export async function POST(req: NextRequest) {
  console.log('【后台解析】开始处理简历解析请求');
  try {
    await connectToDatabase();
    console.log('【后台解析】数据库连接成功');

    // 不再需要验证Token，直接从请求体获取 resumeId 和 userId
    // const userId = verifyAuth(req);
    // if (!userId) { ... }
    
    const body = await req.json();
    const { resumeId, userId } = body;
    
    if (!resumeId || !userId) {
      console.error('【后台解析】请求体缺少 resumeId 或 userId');
      return NextResponse.json({ error: '请求参数不完整' }, { status: 400 });
    }
    console.log(`【后台解析】处理简历ID: ${resumeId}, 用户ID: ${userId}`);

    // 查找简历 (使用传递的 userId 和 resumeId)
    const resume = await Resume.findOne({ _id: resumeId, userId: userId }).select('name rawText parsedData'); // 选择需要的字段
    if (!resume) {
      console.error(`【后台解析】找不到简历或无权访问, resumeId: ${resumeId}, userId: ${userId}`);
      return NextResponse.json({ error: '找不到简历或无权访问' }, { status: 404 });
    }
    console.log(`【后台解析】找到简历: ${resume.name}`);

    // 检查是否已经解析过 (避免重复解析)
    if (resume.parsedData && Object.keys(resume.parsedData).length > 0 && resume.parsedData.personalInfo) {
      console.log(`【后台解析】简历 ${resumeId} 已解析过，跳过。`);
      return NextResponse.json({ message: '简历已解析过' });
    }

    // 获取原始文本
    const resumeText = resume.rawText;
    if (!resumeText || resumeText.trim() === '' || resumeText.startsWith('PDF解析失败')) {
      console.error(`【后台解析】无法解析：简历 ${resumeId} 的原始文本无效或包含错误:`, resumeText);
      // 可以选择更新状态或记录错误，但这里仅返回错误
      return NextResponse.json({ error: '简历原始文本无效或提取失败' }, { status: 400 });
    }
    console.log(`【后台解析】获取到原始文本，长度: ${resumeText.length}`);

    // 创建结构化的提示 (使用上面的函数)
    const prompt = createParsePrompt(resumeText);

    console.log(`【后台解析】开始调用OpenAI API解析简历，使用模型: ${process.env.OPENAI_API_MODEL || "gpt-4.1-mini"}`);
    
    try {
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_API_MODEL || "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        response_format: { type: "json_object" }  // 强制JSON格式响应
      });
      
      console.log('【后台解析】OpenAI API调用成功');
      const aiResponse = response.choices[0].message.content;
      
      if (!aiResponse) {
        console.error('【后台解析】OpenAI返回了空响应');
        throw new Error('AI服务返回了空响应'); // 抛出错误由外层catch处理
      }
      
      let parsedData;
      try {
        // 尝试解析JSON
        parsedData = JSON.parse(aiResponse);
        console.log('【后台解析】成功解析JSON响应');
      } catch (jsonError) {
        console.error('【后台解析】JSON解析错误:', jsonError, '原始响应:', aiResponse);
        
        // 尝试清理响应中的非JSON内容
        const cleanedResponse = aiResponse
          .replace(/```json\n?|```/g, '')  // 移除Markdown代码块
          .trim();
          
        try {
          parsedData = JSON.parse(cleanedResponse);
          console.log('【后台解析】清理后成功解析JSON');
        } catch (secondJsonError) {
          console.error('【后台解析】二次JSON解析错误:', secondJsonError);
          throw new Error('无法解析AI响应: 返回的数据不是有效的JSON格式');
        }
      }

      // 验证解析出的数据包含所需字段
      if (!parsedData.personalInfo || !parsedData.skills || 
          !parsedData.experience || !parsedData.education) {
        console.error('【后台解析】解析出的数据结构不完整:', parsedData);
        throw new Error('解析出的数据结构不完整');
      }

      // 更新简历解析数据
      const updateResult = await Resume.updateOne(
        { _id: resumeId, userId: userId }, // 确保更新属于该用户的简历
        { $set: { parsedData } }
      );
      if (updateResult.modifiedCount > 0) {
        console.log(`【后台解析】简历 ${resumeId} 解析数据已成功保存到数据库`);
      } else {
        console.warn(`【后台解析】更新简历 ${resumeId} 时 modifiedCount 为 0 (可能数据未改变或未找到?)`);
      }
      
      // 后台任务成功，返回 200 OK
      return NextResponse.json({ message: '简历后台解析成功' });

    } catch (openaiError: any) {
      console.error('【后台解析】OpenAI API调用失败:', openaiError.message);
      // 记录错误，但让函数正常结束，避免重试 (如果适用)
      return NextResponse.json({ 
        error: '调用AI服务失败', 
        details: openaiError.message 
      }, { status: 500 }); // 返回500表示处理失败
    }

  } catch (error: any) {
    console.error('【后台解析】简历解析过程发生未预期错误:', error);
    return NextResponse.json({ 
      error: '简历后台解析失败', 
      details: error.message 
    }, { status: 500 });
  }
} 