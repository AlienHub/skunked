import { ExtractedDOMContent } from "../types"

/**
 * Extract relevant DOM content for AI analysis
 * Called from content script
 */
export function extractDOMContent(): ExtractedDOMContent {
  const url = window.location.href

  // Extract title
  const title = document.title || ""

  // Extract meta description
  const metaDescription =
    document.querySelector('meta[name="description"]')?.getAttribute("content") || ""

  // Extract H1
  const h1Text = document.querySelector("h1")?.textContent || ""

  // Extract button texts (especially download buttons)
  const buttons = Array.from(document.querySelectorAll("button, a"))
  const buttonTexts = buttons
    .map((btn) => btn.textContent?.trim())
    .filter((text): text is string => !!text && text.length < 100)
    .slice(0, 20) // Limit to 20 buttons

  // Extract link texts
  const links = Array.from(document.querySelectorAll("a[href]"))
  const linkTexts = links
    .map((link) => link.textContent?.trim())
    .filter((text): text is string => !!text && text.length < 100)
    .slice(0, 20)

  // Extract footer text
  const footerText =
    document.querySelector("footer")?.textContent || ""

  // Extract download-related keywords
  const allText = document.body.textContent || ""
  const downloadKeywords = [
    "下载",
    "download",
    "安装",
    "install",
    "免费",
    "free",
    "破解",
    "crack",
    "vip",
    "绿色版",
    "破解版"
  ].filter((kw) => allText.toLowerCase().includes(kw.toLowerCase()))

  return {
    url,
    title,
    metaDescription,
    h1Text,
    buttonTexts,
    linkTexts,
    footerText,
    downloadKeywords
  }
}
