'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import React from 'react';

interface Resume {
  _id: string;
  name: string;
  isDefault: boolean;
  parsedData: any;
  createdAt: string;
}

interface ResumeListProps {
  resumes: Resume[];
  onParse: (resumeId: string) => Promise<void>;
  onDelete: (resumeId: string) => Promise<void>;
}

export default function ResumeList({ resumes, onParse, onDelete }: ResumeListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<{ [id: string]: string }>({});
  
  useEffect(() => {
    const newResumes = resumes
      .filter(resume => !resume.parsedData?.personalInfo?.name)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 1);
      
    if (newResumes.length > 0) {
      const loadingState = { ...actionLoading };
      newResumes.forEach(resume => {
        loadingState[resume._id] = 'auto-parsing';
      });
      setActionLoading(loadingState);
      
      const checkInterval = setInterval(() => {
        setTimeout(() => {
          setActionLoading(prev => {
            const newState = { ...prev };
            newResumes.forEach(resume => {
              if (newState[resume._id] === 'auto-parsing') {
                delete newState[resume._id];
              }
            });
            return newState;
          });
        }, 60000);
      }, 5000);
      
      return () => clearInterval(checkInterval);
    }
  }, [resumes]);

  const handleParse = async (resumeId: string) => {
    setActionLoading(prev => ({ ...prev, [resumeId]: 'parsing' }));
    try {
      await onParse(resumeId);
    } finally {
      setActionLoading(prev => {
        const newState = { ...prev };
        delete newState[resumeId];
        return newState;
      });
    }
  };
  
  const handleDelete = async (resumeId: string) => {
    if (!window.confirm('确定要删除这份简历吗？删除后您将没有任何简历，需要重新上传。')) return;
    
    setActionLoading(prev => ({ ...prev, [resumeId]: 'deleting' }));
    try {
      await onDelete(resumeId);
    } finally {
      setActionLoading(prev => {
        const newState = { ...prev };
        delete newState[resumeId];
        return newState;
      });
    }
  };
  
  const toggleExpand = (resumeId: string) => {
    setExpandedId(prevId => prevId === resumeId ? null : resumeId);
  };

  if (resumes.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <p className="text-gray-500 text-center py-8">暂无简历，请上传</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <h2 className="text-lg font-medium text-gray-900 p-6 border-b border-gray-200">我的简历</h2>
      <div className="divide-y divide-gray-200">
        {resumes.map((resume) => (
          <div key={resume._id} className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-100 text-blue-600">
                  📄
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {resume.name}
                    <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">默认</span>
                  </h3>
                  <p className="text-sm text-gray-500">
                    上传时间: {new Date(resume.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {!resume.parsedData?.personalInfo?.name ? (
                  <button
                    key="parse-button"
                    onClick={() => handleParse(resume._id)}
                    disabled={!!actionLoading[resume._id]}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300"
                  >
                    {actionLoading[resume._id] === 'parsing' ? '解析中...' : 
                     actionLoading[resume._id] === 'auto-parsing' ? '自动解析中...' : '解析简历'}
                  </button>
                ) : (
                  <React.Fragment key="actions-buttons">
                    <button
                      key="toggle-button"
                      onClick={() => toggleExpand(resume._id)}
                      className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      {expandedId === resume._id ? '收起' : '查看详情'}
                    </button>
                  </React.Fragment>
                )}
                <button
                  key="delete-button"
                  onClick={() => handleDelete(resume._id)}
                  disabled={!!actionLoading[resume._id]}
                  className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-red-300"
                >
                  {actionLoading[resume._id] === 'deleting' ? '删除中...' : '删除'}
                </button>
              </div>
            </div>
            
            {expandedId === resume._id && resume.parsedData && (
              <div className="mt-6 border-t border-gray-200 pt-4 text-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* 个人信息 */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">个人信息</h4>
                    <table className="w-full">
                      <tbody>
                        {resume.parsedData.personalInfo && (
                          <>
                            <tr key="name">
                              <td className="py-1 text-gray-500 w-1/3">姓名</td>
                              <td className="py-1">{resume.parsedData.personalInfo.name || '-'}</td>
                            </tr>
                            <tr key="email">
                              <td className="py-1 text-gray-500">邮箱</td>
                              <td className="py-1">{resume.parsedData.personalInfo.email || '-'}</td>
                            </tr>
                            <tr key="phone">
                              <td className="py-1 text-gray-500">电话</td>
                              <td className="py-1">{resume.parsedData.personalInfo.phone || '-'}</td>
                            </tr>
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* 技能 */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">技能</h4>
                    {resume.parsedData.skills && resume.parsedData.skills.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {resume.parsedData.skills.map((skill: string, index: number) => (
                          <span key={index} className="px-2 py-1 bg-gray-100 text-gray-800 rounded">
                            {skill}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500">无技能数据</p>
                    )}
                  </div>
                </div>
                
                {/* 工作经验 */}
                <div className="mt-4">
                  <h4 className="font-semibold text-gray-900 mb-2">工作经验</h4>
                  {resume.parsedData.experience && resume.parsedData.experience.length > 0 ? (
                    <div className="space-y-3">
                      {resume.parsedData.experience.map((exp: any, index: number) => (
                        <div key={exp._id || index} className="border-l-2 border-gray-200 pl-4">
                          <p className="font-medium">{exp.company || '公司未知'} - {exp.position || '职位未知'}</p>
                          <p className="text-gray-500 text-xs">{exp.duration || '时间未知'}</p>
                          <p className="mt-1 text-gray-600">{exp.description || '无职责描述'}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">无工作经验数据</p>
                  )}
                </div>
                
                {/* 教育经历 */}
                <div className="mt-4">
                  <h4 className="font-semibold text-gray-900 mb-2">教育经历</h4>
                  {resume.parsedData.education && resume.parsedData.education.length > 0 ? (
                    <div className="space-y-3">
                      {resume.parsedData.education.map((edu: any, index: number) => (
                        <div key={edu._id || index} className="border-l-2 border-gray-200 pl-4">
                          <p className="font-medium">{edu.institution || '学校未知'}</p>
                          <p className="text-gray-500 text-xs">{edu.degree || '学位未知'}</p>
                          <p className="text-gray-500 text-xs">{edu.period || '时间未知'}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">无教育经历数据</p>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
} 