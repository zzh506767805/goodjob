import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import Resume from '@/models/Resume';
import User from '@/models/User';
import connectToDatabase from '@/lib/mongodb';
import { verifyAuth } from '@/lib/authUtils'; // 确认 authUtils 的路径
import { cleanJobDescription } from '@/lib/textUtils'; // 从工具文件导入

// 初始化 OpenAI 客户端 (复用之前的配置，或根据需要调整)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://proxy.tainanle.online/v1', // 优先使用环境变量
});

// 优化 Prompt 生成逻辑
function createGreetingPrompt(jobDetails: any, resumeData: any): string {
  // 提取关键信息
  const { jobTitle, companyName, jobDescription, jobRequirements } = jobDetails;
  const { personalInfo, skills, experience, education } = resumeData.parsedData || {};

  // 清理职位描述
  const cleanedDescription = cleanJobDescription(jobDescription);

  // 构建简历亮点字符串
  let resumeHighlights = "";
  if (personalInfo?.name) resumeHighlights += `候选人姓名: ${personalInfo.name}.\n`;
  if (skills?.length > 0) resumeHighlights += `主要技能: ${skills.slice(0, 5).join(', ')}.\n`;
  
  // 拼接最近三段工作经历 (增加描述长度)
  if (experience?.length > 0) {
    resumeHighlights += `工作经历:\n`;
    experience.slice(0, 3).forEach((exp: any, index: number) => {
      // 增加描述长度到 150
      const descSnippet = exp.description ? `: ${exp.description.substring(0, 150)}...` : '';
      resumeHighlights += `  - ${exp.company ? `在 ${exp.company} ` : ''}${exp.position ? `担任 ${exp.position}` : ''}${descSnippet}\n`;
    });
  } else {
    resumeHighlights += `工作经历: N/A.\n`;
  }
  
  if (education?.length > 0) {
    const latestEdu = education[0];
    resumeHighlights += `最高学历: ${latestEdu.degree} 毕业于 ${latestEdu.institution}.\n`;
  }
  if (resumeHighlights === "") resumeHighlights = "简历信息不完整或未解析.\n";

  // 构建 Prompt (移除任职要求)
  return `
请根据以下职位信息和候选人简历，以友好、专业的口吻，生成一段不超过300字的打招呼开场白。目的是表达对职位的兴趣，并突出候选人与职位要求的匹配度。请直接返回开场白文本，不要包含任何额外的解释或标记。

--- 职位信息 ---
职位名称: ${jobTitle || '未提供'}
公司名称: ${companyName || '未提供'}
职位描述:
${cleanedDescription} 

--- 候选人简历亮点 ---
${resumeHighlights}
---

打招呼开场白：
`;
}

// 辅助函数，用于生成简历亮点字符串 (从 createGreetingPrompt 中提取)
function createResumeHighlights(parsedData: any): string {
  const { personalInfo, skills, experience, education } = parsedData;
  let highlights = "";
  
  // 添加调试信息
  console.log("Debug - parsedData structure:", Object.keys(parsedData));
  console.log("Debug - experience field:", experience);
  
  if (personalInfo?.name) highlights += `候选人姓名: ${personalInfo.name}.\n`;
  if (skills?.length > 0) highlights += `主要技能: ${skills.slice(0, 5).join(', ')}.\n`;
  
  // 修改这部分以确保正确处理experience数组
  if (experience && Array.isArray(experience) && experience.length > 0) {
    highlights += `工作经历:\n`;
    experience.slice(0, 3).forEach((exp: any) => {
      const company = exp.company || '未知公司';
      const position = exp.position || '未知职位';
      const descSnippet = exp.description 
        ? `: ${exp.description.substring(0, 150)}...` 
        : '';
      highlights += `  - 在 ${company} 担任 ${position}${descSnippet}\n`;
    });
  } else {
    console.warn("工作经历数据缺失或格式不正确:", experience);
    highlights += `工作经历: N/A.\n`;
  }
  
  if (education?.length > 0) {
    const latestEdu = education[0];
    highlights += `最高学历: ${latestEdu.degree} 毕业于 ${latestEdu.institution}.\n`;
  }
  return highlights;
}

// --- CORS Headers --- 
// !重要: 在生产环境中应该更严格地限制允许的源!
const corsHeaders = {
  'Access-Control-Allow-Origin': '*' , // 或者更安全: 'chrome-extension://YOUR_PLUGIN_ID_HERE'
  'Access-Control-Allow-Methods': 'POST, OPTIONS', // 只允许 POST 和 OPTIONS
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// 处理 OPTIONS 预检请求 (CORS 必需)
export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204, // No Content
    headers: corsHeaders,
  });
}

export async function POST(req: NextRequest) {
  console.log('👋 generate-greeting: Received request');
  try {
    await connectToDatabase();
    console.log('✅ generate-greeting: Database connected');

    // 1. 验证用户身份
    const userId = verifyAuth(req);
    if (!userId) {
      console.log('❌ generate-greeting: User verification failed');
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: corsHeaders });
    }
    console.log(`✅ generate-greeting: User verified: ${userId}`);

    // 2. 解析请求体中的职位信息
    const jobDetails = await req.json();
    if (!jobDetails || !jobDetails.jobTitle) {
      console.log('❌ generate-greeting: Missing job details in request body');
      return NextResponse.json({ error: '缺少职位信息' }, { status: 400, headers: corsHeaders });
    }
    console.log(`📄 generate-greeting: Received job title: ${jobDetails.jobTitle}`);

    // 3. 获取用户的默认简历 ID (新逻辑)
    console.log(`👤 generate-greeting: Attempting to find defaultResumeId for user: ${userId}`);
    const user = await User.findById(userId).select('defaultResumeId');
    
    if (!user) {
      console.log(`❌ generate-greeting: User not found in database: ${userId}`);
      // 如果连用户都找不到，返回 404
      return NextResponse.json({ error: '找不到用户信息' }, { status: 404, headers: corsHeaders });
    }
    if (!user.defaultResumeId) {
      console.log(`❌ generate-greeting: User ${userId} has not set a default resume.`);
      // 明确告知用户需要设置默认简历
      return NextResponse.json({ error: '请先在您的个人资料中设置默认简历' }, { status: 400, headers: corsHeaders });
    }
    console.log(`✅ generate-greeting: Found defaultResumeId: ${user.defaultResumeId}`);
    
    // 4. Fetch the Mongoose Document, explicitly selecting parsedData
    console.log(`📄 generate-greeting: Fetching resume content for resumeId: ${user.defaultResumeId}`);
    const defaultResume = await Resume.findById(user.defaultResumeId).select('+parsedData'); 

    if (!defaultResume) {
      console.log(`❌ generate-greeting: Default resume content not found for resumeId: ${user.defaultResumeId}...`);
      return NextResponse.json({ error: '找不到默认简历的详细信息...' }, { status: 404, headers: corsHeaders });
    }
    if (defaultResume.userId.toString() !== userId) {
        console.error(`❌ generate-greeting: Security Alert! User ${userId} tried to access resume ...`);
        return NextResponse.json({ error: '无权访问该简历' }, { status: 403, headers: corsHeaders });
    }

    // *** Final Approach: Access fields within the Mongoose Map using .get() ***
    let parsedDataMap: Map<string, any> | null = null;
    let experienceFromMap: any = undefined; // To store the specific field
    let plainParsedData:any = {}; // To store the converted plain object
    
    try {
        if (defaultResume.parsedData && defaultResume.parsedData instanceof Map) {
             parsedDataMap = defaultResume.parsedData;
             console.log("📄✅ Debug: Accessed parsedData as a Map.");
             
             // Use the Map's .get() method to access 'experience'
             if (parsedDataMap) {  // 添加空值检查
                experienceFromMap = parsedDataMap.get('experience'); 
             }
             console.log("   - Attempted to get 'experience' using Map.get():", experienceFromMap);
             console.log("   - Type of experienceFromMap:", typeof experienceFromMap);
             console.log("   - isArray(experienceFromMap):", Array.isArray(experienceFromMap));
             console.log("   - experienceFromMap length:", experienceFromMap?.length);

             // We need the whole parsedData content eventually, let's convert the Map
             // Mongoose Maps don't have a straightforward toObject, but iterating keys works
             // *** Add null check before iteration ***
             if (parsedDataMap) { 
                 for (let [key, value] of parsedDataMap.entries()) { 
                     // Be cautious with nested Maps or complex Mixed types
                     // For simple values or arrays, this should be okay
                     plainParsedData[key] = value; 
                 }
                 console.log("   - Converted Map to plain object. Keys:", Object.keys(plainParsedData));
                 // Re-assign parsedDataMap to the plain object for the function call
                 // parsedDataMap = plainParsedData; // Let's pass plainParsedData directly later
             } else {
                  plainParsedData = {}; // Ensure it's an empty object if map was null
             }

        } else {
            console.warn("📄⚠️ Debug: defaultResume.parsedData is missing or not a Map instance.");
            parsedDataMap = null; // Or handle as error
            plainParsedData = {};
        }
    } catch (e) {
        console.error("📄❌ Debug: Error accessing or converting parsedData Map:", e);
        return NextResponse.json({ error: '访问简历解析数据时发生内部错误，请联系管理员' }, { status: 500, headers: corsHeaders });
    }

    // Check if we successfully got a usable object/map (check plainParsedData)
     if (!plainParsedData || typeof plainParsedData !== 'object' || Object.keys(plainParsedData).length === 0) {
        console.log(`⚠️ generate-greeting: Default resume (ID: ${user.defaultResumeId}) has empty, missing, or invalid parsedData *after attempting Map access and conversion*.`); 
        return NextResponse.json({ error: '您的默认简历数据为空、未解析或访问异常，请检查' }, { status: 400, headers: corsHeaders });
    }
     console.log(`✅ generate-greeting: Found and using default resume: ${defaultResume.name}`); 

    // 5. Create Prompt using the data obtained from the Map (now converted to plain object)
    const prompt = createGreetingPromptFromParsedData(jobDetails, plainParsedData); // Pass the plain object 
    const model = process.env.OPENAI_API_MODEL || "gpt-4.1-mini";

    console.log("📄📄📄 Final Prompt being sent to OpenAI: ---------");
    console.log(prompt);
    console.log("--------------------------------------------------");
    
    console.log(`🤖 generate-greeting: Calling OpenAI API with model ${model}`);

    try {
      const response = await openai.chat.completions.create({
        model: model,
        messages: [{ role: "user", content: prompt }],
        temperature: 1.0, // 稍微提高一点温度，让回复更多样性一点
        max_tokens: 1000, // 限制生成长度
      });

      const greeting = response.choices[0].message.content?.trim();
      if (!greeting) {
        console.error('OpenAI 返回了空的打招呼内容');
        throw new Error('AI未能生成有效的打招呼内容');
      }
      console.log('成功生成打招呼语:', greeting);

      // 6. 返回生成的打招呼语
      return NextResponse.json({ greeting: greeting }, { headers: corsHeaders }); // 添加 CORS 头

    } catch (openaiError: any) {
      console.error('调用 OpenAI API 失败:', openaiError.message);
      return NextResponse.json(
        { error: '调用 AI 服务失败', details: openaiError.message }, 
        { status: 500, headers: corsHeaders } // 添加 CORS 头
      );
    }

  } catch (error: any) {
    console.error('处理生成打招呼语请求失败:', error);
    return NextResponse.json(
      { error: '处理请求失败', details: error.message }, 
      { status: 500, headers: corsHeaders } // 添加 CORS 头
    );
  }
}

// *** 需要修改/创建一个新的 Prompt 函数，直接接收 parsedData ***
function createGreetingPromptFromParsedData(jobDetails: any, parsedData: any): string {
  // 提取关键信息
  const { jobTitle, companyName, jobDescription } = jobDetails;
  // 直接从传入的 parsedData 解构
  const { personalInfo, skills, experience, education } = parsedData || {}; 

  // --- 内部 Debug 日志 (验证传入的 experience) ---
   console.log("📄🔍 Debug inside createGreetingPromptFromParsedData: Value of 'experience' variable *after* destructuring:", experience);
   console.log("📄🔍 Debug inside createGreetingPromptFromParsedData: Array.isArray(experience):", Array.isArray(experience));
   console.log("📄🔍 Debug inside createGreetingPromptFromParsedData: experience?.length:", experience?.length);
  // --- 结束 Debug ---

  const cleanedDescription = cleanJobDescription(jobDescription);
  let resumeHighlights = "";
  if (personalInfo?.name) resumeHighlights += `候选人姓名: ${personalInfo.name}.\n`;
  if (skills?.length > 0) resumeHighlights += `主要技能: ${skills.slice(0, 5).join(', ')}.\n`;
  
  if (experience && Array.isArray(experience) && experience.length > 0) { 
    resumeHighlights += `工作经历:\n`;
    experience.slice(0, 3).forEach((exp: any) => {
      const company = exp.company || '未知公司';
      const position = exp.position || '未知职位';
      const descSnippet = exp.description ? `: ${exp.description.substring(0, 150)}...` : '';
      resumeHighlights += `  - 在 ${company} 担任 ${position}${descSnippet}\n`;
    });
  } else {
    console.warn("📄🔍 Debug in createGreetingPromptFromParsedData: 'experience' variable is invalid, falling back to N/A.");
    resumeHighlights += `工作经历: N/A.\n`;
  }
  
  if (education?.length > 0) {
    const latestEdu = education[0];
    resumeHighlights += `最高学历: ${latestEdu.degree} 毕业于 ${latestEdu.institution}.\n`;
  }
  if (resumeHighlights === "") {
    console.warn("📄🔍 Debug in createGreetingPromptFromParsedData: 'resumeHighlights' variable is empty, falling back to N/A.");
    resumeHighlights = "简历信息不完整或未解析.\n";
  }

  // 构建 Prompt ... (内容不变)
  return `
请根据以下职位信息和候选人简历，以友好、专业的口吻，生成一段不超过300字的打招呼开场白。目的是表达对职位的兴趣，并突出候选人与职位要求的匹配度。请直接返回开场白文本，不要包含任何额外的解释或标记。

--- 职位信息 ---
职位名称: ${jobTitle || '未提供'}
公司名称: ${companyName || '未提供'}
职位描述:
${cleanedDescription} 

--- 候选人简历亮点 ---
${resumeHighlights}
---

打招呼开场白：
`;
} 