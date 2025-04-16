import mongoose, { Schema, models, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  email: string;
  password: string;
  name: string;
  createdAt: Date;
  defaultResumeId?: mongoose.Types.ObjectId;
  isMember?: boolean;
  dailySubmissions?: number;
  lastSubmissionDate?: Date;
  comparePassword(password: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>({
  email: { 
    type: String, 
    required: [true, '请提供邮箱地址'], 
    unique: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, '请提供有效的邮箱地址']
  },
  password: { 
    type: String, 
    required: [true, '请提供密码'],
    minlength: [6, '密码长度至少为6个字符']
  },
  name: { 
    type: String,
    required: [true, '请提供用户名'] 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  defaultResumeId: {
    type: Schema.Types.ObjectId,
    ref: 'Resume',
    required: false
  },
  isMember: {
    type: Boolean,
    default: false
  },
  dailySubmissions: {
    type: Number,
    default: 0
  },
  lastSubmissionDate: {
    type: Date
  }
});

// 密码加密
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// 密码比对方法
UserSchema.methods.comparePassword = async function(password: string): Promise<boolean> {
  return await bcrypt.compare(password, this.password);
};

// 检查该模型是否已经定义，防止热重载引起的模型重复定义错误
export default models.User || mongoose.model<IUser>('User', UserSchema); 