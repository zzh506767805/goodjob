import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import User from '@/models/User';
import connectToDatabase from '@/lib/mongodb';

export async function POST(req: NextRequest) {
  try {
    // 连接数据库
    await connectToDatabase();

    // 解析请求数据
    const { email, password } = await req.json();

    // 检查必要字段
    if (!email || !password) {
      return NextResponse.json({ error: '请提供邮箱和密码' }, { status: 400 });
    }

    // 查找用户
    const user = await User.findOne({ email });
    if (!user) {
      return NextResponse.json({ error: '邮箱或密码不正确' }, { status: 401 });
    }

    // 验证密码
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return NextResponse.json({ error: '邮箱或密码不正确' }, { status: 401 });
    }

    // 创建JWT令牌
    if (!process.env.JWT_SECRET) {
      throw new Error('未设置JWT密钥');
    }
    
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 返回用户数据和令牌
    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
    };

    return NextResponse.json({ 
      message: '登录成功', 
      user: userData,
      token
    });
  } catch (error: any) {
    console.error('登录错误:', error);
    return NextResponse.json({ error: '登录失败', details: error.message }, { status: 500 });
  }
} 