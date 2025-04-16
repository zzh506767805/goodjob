'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import ResumeUploader from '@/components/resume/ResumeUploader';
import ResumeList from '@/components/resume/ResumeList';
import { useAuth } from '@/contexts/AuthContext';

interface Resume {
  _id: string;
  name: string;
  fileUrl: string;
  isDefault: boolean;
  parsedData: any;
  createdAt: string;
}

export default function Resumes() {
  const { token } = useAuth();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (token) {
      fetchResumes();
    }
  }, [token]);

  const fetchResumes = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/resumes', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('获取简历失败');
      }
      
      const data = await response.json();
      setResumes(data.resumes);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadSuccess = (resumeData: any) => {
    // 上传成功后，重新获取完整的简历列表
    // 这样可以确保所有简历都有正确的 _id
    fetchResumes(); 
  };

  const handleParseResume = async (resumeId: string) => {
    try {
      const response = await fetch('/api/parse-resume', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ resumeId })
      });
      
      if (!response.ok) {
        throw new Error('解析简历失败');
      }
      
      const data = await response.json();
      
      // 更新简历列表中的解析数据
      setResumes(prev => prev.map(resume => 
        resume._id === resumeId 
          ? { ...resume, parsedData: data.parsedData } 
          : resume
      ));
    } catch (err: any) {
      alert('解析简历失败: ' + err.message);
    }
  };

  const handleSetDefault = async (resumeId: string) => {
    try {
      const response = await fetch(`/api/resumes/${resumeId}/set-default`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });
      
      if (!response.ok) {
        throw new Error('设置默认简历失败');
      }
      
      // 更新简历列表中的默认状态
      setResumes(prev => prev.map(resume => ({
        ...resume,
        isDefault: resume._id === resumeId
      })));
    } catch (err: any) {
      alert('设置默认简历失败: ' + err.message);
    }
  };

  const handleDeleteResume = async (resumeId: string) => {
    try {
      const response = await fetch(`/api/resumes/${resumeId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('删除简历失败');
      }
      
      // 从列表中移除该简历
      setResumes(prev => prev.filter(resume => resume._id !== resumeId));
    } catch (err: any) {
      alert('删除简历失败: ' + err.message);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">简历管理</h1>
        
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4">
            <p className="text-red-500">{error}</p>
          </div>
        )}
        
        {/* 上传简历组件 */}
        <ResumeUploader onUploadSuccess={handleUploadSuccess} />
        
        {/* 简历列表 */}
        {isLoading ? (
          <div className="bg-white shadow rounded-lg p-6">
            <p className="text-center text-gray-500">正在加载简历...</p>
          </div>
        ) : (
          <ResumeList 
            resumes={resumes} 
            onParse={handleParseResume}
            onSetDefault={handleSetDefault}
            onDelete={handleDeleteResume}
          />
        )}
      </div>
    </DashboardLayout>
  );
} 