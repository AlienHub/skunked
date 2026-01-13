# 🛡️ Skunked - 反钓鱼卫士

> 基于 AI 语义分析的主动防御型反钓鱼浏览器扩展，专注对抗针对性 SEO 投毒攻击

[![Chrome Web Store](https://img.shields.io/badge/Chrome-Extension-blue?logo=google-chrome)](https://chrome.google.com/webstore)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[English](./README_EN.md) | 简体中文

## 🎯 项目背景

"银狐"等黑产团伙通过购买搜索引擎关键词（SEO 投毒），伪造飞书、钉钉、WPS、QQ 等常用办公软件的下载页面。这些钓鱼页面 UI 与官网几乎一模一样，且域名不断更换，传统基于黑名单的防护往往滞后。

**Skunked 的使命**：一人发现，全网免疫 🦨

## ✨ 核心特性

### 🚀 三层漏斗式防护架构

| 层级 | 技术 | 耗时 |
|------|------|------|
| **第一层** | 本地白/黑名单极速匹配 | < 10ms |
| **第二层** | 特征工程与启发式分析 | < 50ms |
| **第三层** | AI 智能语义研判 | 异步执行 |

### 🔒 隐私优先设计

- 本地优先：核心匹配逻辑完全在本地执行
- 脱敏处理：仅在必要时上传最小化信息
- 无痕浏览：不记录用户正常浏览行为

### 🎨 智能干预 UI

- **高危拦截**：全屏红色覆盖层 + 官网跳转引导
- **中危提示**：顶部黄色警示条
- **安全认证**：官方网站绿色标识

## 📦 安装使用

### 从源码构建

```bash
# 克隆仓库
git clone git@github.com:AlienHub/skunked.git
cd skunked

# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 生产构建
pnpm build
```

### 加载扩展

1. 打开 Chrome 浏览器，访问 `chrome://extensions`
2. 启用"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `build/chrome-mv3-dev` 目录

## 🏗️ 项目结构

```
skunked/
├── src/
│   ├── background.ts      # 后台服务脚本
│   ├── content.ts         # 内容脚本
│   ├── popup.tsx          # 弹出页面
│   ├── options.tsx        # 设置页面
│   ├── components/        # UI 组件
│   ├── services/          # 核心服务
│   │   ├── ai-engine.ts   # AI 分析引擎
│   │   └── ...
│   ├── data/              # 软件库数据
│   └── utils/             # 工具函数
├── assets/                # 静态资源
└── package.json
```

## 🛠️ 技术栈

- **框架**: [Plasmo](https://docs.plasmo.com/) - 现代化浏览器扩展开发框架
- **前端**: React 18 + TypeScript
- **构建**: Plasmo Build System
- **AI**: 支持接入 Gemini / OpenAI API

## 🎯 支持的防护场景

当前版本支持识别以下高频仿冒软件：

| 软件 | 官方域名 |
|------|----------|
| 飞书 | feishu.cn, larksuite.com |
| 钉钉 | dingtalk.com |
| 微信 | weixin.qq.com |
| WPS | wps.cn |
| 向日葵 | oray.com |
| ToDesk | todesk.com |
| 腾讯会议 | meeting.tencent.com |

## 🤝 参与贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 🔗 相关链接

- [Plasmo 文档](https://docs.plasmo.com/)
- [Chrome 扩展开发文档](https://developer.chrome.com/docs/extensions/)

---

<p align="center">
  <strong>🦨 Skunked - 让钓鱼者无处遁形</strong>
</p>
