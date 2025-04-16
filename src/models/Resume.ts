import mongoose, { Schema, models, Document } from 'mongoose';

export interface IResume extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  fileUrl: string;
  parsedData: {
    skills: string[];
    experience: Array<{
      company: string;
      position: string;
      duration: string;
      description: string;
    }>;
    education: Array<{
      institution: string;
      degree: string;
      period: string;
    }>;
    personalInfo: {
      name: string;
      email: string;
      phone: string;
    };
  };
  isDefault: boolean;
  createdAt: Date;
}

const ResumeSchema = new Schema<IResume>({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    required: true
  },
  name: { 
    type: String, 
    required: [true, '请提供简历名称'] 
  },
  fileUrl: { 
    type: String, 
    required: [true, '请提供简历文件URL'] 
  },
  parsedData: {
    skills: [String],
    experience: [{
      company: String,
      position: String,
      duration: String,
      description: String
    }],
    education: [{
      institution: String,
      degree: String,
      period: String
    }],
    personalInfo: {
      name: String,
      email: String,
      phone: String
    }
  },
  isDefault: { 
    type: Boolean, 
    default: false 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// 当设置一个简历为默认时，确保其他简历不是默认
ResumeSchema.pre('save', async function(next) {
  if (this.isDefault) {
    try {
      await mongoose.model('Resume').updateMany(
        { userId: this.userId, _id: { $ne: this._id } },
        { $set: { isDefault: false } }
      );
      next();
    } catch (error: any) {
      next(error);
    }
  } else {
    next();
  }
});

export default models.Resume || mongoose.model<IResume>('Resume', ResumeSchema); 