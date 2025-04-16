import { NextRequest, NextResponse } from 'next/server';
import User from '@/models/User';
import connectToDatabase from '@/lib/mongodb';

export async function POST(req: NextRequest) {
  try {
    // 连接数据库
    await connectToDatabase();

    // 解析请求数据
    const { name, email, password } = await req.json();

    // 检查必要字段
    if (!name || !email || !password) {
      return NextResponse.json({ error: '请提供完整的注册信息' }, { status: 400 });
    }

    // 检查邮箱是否已存在
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json({ error: '邮箱已被注册' }, { status: 409 });
    }

    // 创建新用户
    const user = await User.create({
      name,
      email,
      password, // 密码会在User模型的pre-save钩子中被加密
    });

    // 移除密码字段
    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
    };

    return NextResponse.json({ message: '注册成功', user: userData }, { status: 201 });
  } catch (error: any) {
    console.error('注册错误:', error);
    return NextResponse.json({ error: '注册失败', details: error.message }, { status: 500 });
  }
} 