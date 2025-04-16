import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import Resume from '@/models/Resume';
import connectToDatabase from '@/lib/mongodb';
import path from 'path';
import fs from 'fs/promises';
import { verifyAuth } from '../../../lib/authUtils';

// 初始化OpenAI客户端，使用代理服务器
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://proxy.tainanle.online/v1', // 使用代理服务器
});

export async function POST(req: NextRequest) {
  console.log('开始处理简历解析请求');
  try {
    await connectToDatabase();
    console.log('数据库连接成功');

    // 验证 Token 并获取 userId
    const userId = verifyAuth(req);
    if (!userId) {
      console.log('用户验证失败');
      return NextResponse.json({ error: '未授权或 Token 无效' }, { status: 401 });
    }
    console.log('用户验证成功: ', userId);

    // 获取简历ID
    const body = await req.json();
    const { resumeId } = body;
    if (!resumeId) {
      console.log('未提供简历ID');
      return NextResponse.json({ error: '请提供简历ID' }, { status: 400 });
    }
    console.log('处理简历ID: ', resumeId);

    // 查找简历 (确保使用从 Token 中获取的 userId 进行查询)
    const resume = await Resume.findOne({ _id: resumeId, userId: userId });
    if (!resume) {
      console.log('找不到简历或无权访问');
      return NextResponse.json({ error: '找不到简历或无权访问' }, { status: 404 });
    }
    console.log('找到简历: ', resume.name);

    // 读取简历文件
    const filePath = path.join(process.cwd(), 'public', resume.fileUrl);
    console.log('简历文件路径: ', filePath);
    
    // 检查文件是否存在
    try {
      await fs.access(filePath);
      console.log('文件访问成功');
    } catch (error) {
      console.error('简历文件访问错误:', filePath, error);
      return NextResponse.json({ error: '简历文件不存在或无法访问' }, { status: 404 });
    }

    // 提取简历文本
    let resumeText = '';
    if (resume.fileUrl.endsWith('.pdf')) {
      try {
        console.log('开始解析PDF文件');
        const dataBuffer = await fs.readFile(filePath);
        console.log('文件读取成功，大小: ', dataBuffer.length, '字节');
        
        try {
          // 使用pdf-parse-fork库解析PDF
          const pdfParseModule = await import('pdf-parse-fork');
          const pdfParse = pdfParseModule.default || pdfParseModule;
          
          const pdfData = await pdfParse(dataBuffer, {
            max: 50  // 限制处理页数
          });
          
          resumeText = pdfData.text;
          console.log('PDF解析成功，提取文本长度:', resumeText.length);
          
          // 检查提取的文本是否有效
          if (!resumeText || resumeText.length < 50) {
            console.warn('提取的PDF文本过短，可能存在问题:', resumeText);
            return NextResponse.json({ error: 'PDF文本提取结果不完整或无效' }, { status: 500 });
          }
        } catch (pdfError) {
          console.error('PDF解析错误:', pdfError);
          return NextResponse.json({ error: 'PDF解析失败', details: (pdfError as Error).message }, { status: 500 });
        }
      } catch (fileError) {
        console.error('文件读取错误:', fileError);
        return NextResponse.json({ error: '文件读取失败', details: (fileError as Error).message }, { status: 500 });
      }
    } else {
      // 对于Word文件等其他格式，可能需要其他库来处理
      console.log('不支持的文件格式:', resume.fileUrl);
      return NextResponse.json({ error: '暂不支持解析此格式' }, { status: 400 });
    }

    // 创建结构化的提示
    const prompt = `
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

    console.log(`开始调用OpenAI API解析简历，使用模型: ${process.env.OPENAI_API_MODEL || "gpt-3.5-turbo"}`);
    
    try {
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_API_MODEL || "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        response_format: { type: "json_object" }  // 强制JSON格式响应
      });
      
      console.log('OpenAI API调用成功');
      const aiResponse = response.choices[0].message.content;
      
      if (!aiResponse) {
        console.error('OpenAI返回了空响应');
        return NextResponse.json({ error: 'AI服务返回了空响应' }, { status: 500 });
      }
      
      let parsedData;
      try {
        // 尝试解析JSON
        parsedData = JSON.parse(aiResponse);
        console.log('成功解析JSON响应');
      } catch (jsonError) {
        console.error('JSON解析错误:', jsonError, '原始响应:', aiResponse);
        
        // 尝试清理响应中的非JSON内容
        const cleanedResponse = aiResponse
          .replace(/```json\n?|```/g, '')  // 移除Markdown代码块
          .trim();
          
        try {
          parsedData = JSON.parse(cleanedResponse);
          console.log('清理后成功解析JSON');
        } catch (secondJsonError) {
          console.error('二次JSON解析错误:', secondJsonError);
          return NextResponse.json({ 
            error: '无法解析AI响应', 
            details: '返回的数据不是有效的JSON格式'
          }, { status: 500 });
        }
      }

      // 验证解析出的数据包含所需字段
      if (!parsedData.personalInfo || !parsedData.skills || 
          !parsedData.experience || !parsedData.education) {
        console.error('解析出的数据结构不完整:', parsedData);
        return NextResponse.json({ 
          error: '解析出的数据结构不完整', 
          parsedData 
        }, { status: 500 });
      }

      // 更新简历解析数据
      await Resume.updateOne(
        { _id: resumeId },
        { $set: { parsedData } }
      );
      console.log('简历解析数据已保存到数据库');

      return NextResponse.json({ 
        message: '简历解析成功', 
        parsedData 
      });
    } catch (openaiError: any) {
      console.error('OpenAI API调用失败:', openaiError.message);
      if (openaiError.response) {
        console.error('OpenAI错误详情:', {
          status: openaiError.response.status,
          headers: openaiError.response.headers,
          data: openaiError.response.data
        });
      }
      return NextResponse.json({ 
        error: '调用AI服务失败', 
        details: openaiError.message 
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('简历解析过程发生未预期错误:', error);
    return NextResponse.json({ 
      error: '简历解析失败', 
      details: error.message 
    }, { status: 500 });
  }
} 