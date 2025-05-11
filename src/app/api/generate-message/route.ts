import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import Resume from '@/models/Resume';
import connectToDatabase from '@/lib/mongodb';

// 初始化OpenAI客户端
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    
    // 从请求头获取用户ID
    const userId = req.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    // 解析请求数据
    const { resumeId, jobTitle, companyName, jobDescription } = await req.json();
    
    // 验证必要字段
    if (!resumeId || !jobTitle || !companyName || !jobDescription) {
      return NextResponse.json({ error: '请提供完整的职位信息' }, { status: 400 });
    }

    // 查找简历
    const resume = await Resume.findOne({ _id: resumeId, userId });
    if (!resume) {
      return NextResponse.json({ error: '简历不存在或无权访问' }, { status: 404 });
    }

    // 获取简历解析数据
    const { parsedData } = resume;
    if (!parsedData || Object.keys(parsedData).length === 0) {
      return NextResponse.json({ error: '简历尚未解析，请先解析简历' }, { status: 400 });
    }

    
    // 生成打招呼消息
    const message = await generateGreetingMessage(parsedData, jobTitle, companyName, jobDescription);

    return NextResponse.json({
      message
    });
  } catch (error: any) {
    console.error('生成消息失败:', error);
    return NextResponse.json({ error: '生成消息失败', details: error.message }, { status: 500 });
  }
}



// 生成打招呼消息
async function generateGreetingMessage(resumeData: any, jobTitle: string, companyName: string, jobDescription: string): Promise<string> {
  try {
    const prompt = `
    你是一位求职者，正在Boss直聘上应聘工作。请根据以下信息，生成一条专业、友好且个性化的打招呼消息。
    
    求职者技能：${resumeData.skills ? resumeData.skills.join(', ') : '无'}
    
    求职者工作经验：
    ${resumeData.experience 
      ? resumeData.experience.map((exp: any) => 
          `${exp.company || ''} - ${exp.position || ''}: ${exp.description || ''}`
        ).join('\n')
      : '无'}
    
    求职者教育背景：
    ${resumeData.education 
      ? resumeData.education.map((edu: any) => 
          `${edu.institution || ''} - ${edu.degree || ''}`
        ).join('\n')
      : '无'}
    
    应聘职位：${jobTitle}
    公司名称：${companyName}
    职位描述：${jobDescription}
    
    注意：
    1. 消息要简洁，不超过150个字。
    2. 突出自己最匹配该职位的1-2个技能或经验。
    3. 表达对公司和职位的兴趣。
    4. 不要使用过于生硬的模板化语言。
    5. 使用礼貌、正式的问候语开头，如"您好"。
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    return response.choices[0].message.content || '您好，我对贵公司的职位很感兴趣，希望有机会与您详聊。';
  } catch (error) {
    console.error('生成打招呼消息错误:', error);
    return '您好，我对贵公司的职位很感兴趣，希望有机会与您详聊。'; // 出错时返回默认消息
  }
} 