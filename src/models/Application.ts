import mongoose, { Schema, models, Document } from 'mongoose';

export interface IApplication extends Document {
  userId: mongoose.Types.ObjectId;
  resumeId: mongoose.Types.ObjectId;
  companyName: string;
  positionName: string;
  jobDescription: string;
  matchScore: number;
  appliedAt: Date;
  messageContent: string;
}

const ApplicationSchema = new Schema<IApplication>({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    required: true
  },
  resumeId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Resume',
    required: true
  },
  companyName: { 
    type: String, 
    required: [true, '请提供公司名称'] 
  },
  positionName: { 
    type: String, 
    required: [true, '请提供职位名称'] 
  },
  jobDescription: { 
    type: String 
  },
  matchScore: { 
    type: Number, 
    min: 0,
    max: 100,
    default: 0
  },
  appliedAt: { 
    type: Date, 
    default: Date.now 
  },
  messageContent: { 
    type: String 
  },
});

// 更新索引，移除 status 相关的索引
ApplicationSchema.index({ userId: 1, appliedAt: -1 });

export default models.Application || mongoose.model<IApplication>('Application', ApplicationSchema); 