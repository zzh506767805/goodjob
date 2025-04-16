import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { writeFile } from 'fs/promises';
import path from 'path';
import Resume from '@/models/Resume';
import connectToDatabase from '@/lib/mongodb';

// 获取用户所有简历
export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    
    // 从请求头获取用户ID
    const userId = req.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    // 获取用户的所有简历
    const resumes = await Resume.find({ userId }).sort({ createdAt: -1 });
    
    return NextResponse.json({ resumes });
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

    // 创建简历记录
    const resume = await Resume.create({
      userId,
      name: resumeName,
      fileUrl,
      isDefault: false, // 默认不设为主简历
      parsedData: {}, // 这里先保存空对象，解析完成后再更新
    });

    return NextResponse.json({ 
      message: '简历上传成功', 
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