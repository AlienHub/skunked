# 🛡️ Skunked - Anti-Phishing Guardian

> AI-powered proactive defense browser extension against SEO poisoning attacks

[![Chrome Web Store](https://img.shields.io/badge/Chrome-Extension-blue?logo=google-chrome)](https://chrome.google.com/webstore)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

English | [简体中文](./README.md)

## 🎯 Background

Cybercriminal groups like "Silverfox" purchase search engine keywords (SEO poisoning) to create fake download pages for popular software such as Feishu, DingTalk, WPS, and QQ. These phishing pages look nearly identical to official websites, and their domains change constantly, making traditional blacklist-based protection ineffective.

**Skunked's Mission**: One discovers, everyone is immune 🦨

## ✨ Key Features

### 🚀 Three-Layer Funnel Protection Architecture

| Layer | Technology | Latency |
|-------|------------|---------|
| **Layer 1** | Local whitelist/blacklist matching | < 10ms |
| **Layer 2** | Feature engineering & heuristic analysis | < 50ms |
| **Layer 3** | AI semantic analysis | Async |

### 🔒 Privacy-First Design

- **Local Priority**: Core matching logic runs entirely locally
- **Data Minimization**: Only upload minimal information when necessary
- **No Tracking**: Does not record normal browsing behavior

### 🎨 Smart Intervention UI

- **High Risk**: Full-screen red overlay with official site redirect
- **Medium Risk**: Yellow warning bar at top
- **Verified Safe**: Green badge for official websites

## 📦 Installation

### Build from Source

```bash
# Clone the repository
git clone git@github.com:AlienHub/skunked.git
cd skunked

# Install dependencies
pnpm install

# Development mode
pnpm dev

# Production build
pnpm build
```

### Load Extension

1. Open Chrome browser and navigate to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `build/chrome-mv3-dev` directory

## 🏗️ Project Structure

```
skunked/
├── src/
│   ├── background.ts      # Background service worker
│   ├── content.ts         # Content script
│   ├── popup.tsx          # Popup page
│   ├── options.tsx        # Options page
│   ├── components/        # UI components
│   ├── services/          # Core services
│   │   ├── ai-engine.ts   # AI analysis engine
│   │   └── ...
│   ├── data/              # Software registry data
│   └── utils/             # Utility functions
├── assets/                # Static assets
└── package.json
```

## 🛠️ Tech Stack

- **Framework**: [Plasmo](https://docs.plasmo.com/) - Modern browser extension development framework
- **Frontend**: React 18 + TypeScript
- **Build**: Plasmo Build System
- **AI**: Supports Gemini / OpenAI API integration

## 🎯 Protected Software

Current version supports detection of the following commonly spoofed software:

| Software | Official Domain |
|----------|-----------------|
| Feishu | feishu.cn, larksuite.com |
| DingTalk | dingtalk.com |
| WeChat | weixin.qq.com |
| WPS | wps.cn |
| Sunlogin | oray.com |
| ToDesk | todesk.com |
| Tencent Meeting | meeting.tencent.com |

## 🤝 Contributing

Issues and Pull Requests are welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details

## 🔗 Resources

- [Plasmo Documentation](https://docs.plasmo.com/)
- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)

---

<p align="center">
  <strong>🦨 Skunked - Making phishers nowhere to hide</strong>
</p>
