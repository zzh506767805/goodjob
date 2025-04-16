'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';

interface Application {
  _id: string;
  companyName: string;
  positionName: string;
  jobDescription: string;
  appliedAt: string;
  matchScore: number;
  messageContent: string;
  resumeId: {
    _id: string;
    name: string;
  };
}

export default function Applications() {
  const { token } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      fetchApplications();
    }
  }, [token]);

  const fetchApplications = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/applications', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('获取投递记录失败');
      }
      
      const data = await response.json();
      setApplications(data.applications);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpand = (applicationId: string) => {
    setExpandedId(prevId => prevId === applicationId ? null : applicationId);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">投递记录</h1>
        
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4">
            <p className="text-red-500">{error}</p>
          </div>
        )}
        
        <div className="bg-white shadow rounded-lg p-4">
           <p className="text-sm text-gray-500 text-right">
              共 <span className="font-semibold">{applications.length}</span> 条记录
            </p>
        </div>
        
        {isLoading ? (
          <div className="bg-white shadow rounded-lg p-6">
            <p className="text-center text-gray-500">正在加载投递记录...</p>
          </div>
        ) : applications.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-6">
            <p className="text-center text-gray-500">暂无投递记录</p>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="divide-y divide-gray-200">
              {applications.map((application) => (
                <div key={application._id} className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">{application.companyName}</h3>
                      <p className="text-gray-600">{application.positionName}</p>
                      <div className="flex items-center mt-1 space-x-4">
                        <span className="text-sm text-gray-500">
                          投递时间: {new Date(application.appliedAt).toLocaleDateString()}
                        </span>
                        {application.matchScore > 0 && (
                          <span className="text-sm text-gray-500">
                            匹配度: 
                            <span className={`ml-1 font-medium ${
                              application.matchScore >= 80 ? 'text-green-600' :
                              application.matchScore >= 60 ? 'text-blue-600' :
                              'text-yellow-600'
                            }`}>
                              {application.matchScore}%
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => toggleExpand(application._id)}
                        className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                      >
                        {expandedId === application._id ? '收起' : '查看详情'}
                      </button>
                    </div>
                  </div>
                  
                  {expandedId === application._id && (
                    <div className="mt-6 border-t border-gray-200 pt-4 space-y-4">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-2">打招呼内容</h4>
                        <div className="p-3 bg-gray-50 rounded text-gray-700 text-sm whitespace-pre-wrap">
                          {application.messageContent || '无'}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-2">职位描述</h4>
                        <div className="p-3 bg-gray-50 rounded text-gray-700 text-sm max-h-60 overflow-y-auto">
                          <pre className="whitespace-pre-wrap font-sans">
                            {application.jobDescription || '未提供'}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
} 