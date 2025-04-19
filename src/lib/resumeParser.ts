import OpenAI from 'openai';
import Resume from '@/models/Resume';
import fs from 'fs/promises';
import path from 'path';

// 定义解析结果的类型
export interface ResumeParseResult {
  success: boolean;
  error?: string;
  parsedData?: any;
}

// 初始化OpenAI客户端，使用代理服务器
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://proxy.tainanle.online/v1', // 使用代理服务器
});

/**
 * 直接解析简历文件并更新数据库
 * @param resumeId 简历ID
 * @param userId 用户ID
 * @returns 解析结果
 */
export async function parseResumeFile(resumeId: string, userId: string): Promise<ResumeParseResult> {
  console.log('【自动解析】开始解析简历:', resumeId);
  
  try {
    // 查找简历
    const resume = await Resume.findOne({ _id: resumeId, userId });
    if (!resume) {
      console.error('【自动解析】找不到简历或无权访问:', resumeId);
      return { success: false, error: '找不到简历或无权访问' };
    }
    
    console.log(`【自动解析】找到简历: ${resume.name}`);
    
    // 读取简历文件
    const filePath = path.join(process.cwd(), 'public', resume.fileUrl);
    console.log(`【自动解析】简历文件路径: ${filePath}`);
    
    // 检查文件是否存在
    try {
      await fs.access(filePath);
      console.log('【自动解析】文件访问成功');
    } catch (error) {
      console.error('【自动解析】简历文件不存在或无法访问:', filePath);
      return { success: false, error: '简历文件不存在或无法访问' };
    }
    
    // 只支持解析PDF文件
    if (!resume.fileUrl.endsWith('.pdf')) {
      console.log('【自动解析】不支持的文件格式:', resume.fileUrl);
      return { success: false, error: '暂不支持解析此格式' };
    }
    
    // 提取PDF文本
    let resumeText = '';
    try {
      console.log('【自动解析】开始解析PDF文件');
      const dataBuffer = await fs.readFile(filePath);
      console.log(`【自动解析】文件读取成功，大小: ${dataBuffer.length} 字节`);
      
      // 使用pdf-parse-fork库解析PDF
      const pdfParseModule = await import('pdf-parse-fork');
      const pdfParse = pdfParseModule.default || pdfParseModule;
      console.log('【自动解析】PDF解析库加载成功，开始调用解析函数');
      
      const pdfData = await pdfParse(dataBuffer, {
        max: 50  // 限制处理页数
      });
      
      resumeText = pdfData.text;
      console.log(`【自动解析】PDF解析成功，提取文本长度: ${resumeText.length}`);
      
      // 检查文本是否有效
      if (!resumeText || resumeText.length < 50) {
        console.warn('【自动解析】提取的PDF文本过短:', resumeText);
        return { success: false, error: 'PDF文本提取结果不完整或无效' };
      }
    } catch (error) {
      console.error('【自动解析】PDF解析错误:', error);
      return { success: false, error: '文件解析失败' };
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
    
    // 调用OpenAI API解析简历
    try {
      console.log(`【自动解析】开始调用OpenAI API解析简历，使用模型: ${process.env.OPENAI_API_MODEL || "gpt-4.1-mini"}`);
      
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_API_MODEL || "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        response_format: { type: "json_object" }  // 强制JSON格式响应
      });
      
      console.log('【自动解析】OpenAI API调用成功');
      const aiResponse = response.choices[0].message.content;
      
      if (!aiResponse) {
        console.error('【自动解析】OpenAI返回了空响应');
        return { success: false, error: 'AI服务返回了空响应' };
      }
      
      // 解析JSON响应
      let parsedData;
      try {
        parsedData = JSON.parse(aiResponse);
        console.log('【自动解析】成功解析JSON响应');
      } catch (jsonError) {
        console.error('【自动解析】JSON解析错误:', jsonError, '原始响应:', aiResponse);
        
        // 尝试清理响应中的非JSON内容
        const cleanedResponse = aiResponse
          .replace(/```json\n?|```/g, '')  // 移除Markdown代码块
          .trim();
          
        try {
          parsedData = JSON.parse(cleanedResponse);
          console.log('【自动解析】清理后成功解析JSON');
        } catch (secondJsonError) {
          console.error('【自动解析】二次JSON解析错误:', secondJsonError);
          return { success: false, error: '无法解析AI响应' };
        }
      }
      
      // 验证解析数据结构
      if (!parsedData.personalInfo || !parsedData.skills || 
          !parsedData.experience || !parsedData.education) {
        console.error('【自动解析】解析出的数据结构不完整:', parsedData);
        return { success: false, error: '解析出的数据结构不完整' };
      }
      
      // 更新简历解析数据
      console.log(`【自动解析】开始更新数据库，简历ID: ${resumeId}`);
      try {
        const updateResult = await Resume.updateOne(
          { _id: resumeId },
          { $set: { parsedData } }
        );
        
        if (updateResult.modifiedCount === 1) {
          console.log('【自动解析】简历解析数据已成功保存到数据库');
        } else {
          console.warn('【自动解析】数据库更新没有修改任何记录:', updateResult);
          // 尝试再次查询确认数据是否已存在
          const updatedResume = await Resume.findById(resumeId);
          if (updatedResume && updatedResume.parsedData && updatedResume.parsedData.personalInfo) {
            console.log('【自动解析】数据似乎已经存在于数据库中');
          } else {
            console.error('【自动解析】数据可能未成功保存到数据库');
            return { success: false, error: '数据库更新失败' };
          }
        }
      } catch (dbError) {
        console.error('【自动解析】数据库更新错误:', dbError);
        return { success: false, error: '数据库更新失败' };
      }
      
      console.log('【自动解析】简历解析全部完成:', resumeId);
      return { success: true, parsedData };
      
    } catch (openaiError: any) {
      console.error('【自动解析】OpenAI API调用失败:', openaiError.message);
      return { success: false, error: '调用AI服务失败' };
    }
    
  } catch (error: any) {
    console.error('【自动解析】简历解析过程发生未预期错误:', error);
    return { success: false, error: '简历解析失败' };
  }
} 