export type ToolCall = {
  id: string
  name: string
  argumentsJson: string
  resultSummary: string
}

export type TraceStep = {
  iteration: number
  stopReason?: string | null
  assistantText: string
  note?: string | null
  toolCalls: ToolCall[]
}

export type AgentRun = {
  id: number
  recipeId: string
  inputText: string
  outputText: string
  createdAt: string
  steps: TraceStep[]
}

export type Recipe = {
  id: string
  name: string
  model: string
  tools: string[]
  outputFormat: string
}

export type EvalScore = {
  id: number
  goldenSetId: number
  runId: number
  score: number
  reasoning: string
  metricBreakdown: string
  createdAt: string
  recipeId?: string | null
}
