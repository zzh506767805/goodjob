/**
 * 支付宝相关配置
 * 请务必将这里的占位符替换为您的真实配置！
 * 建议使用环境变量来存储敏感信息，例如 process.env.ALIPAY_APP_ID
 */
export const alipayConfig = {
  // 应用ID,您的APPID
  appId: process.env.ALIPAY_APP_ID || '',

  // 应用私钥, 用于签名
  // privateKey必须是标准PEM格式的PKCS8私钥，包含完整的头部和尾部
  // 必须使用\n表示换行，例如：-----BEGIN PRIVATE KEY-----\n密钥内容\n-----END PRIVATE KEY-----
  privateKey: process.env.ALIPAY_PRIVATE_KEY
    ? process.env.ALIPAY_PRIVATE_KEY.replace(/\\n/g, '\n')
    : '',

  // 支付宝公钥，用于验签
  // alipayPublicKey必须是标准PEM格式的公钥，包含完整的头部和尾部
  // 必须使用\n表示换行，例如：-----BEGIN PUBLIC KEY-----\n密钥内容\n-----END PUBLIC KEY-----
  alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY
    ? process.env.ALIPAY_PUBLIC_KEY.replace(/\\n/g, '\n')
    : '',

  // 支付宝网关，沙箱环境和正式环境不同
  // 沙箱环境: https://openapi-sandbox.dl.alipaydev.com/gateway.do
  // 正式环境: https://openapi.alipay.com/gateway.do
  gateway: process.env.ALIPAY_GATEWAY || 'https://openapi.alipaydev.com/gateway.do', // 默认沙箱环境

  // 支付宝异步通知回调地址 (需要公网可访问)
  // 确保与支付宝开放平台配置的一致
  notifyUrl: process.env.ALIPAY_NOTIFY_URL || '',

  // 支付宝同步跳转地址 (可选, 支付成功后浏览器跳转)
  returnUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/payment/success`, // 确保取消注释

  // 字符编码格式
  charset: 'utf-8',

  // 签名方式
  signType: 'RSA2',

  // 版本号
  version: '1.0',
}; // 确保 alipayConfig 对象正确闭合

/**
 * 应用程序的基础 URL
 * 用于生成支付成功或取消时的跳转链接
 */
export const appConfig = { // 确保 appConfig 定义在 alipayConfig 之后
  baseUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
};

export {}; // 添加空的 export 语句