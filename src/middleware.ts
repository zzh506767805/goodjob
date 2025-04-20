import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// 定义需要保护的API路由
const protectedPaths = [
  '/api/resumes',
  '/api/applications',
  // 注意：/api/parse-resume 现在由内部触发，不再需要在这里保护
  // '/api/parse-resume', 
];

// 忽略验证的路径
const ignorePaths = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/parse-resume', // 将后台解析路由添加到忽略列表
];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // 检查是否是API路径并且不在忽略列表中
  // 调整逻辑：如果路径在忽略列表，直接放行
  if (ignorePaths.some(prefix => path.startsWith(prefix))) {
    return NextResponse.next();
  }
  
  // 检查是否是受保护的API路径
  const isProtectedPath = protectedPaths.some(prefix => path.startsWith(prefix));

  // 如果不是受保护的API路径，也放行
  if (!isProtectedPath) {
    return NextResponse.next();
  }

  // 获取授权头
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: '未授权访问' },
      { status: 401 }
    );
  }

  // 提取token
  const token = authHeader.split(' ')[1];

  try {
    // 验证token
    if (!process.env.JWT_SECRET) {
      throw new Error('未配置JWT密钥');
    }

    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    
    // 将用户ID添加到请求头中，以便后续处理
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', payload.userId as string);

    // 继续处理请求
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch (error) {
    console.error('Token验证失败:', error);
    return NextResponse.json(
      { error: '无效的令牌' },
      { status: 401 }
    );
  }
}

// 配置匹配路径
export const config = {
  matcher: ['/api/:path*'],
}; 