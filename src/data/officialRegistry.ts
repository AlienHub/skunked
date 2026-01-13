import { OfficialSoftware } from "../types"

export const OFFICIAL_SOFTWARE_REGISTRY: OfficialSoftware[] = [
  {
    id: "feishu",
    name: "飞书",
    nameEn: "Feishu",
    officialDomains: ["feishu.cn", "larksuite.com"],
    keywords: ["飞书", "feishu", "lark", "协同", "办公", "字节"],
    category: "office"
  },
  {
    id: "dingtalk",
    name: "钉钉",
    nameEn: "DingTalk",
    officialDomains: ["dingtalk.com", "aliwork.com"],
    keywords: ["钉钉", "dingtalk", "阿里", "协同", "办公"],
    category: "communication"
  },
  {
    id: "wps",
    name: "WPS Office",
    nameEn: "WPS",
    officialDomains: ["wps.cn", "kingsoft.com", "wps.com"],
    keywords: ["wps", "office", "金山", "kingsoft", "文档", "表格", "演示"],
    category: "office"
  },
  {
    id: "wechat",
    name: "微信",
    nameEn: "WeChat",
    officialDomains: ["weixin.qq.com", "wechat.com", "wx.qq.com"],
    keywords: ["微信", "wechat", "weixin", "腾讯"],
    category: "communication"
  },
  {
    id: "qq",
    name: "QQ",
    nameEn: "QQ",
    officialDomains: ["qq.com", "im.qq.com", "tencent.com"],
    keywords: ["qq", "腾讯", "tencent", "即时通讯"],
    category: "communication"
  },
  {
    id: "xiangrikui",
    name: "向日葵",
    nameEn: "Sunlogin",
    officialDomains: ["oray.com", "sunlogin.oray.com"],
    keywords: ["向日葵", "sunlogin", "oray", "远程", "控制"],
    category: "remote_control"
  },
  {
    id: "todesk",
    name: "ToDesk",
    nameEn: "ToDesk",
    officialDomains: ["todesk.com"],
    keywords: ["todesk", "远程", "控制"],
    category: "remote_control"
  },
  {
    id: "teamviewer",
    name: "TeamViewer",
    nameEn: "TeamViewer",
    officialDomains: ["teamviewer.com"],
    keywords: ["teamviewer", "远程", "控制"],
    category: "remote_control"
  },
  {
    id: "anydesk",
    name: "AnyDesk",
    nameEn: "AnyDesk",
    officialDomains: ["anydesk.com"],
    keywords: ["anydesk", "远程", "控制"],
    category: "remote_control"
  },
  {
    id: "xshell",
    name: "Xshell",
    nameEn: "Xshell",
    officialDomains: ["xshell.com", "netsarang.com"],
    keywords: ["xshell", "netsarang", "ssh", "终端"],
    category: "office"
  }
]

export function getSoftwareByName(name: string): OfficialSoftware | undefined {
  return OFFICIAL_SOFTWARE_REGISTRY.find(
    (s) => s.name === name || s.nameEn.toLowerCase() === name.toLowerCase()
  )
}

export function getSoftwareByDomain(
  domain: string
): OfficialSoftware | undefined {
  const normalizedDomain = domain.toLowerCase()
  return OFFICIAL_SOFTWARE_REGISTRY.find((software) =>
    software.officialDomains.some(
      (officialDomain) =>
        normalizedDomain.includes(officialDomain.toLowerCase()) ||
        officialDomain.toLowerCase().includes(normalizedDomain)
    )
  )
}

export function getAllOfficialDomains(): string[] {
  return OFFICIAL_SOFTWARE_REGISTRY.flatMap((s) => s.officialDomains)
}

export function getAllKeywords(): string[] {
  return OFFICIAL_SOFTWARE_REGISTRY.flatMap((s) => s.keywords)
}
