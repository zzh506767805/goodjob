'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '@/contexts/AuthContext';

interface ResumeUploaderProps {
  onUploadSuccess: (resumeData: any) => void;
}

export default function ResumeUploader({ onUploadSuccess }: ResumeUploaderProps) {
  const { token } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [resumeName, setResumeName] = useState('');

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    
    // 验证文件类型
    if (!['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type)) {
      setError('请上传PDF或Word文档格式的简历');
      return;
    }
    
    // 如果用户未输入简历名称，使用文件名
    if (!resumeName) {
      setResumeName(file.name.replace(/\.[^/.]+$/, '')); // 移除文件扩展名
    }
    
    setIsUploading(true);
    setError('');
    
    try {
      // 创建FormData
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', resumeName || file.name.replace(/\.[^/.]+$/, ''));
      
      // 上传简历
      const response = await fetch('/api/resumes', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '上传失败');
      }
      
      // 通知父组件上传成功
      onUploadSuccess(data.resume);
      
      // 重置表单
      setResumeName('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  }, [token, resumeName, onUploadSuccess]);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxFiles: 1
  });

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">上传新简历</h2>
      
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
          <p className="text-red-500">{error}</p>
        </div>
      )}
      
      <div className="mb-4">
        <label htmlFor="resumeName" className="block text-sm font-medium text-gray-700 mb-1">
          简历名称
        </label>
        <input
          type="text"
          id="resumeName"
          value={resumeName}
          onChange={(e) => setResumeName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          placeholder="例如：前端开发简历"
        />
      </div>
      
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer ${
          isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input {...getInputProps()} />
        {isUploading ? (
          <div className="text-gray-500">
            <div className="flex justify-center mb-2">
              <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <p>上传中...</p>
          </div>
        ) : isDragActive ? (
          <p className="text-blue-500">拖放文件到这里</p>
        ) : (
          <div>
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
            </svg>
            <p className="mt-2 text-gray-600">拖放简历文件到这里，或点击选择文件</p>
            <p className="mt-1 text-sm text-gray-500">支持PDF和Word文档格式</p>
          </div>
        )}
      </div>
    </div>
  );
} 