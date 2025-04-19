import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { writeFile } from 'fs/promises';
import path from 'path';
import Resume from '@/models/Resume';
import User from '@/models/User';
import connectToDatabase from '@/lib/mongodb';
import fs from 'fs/promises';
// 导入解析函数及类型（使用相对路径）
import { parseResumeFile } from '../../../lib/resumeParser';

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

// 上传新简历
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

    // 检查文件类型
    const fileType = file.type;
    if (!['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(fileType)) {
      return NextResponse.json({ error: '仅支持PDF和Word文档格式' }, { status: 400 });
    }

    // 查找用户是否已有简历，如果有则删除
    const existingResume = await Resume.findOne({ userId });
    if (existingResume) {
      // 删除旧文件
      try {
        const oldFilePath = path.join(process.cwd(), 'public', existingResume.fileUrl);
        await fs.unlink(oldFilePath).catch(err => {
          console.warn('删除旧简历文件失败:', err);
          // 继续执行，不影响新文件上传
        });
      } catch (error) {
        console.warn('删除旧简历文件时出错:', error);
        // 继续执行，不影响新文件上传
      }
      
      // 从数据库中删除旧简历记录
      await Resume.deleteOne({ _id: existingResume._id });
    }

    // 读取文件内容
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 创建唯一文件名
    const fileName = `${uuidv4()}-${file.name}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    const filePath = path.join(uploadDir, fileName);

    // 确保目录存在
    await writeFile(filePath, buffer);
    
    // 保存文件URL
    const fileUrl = `/uploads/${fileName}`;

    // 创建简历记录 - 强制设为默认简历
    const resume = await Resume.create({
      userId,
      name: resumeName,
      fileUrl,
      isDefault: true, // 直接设为默认简历
      parsedData: {}, // 这里先保存空对象，解析完成后再更新
    });

    // 重要修复：更新用户表中的defaultResumeId字段
    console.log(`📄 resumes/POST: 更新用户默认简历ID, userId: ${userId}, resumeId: ${resume._id}`);
    await User.updateOne(
      { _id: userId },
      { $set: { defaultResumeId: resume._id } }
    );

    // 自动触发简历解析
    if (file.type === 'application/pdf') {
      try {
        // 确保ID是字符串格式
        const resumeIdStr = resume._id.toString();
        
        // 直接调用解析函数，不再使用fetch请求
        // 这是异步的，但我们不等待它完成
        parseResumeFile(resumeIdStr, userId)
          .then(result => {
            if (result.success) {
              console.log('简历自动解析成功:', resumeIdStr);
            } else {
              console.error('简历自动解析失败:', result.error);
            }
          })
          .catch(err => {
            console.error('简历解析过程发生错误:', err);
          });
        
        console.log('已触发简历自动解析:', resumeIdStr);
      } catch (parseError) {
        console.error('触发自动解析失败:', parseError);
        // 解析失败不影响上传成功
      }
    }

    return NextResponse.json({ 
      message: existingResume ? '简历已替换，正在自动解析' : '简历上传成功，正在自动解析', 
      resume: {
        id: resume._id,
        name: resume.name,
        fileUrl: resume.fileUrl,
        isDefault: resume.isDefault,
        createdAt: resume.createdAt
      } 
    }, { status: 201 });
  } catch (error: any) {
    console.error('简历上传失败:', error);
    return NextResponse.json({ error: '简历上传失败', details: error.message }, { status: 500 });
  }
} 