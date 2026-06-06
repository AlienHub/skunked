import { ExtractedDOMContent, PhishingAnalysisResult } from "./index"

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
    datasetVersion?: string
  }
}

export interface InjectWarningMessage {
  action: "inject_warning"
  data: {
    softwareName: string
    officialUrl: string
    reason: string
    confidence: number
    datasetVersion?: string
  }
}

export interface GetPageStatusMessage {
  action: "get_page_status"
}

export interface ActivateTenantMessage {
  action: "activate_tenant"
  data: {
    activationCode: string
  }
}

export interface SyncPolicyMessage {
  action: "sync_policy"
}

export interface FlushReportingMessage {
  action: "flush_reporting"
}

export interface SyncOpenDatasetMessage {
  action: "sync_open_dataset"
}

export interface GetRuntimeInfoMessage {
  action: "get_runtime_info"
}

export interface ReportFalsePositiveMessage {
  action: "report_false_positive"
  data: {
    url: string
    reason?: string
  }
}

export interface RiskBypassedMessage {
  action: "risk_bypassed"
  data: {
    confidence: number
    reason: string
    softwareName?: string
    datasetVersion?: string
  }
}

export type MessageRequest =
  | ExtractDOMMessage
  | InjectOverlayMessage
  | InjectWarningMessage
  | GetPageStatusMessage
  | ActivateTenantMessage
  | SyncPolicyMessage
  | FlushReportingMessage
  | SyncOpenDatasetMessage
  | GetRuntimeInfoMessage
  | ReportFalsePositiveMessage
  | RiskBypassedMessage

export type MessageResponse =
  | { success: true; result?: PhishingAnalysisResult; domContent?: ExtractedDOMContent }
  | { success: false; error: string }
  | { status: "safe" | "warning" | "blocked" | "pending"; result?: PhishingAnalysisResult }
  | {
      success: true
      data: {
        activated: boolean
        orgId?: string
        policyVersion?: string
        queueSize?: number
        datasetVersion?: string
      }
    }
