'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  name: string;
  email: string;
  isMember?: boolean;
  membershipExpiry?: Date | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  refreshUserStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // 刷新用户状态的函数
  const refreshUserStatus = async () => {
    if (!token) return;
    
    try {
      console.log('正在刷新用户状态...');
      const response = await fetch('/api/user/status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('用户状态刷新成功:', data);
        
        if (data.user) {
          // 如果API返回了membershipExpiry，将字符串转换为Date对象
          if (data.user.membershipExpiry) {
            data.user.membershipExpiry = new Date(data.user.membershipExpiry);
          }
          
          setUser(data.user);
          // 更新localStorage中的用户信息
          localStorage.setItem('user', JSON.stringify(data.user));
        }
      } else {
        console.error('刷新用户状态失败:', response.status);
      }
    } catch (error) {
      console.error('刷新用户状态出错:', error);
    }
  };

  // 在客户端初始化时检查localStorage中的认证信息
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        
        if (storedToken) {
          setToken(storedToken);
          
          // 如果有本地存储的用户信息，先使用它
          if (storedUser) {
            try {
              const parsedUser = JSON.parse(storedUser);
              
              // 如果存储的用户信息包含会员到期时间，转换为Date对象
              if (parsedUser.membershipExpiry) {
                parsedUser.membershipExpiry = new Date(parsedUser.membershipExpiry);
              }
              
              setUser(parsedUser);
            } catch (e) {
              console.error('解析本地用户数据失败', e);
            }
          }
          
          // 然后从服务器获取最新的用户信息
          try {
            const response = await fetch('/api/user/status', {
              headers: {
                'Authorization': `Bearer ${storedToken}`
              }
            });
            
            if (response.ok) {
              const data = await response.json();
              console.log('API返回的用户状态:', data);
              
              if (data.user) {
                // 如果API返回了membershipExpiry，将字符串转换为Date对象
                if (data.user.membershipExpiry) {
                  data.user.membershipExpiry = new Date(data.user.membershipExpiry);
                }
                
                setUser(data.user);
                // 更新localStorage中的用户信息
                localStorage.setItem('user', JSON.stringify(data.user)); 
              }
            } else {
              console.error('获取用户状态失败:', response.status);
              // 只在API确认无效时清除本地数据
              if (response.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                setToken(null);
                setUser(null);
              }
            }
          } catch (error) {
            console.error('获取用户状态出错:', error);
            // 网络错误时不清除本地数据，保持离线访问能力
          }
        }
      } catch (error) {
        console.error('初始化认证状态失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  // 登录函数
  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  // 登出函数
  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  const value = {
    user,
    token,
    isLoading,
    login,
    logout,
    isAuthenticated: !!token,
    refreshUserStatus
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// 自定义钩子，用于在组件中访问认证状态
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// 保护路由的高阶组件
export function withAuth<P extends object>(Component: React.ComponentType<P>) {
  return function ProtectedRoute(props: P) {
    const { isAuthenticated, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!isLoading && !isAuthenticated) {
        router.push('/auth/login');
      }
    }, [isLoading, isAuthenticated, router]);

    if (isLoading) {
      return <div>加载中...</div>;
    }

    if (!isAuthenticated) {
      return null;
    }

    return <Component {...props} />;
  };
} 