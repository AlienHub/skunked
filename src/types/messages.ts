import { ExtractedDOMContent, PhishingAnalysisResult } from "./index"

/**
 * Message types sent between components
 */
export type MessageRequest =
  | AnalyzePageMessage
  | ExtractDOMMessage
  | InjectOverlayMessage
  | InjectWarningMessage
  | GetPageStatusMessage
  | SaveAnalysisResultMessage

export interface ExtractDOMMessage {
  action: "extract_dom"
  domContent?: ExtractedDOMContent
}

export interface InjectOverlayMessage {
  action: "inject_overlay"
  data: {
    softwareName: string
    officialUrl: string
    reason: string
    confidence: number
  }
}

export interface InjectWarningMessage {
  action: "inject_warning"
  data: {
    softwareName: string
    officialUrl: string
    reason: string
    confidence: number
  }
}

export interface GetPageStatusMessage {
  action: "get_page_status"
}

export interface SaveAnalysisResultMessage {
  action: "save_analysis_result"
  data: PhishingAnalysisResult
}

export type MessageResponse =
  | { success: true; result: PhishingAnalysisResult; domContent?: ExtractedDOMContent }
  | { success: false; error: string }
  | { status: "safe" | "warning" | "blocked" | "pending"; result?: PhishingAnalysisResult }
  | { status: "pong" }
