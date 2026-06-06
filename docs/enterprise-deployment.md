# SKUNKED 企业部署手册（Chrome）

本文档用于企业管理员批量下发 SKUNKED 插件，实现员工侧“安装即生效”。

## 1. 部署模式

首发推荐模式：

1. 在 Chrome Web Store 上架正式版插件。
2. 使用企业策略 `ExtensionInstallForcelist` 强制安装。
3. 通过激活码完成企业绑定，开启组织级策略和事件审计。

## 2. 前置准备

- 已有 Google Admin Console 或本地组策略下发能力。
- 已获取插件的 Web Store 扩展 ID（发布后可见）。
- 已在云端分配企业激活码（对应 `orgId`）。

## 3. 批量强制安装

## 3.1 Google Admin Console（推荐）

1. 打开 `设备 -> Chrome -> 应用和扩展程序`。
2. 选择目标组织单位（OU）。
3. 添加应用，选择 Chrome Web Store 中的 SKUNKED 插件。
4. 安装策略选择 **强制安装**。
5. 保存后等待策略生效。

## 3.2 Windows 组策略（本地 AD）

在策略中配置（示例）：

```txt
ExtensionInstallForcelist = ["<EXTENSION_ID>;https://clients2.google.com/service/update2/crx"]
```

将 `<EXTENSION_ID>` 替换为发布后的真实 ID。

## 3.3 macOS 配置描述文件

在 `com.google.Chrome` 下发策略键：

```xml
<key>ExtensionInstallForcelist</key>
<array>
  <string>&lt;EXTENSION_ID&gt;;https://clients2.google.com/service/update2/crx</string>
</array>
```

## 4. 激活与验收

1. 员工端安装插件后默认启用基础防护。
2. 管理员在插件 `Options` 页输入企业激活码。
3. 激活成功后可看到：
   - 组织绑定状态；
   - 策略版本；
   - 待上报事件队列大小。

## 5. 回滚与应急

- 临时停用：将强制安装改为允许安装但禁用。
- 紧急回滚：在策略中移除插件 ID。
- 云端故障时：插件自动降级为本地规则 + 启发式防护，上报可能延迟。

## 6. 运维建议

- 每日检查导出事件量（阻断/告警趋势）。
- 每周复盘误报反馈，优化策略阈值和品牌识别词库。
- 建议将策略同步周期设置在 30 分钟以内。
