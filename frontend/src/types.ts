export type ToolCall = {
  id: string
  name: string
  argumentsJson: string
  resultSummary: string
  resultRaw?: string
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
  traceJson?: string
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

export type LiveProgressEvent = {
  type: string
  message?: string
  iteration?: number
  tool?: string
  arguments?: unknown
  result_raw?: string
  text?: string
  error?: string
  run_id?: number
  output_text?: string
  trace_json?: string
  recipe_id?: string
  input_text?: string
  created_at?: string
}
