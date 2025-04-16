import { NextRequest, NextResponse } from 'next/server';
import Resume from '@/models/Resume';
import Application from '@/models/Application';
import connectToDatabase from '@/lib/mongodb';
import fs from 'fs/promises';
import path from 'path';

export async function DELETE(
  req: NextRequest,
  context: { params: { id: string } }
) {
  try {
    await connectToDatabase();
    
    // 从请求头获取用户ID
    const userId = req.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    
    const resumeId = context.params.id;
    
    // 验证简历是否存在且属于该用户
    const resume = await Resume.findOne({ _id: resumeId, userId });
    if (!resume) {
      return NextResponse.json({ error: '找不到简历' }, { status: 404 });
    }
    
    // 如果是默认简历，先检查是否有其他简历可以设为默认
    if (resume.isDefault) {
      const otherResume = await Resume.findOne({ 
        userId, 
        _id: { $ne: resumeId } 
      });
      
      if (otherResume) {
        await Resume.updateOne(
          { _id: otherResume._id },
          { $set: { isDefault: true } }
        );
      }
    }
    
    // 删除文件系统中的简历文件
    try {
      const filePath = path.join(process.cwd(), 'public', resume.fileUrl);
      await fs.unlink(filePath);
    } catch (error) {
      console.error('删除文件失败:', error);
      // 继续执行，即使文件删除失败
    }
    
    // 删除数据库中的简历记录
    await Resume.deleteOne({ _id: resumeId });
    
    // 更新相关的投递记录
    await Application.updateMany(
      { resumeId },
      { $set: { resumeId: null } }
    );
    
    return NextResponse.json({ message: '删除简历成功' });
  } catch (error: any) {
    console.error('删除简历失败:', error);
    return NextResponse.json({ error: '删除简历失败', details: error.message }, { status: 500 });
  }
} 