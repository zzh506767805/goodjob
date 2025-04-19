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
    fetchResumes().then(() => {
      // 如果是PDF文件且上传成功，启动轮询检查解析状态
      if (resumeData && resumeData.fileUrl && resumeData.fileUrl.endsWith('.pdf')) {
        startPollingResumeStatus(resumeData.id);
      }
    }); 
  };

  // 轮询检查简历解析状态
  const startPollingResumeStatus = (resumeId: string) => {
    console.log('开始轮询检查简历解析状态:', resumeId);
    
    // 设置计数器，最多轮询10次（约50秒）
    let pollCount = 0;
    const maxPolls = 10;
    
    const pollInterval = setInterval(async () => {
      pollCount++;
      console.log(`轮询检查 #${pollCount} 简历解析状态:`, resumeId);
      
      // 获取最新简历数据
      try {
        const response = await fetch('/api/resumes', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          const updatedResume = data.resumes.find((r: any) => r._id === resumeId);
          
          // 检查是否已解析（是否有个人信息数据）
          if (updatedResume && 
              updatedResume.parsedData && 
              updatedResume.parsedData.personalInfo && 
              updatedResume.parsedData.personalInfo.name) {
            console.log('简历已完成解析:', resumeId);
            // 更新状态并停止轮询
            setResumes(data.resumes);
            clearInterval(pollInterval);
          } else if (pollCount >= maxPolls) {
            // 达到最大轮询次数，停止轮询
            console.log('达到最大轮询次数，停止检查解析状态');
            clearInterval(pollInterval);
          }
        } else {
          // 请求失败，停止轮询
          console.error('轮询简历数据失败');
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error('轮询检查过程出错:', error);
        clearInterval(pollInterval);
      }
    }, 5000); // 每5秒检查一次
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

  // 检查是否有已存在的简历
  const hasExistingResume = resumes.length > 0;

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
        <ResumeUploader 
          onUploadSuccess={handleUploadSuccess} 
          hasExistingResume={hasExistingResume} 
        />
        
        {/* 简历列表 */}
        {isLoading ? (
          <div className="bg-white shadow rounded-lg p-6">
            <p className="text-center text-gray-500">正在加载简历...</p>
          </div>
        ) : (
          <ResumeList 
            resumes={resumes} 
            onParse={handleParseResume}
            onDelete={handleDeleteResume}
          />
        )}
      </div>
    </DashboardLayout>
  );
} 