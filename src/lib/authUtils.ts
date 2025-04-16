import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

interface DecodedToken {
  userId: string;
  iat: number;
  exp: number;
}

export function verifyAuth(req: NextRequest): string | null {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('🚫 verifyAuth: Authorization header missing or invalid format.');
    return null; // 没有 Token 或格式错误
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    console.log('🚫 verifyAuth: Could not extract token from header.');
    return null; // 无法提取 Token
  }

  try {
    // 确保 JWT_SECRET 存在
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('❌ verifyAuth: JWT_SECRET not set in environment variables!');
      return null;
    }
    const decoded = jwt.verify(token, secret) as DecodedToken;
    console.log(`✅ verifyAuth: Token verified successfully. Extracted userId: ${decoded.userId}`); // 增加日志记录
    return decoded.userId; // 验证成功，返回 userId
  } catch (error) {
    console.error('❌ verifyAuth: Token verification failed:', error);
    return null; // Token 无效或过期
  }
} 