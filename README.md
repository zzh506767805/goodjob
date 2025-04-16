# AI智能求职助手

AI智能求职助手是一个帮助用户高效求职的全栈应用程序，包括网页端和浏览器插件两部分。用户可以上传简历，系统会智能解析简历内容，并在用户浏览Boss直聘等求职网站时，自动分析职位的匹配度，生成个性化的打招呼语，提高求职效率。

## 功能特点

- **简历智能解析**：上传PDF或Word格式简历，AI自动提取关键信息
- **职位智能匹配**：分析简历与职位描述的匹配程度，给出匹配分数
- **自动生成打招呼语**：根据简历和职位，AI生成个性化的专业打招呼消息
- **投递记录管理**：跟踪所有职位投递记录，分类管理，添加备注和更新状态
- **浏览器插件集成**：直接在Boss直聘等平台上操作，无需频繁切换窗口

## 技术栈

- **前端**：Next.js, React, TailwindCSS
- **后端**：Node.js, Next.js API Routes
- **数据库**：MongoDB
- **AI服务**：OpenAI API
- **浏览器插件**：Chrome Extension

## 安装与启动

### 前提条件

- Node.js 18+ 
- MongoDB数据库
- OpenAI API密钥

### 环境变量配置

在项目根目录创建`.env.local`文件并配置以下变量：

```
MONGODB_URI=你的MongoDB连接字符串
JWT_SECRET=你的JWT密钥
OPENAI_API_KEY=你的OpenAI API密钥
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=你的NextAuth密钥
```

### 安装依赖

```bash
npm install
```

### 开发环境启动

```bash
npm run dev
```

### 生产环境构建与启动

```bash
npm run build
npm start
```

## 部署到Render

1. 在Render上创建一个新的Web Service
2. 连接GitHub仓库
3. 设置构建命令：`npm install && npm run build`
4. 设置启动命令：`npm start`
5. 在Environment变量中设置所有环境变量
6. 点击Deploy部署

## 项目结构

下面是项目主要文件夹和文件的说明，帮助你了解不同功能的代码放在哪里：

```
ai-resume-assistant/
├── public/                 # 存放网站的静态文件，比如图片、图标等
├── src/                    # 存放项目的主要源代码
│   ├── app/                # Next.js 应用程序的核心，定义了网站的页面和路由
│   │   ├── api/            # 后端接口代码，负责处理数据请求和与数据库、AI服务交互
│   │   ├── auth/           # 用户登录、注册等身份认证功能的页面和逻辑
│   │   ├── dashboard/      # 用户登录后看到的仪表盘页面
│   │   ├── resumes/        # 简历上传、解析和管理相关的页面和功能
│   │   ├── applications/   # 求职申请记录跟踪和管理相关的页面和功能
│   │   ├── pricing/        # 定价方案展示页面
│   │   ├── download-plugin/ # 浏览器插件下载或说明页面
│   │   ├── globals.css     # 全局基础样式文件
│   │   ├── layout.tsx      # 网站整体布局结构文件
│   │   └── page.tsx        # 网站首页的页面文件
│   ├── components/         # 可在不同页面重复使用的界面元素（如下拉菜单、按钮等）
│   ├── contexts/           # 全局状态管理，用于在不同组件间共享数据（如用户登录状态）
│   ├── lib/                # 存放通用的辅助函数、配置文件、或者与外部服务（如AI）交互的逻辑
│   ├── models/             # 定义数据在数据库中如何存储的结构（比如用户数据、简历数据结构）
│   ├── types/              # 定义代码中用到的数据类型，增强代码的健壮性
│   └── middleware.ts       # 中间件，可以在用户访问特定页面或接口前执行一些通用逻辑（如检查登录状态）
├── chrome-extension/       # 浏览器插件的源代码（目前尚未实现）
├── .env.local              # 存储敏感配置信息，如数据库密码、API密钥等（这个文件不应上传到代码仓库）
├── next.config.js          # Next.js 框架的配置文件
├── package.json            # 项目依赖库列表和项目脚本命令
├── tailwind.config.js      # Tailwind CSS (用于美化界面样式) 的配置文件
└── README.md               # 就是你现在正在看的这个文件，项目说明文档
```

## 浏览器插件

浏览器插件的代码在`chrome-extension`目录下（尚未实现），安装方法：

1. 在Chrome浏览器地址栏输入：`chrome://extensions/`
2. 开启右上角的"开发者模式"
3. 点击"加载已解压的扩展程序"，选择`chrome-extension`目录
4. 在插件设置中配置API接口地址和令牌

## 贡献指南

1. Fork项目
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建Pull Request

## 许可证

MIT License

## 联系方式

如有任何问题或建议，请联系：support@airesume.com
