import { AnalyzeRequestPayload, RiskDecision } from "../types"
import { analyzeWithCloud } from "./cloudClient"

/**
 * Backward compatible name: analysis is now performed by cloud API
 * with unified risk decision protocol.
 */
export async function analyzeWithAI(payload: AnalyzeRequestPayload): Promise<RiskDecision> {
  return analyzeWithCloud(payload)
}
