import mongoose, { Document, Schema, Model } from 'mongoose';

// 定义订单状态的枚举
enum OrderStatus {
  Pending = 'pending', // 待支付
  Paid = 'paid',       // 已支付
  Failed = 'failed',     // 支付失败
  Cancelled = 'cancelled', // 已取消
}

// 定义订单接口，描述订单文档的结构
interface IOrder extends Document {
  orderId: string; // 我们系统内部的订单号 (对应支付宝的 out_trade_no)
  userId: mongoose.Schema.Types.ObjectId; // 关联的用户 ID
  amount: number; // 订单金额 (单位：元)
  status: OrderStatus; // 订单状态
  paymentGateway: string; // 支付网关 (例如 'alipay')
  transactionId?: string; // 支付网关返回的交易号 (例如支付宝的 trade_no)
  paidAt?: Date; // 支付成功的时间
  createdAt: Date; // 订单创建时间
  updatedAt: Date; // 订单最后更新时间
}

// 创建订单的 Mongoose Schema
const OrderSchema: Schema<IOrder> = new Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true, // 确保订单号唯一
      index: true, // 为订单号创建索引，加快查询速度
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User', // 关联到 User 模型
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(OrderStatus), // 状态必须是枚举中的值
      default: OrderStatus.Pending, // 默认状态为待支付
      required: true,
    },
    paymentGateway: {
      type: String,
      required: true,
      default: 'alipay',
    },
    transactionId: {
      type: String, // 支付宝的交易号，支付成功后记录
      index: true,
    },
    paidAt: {
      type: Date, // 支付成功时间
    },
  },
  {
    timestamps: true, // 自动管理 createdAt 和 updatedAt 字段
  }
);

// 创建并导出 Order 模型
// 使用 mongoose.models.Order || ... 防止重复编译模型
const Order: Model<IOrder> = mongoose.models.Order || mongoose.model<IOrder>('Order', OrderSchema);

export default Order;
export { OrderStatus }; // 导出状态枚举，方便其他地方使用
export type { IOrder }; // 导出类型接口 