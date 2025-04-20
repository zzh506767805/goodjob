'use client';

import { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import ResumeUploader from '@/components/resume/ResumeUploader';
import ResumeList from '@/components/resume/ResumeList';
import { useAuth } from '@/contexts/AuthContext';

interface Resume {
  _id: string;
  name: string;
  isDefault: boolean;
  parsedData: any;
  createdAt: string;
}

export default function Resumes() {
  const { token } = useAuth();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchResumes = async () => {
    console.log("fetchResumes called");
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
      console.log("Fetched resumes:", data.resumes);
      setResumes(data.resumes);
      
      const currentlyParsing = data.resumes.find((r: Resume) => 
        !r.parsedData || !r.parsedData.personalInfo || !r.parsedData.personalInfo.name
      );
      if (!currentlyParsing && pollingIntervalRef.current) {
        console.log("All resumes seem parsed, stopping polling.");
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchResumes();
    }
    
    return () => {
      if (pollingIntervalRef.current) {
        console.log("Component unmounting, clearing polling interval.");
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [token]);

  const handleUploadSuccess = (resumeData: any) => {
    console.log("handleUploadSuccess called with:", resumeData);
    setResumes(prev => [
      {
        _id: resumeData.id,
        name: resumeData.name,
        isDefault: resumeData.isDefault,
        parsedData: {},
        createdAt: resumeData.createdAt || new Date().toISOString()
      },
    ]);
    
    if (resumeData && resumeData.id) {
      startPollingResumeStatus(resumeData.id);
    } else {
        console.error("无法启动轮询，缺少简历ID");
        setTimeout(fetchResumes, 1000); 
    }
  };

  const startPollingResumeStatus = (resumeId: string) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    console.log('开始轮询检查简历解析状态:', resumeId);
    let pollCount = 0;
    const maxPolls = 12;
    
    pollingIntervalRef.current = setInterval(async () => {
      pollCount++;
      console.log(`轮询检查 #${pollCount} 简历解析状态:`, resumeId);
      
      try {
        await fetchResumes(); 
        
        if (pollCount >= maxPolls && pollingIntervalRef.current) {
          console.log('达到最大轮询次数，停止检查解析状态');
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        
      } catch (error) {
        console.error('轮询检查过程出错:', error);
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      }
    }, 5000);
  };

  const handleParseResume = async (resumeId: string) => {
    try {
      const response = await fetch('/api/parse-resume', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ resumeId, userId: null })
      });
      
      if (!response.ok) {
        throw new Error('解析简历失败');
      }
      
      const data = await response.json();
      
      setResumes(prev => prev.map(resume => 
        resume._id === resumeId 
          ? { ...resume, parsedData: data.parsedData } 
          : resume
      ));
      if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
      }
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
      
      setResumes(prev => prev.filter(resume => resume._id !== resumeId));
      
      if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
      }
    } catch (err: any) {
      alert('删除简历失败: ' + err.message);
    }
  };

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
        
        <ResumeUploader 
          onUploadSuccess={handleUploadSuccess} 
          hasExistingResume={hasExistingResume} 
        />
        
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