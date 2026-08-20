import { gql } from '@apollo/client'

const RUN_FIELDS = `
  id
  recipeId
  inputText
  outputText
  createdAt
  traceJson
  steps {
    iteration
    stopReason
    assistantText
    note
    toolCalls {
      id
      name
      argumentsJson
      resultSummary
      resultRaw
    }
  }
`

export const RECIPES_QUERY = gql`
  query Recipes {
    recipes {
      id
      name
      model
      tools
      outputFormat
    }
  }
`

export const AGENT_RUNS_QUERY = gql`
  query AgentRuns($limit: Int = 20) {
    agentRuns(limit: $limit) {
      ${RUN_FIELDS}
    }
  }
`

export const AGENT_RUN_QUERY = gql`
  query AgentRun($id: Int!) {
    agentRun(id: $id) {
      ${RUN_FIELDS}
    }
  }
`

export const EVAL_SCORES_QUERY = gql`
  query EvalScores($limit: Int = 50) {
    evalScores(limit: $limit) {
      id
      goldenSetId
      runId
      score
      reasoning
      metricBreakdown
      createdAt
      recipeId
    }
  }
`

export const RUN_AGENT_MUTATION = gql`
  mutation RunAgent($recipeId: String!, $inputText: String!) {
    runAgent(recipeId: $recipeId, inputText: $inputText) {
      ${RUN_FIELDS}
    }
  }
`

export const CORRECT_RUN_MUTATION = gql`
  mutation CorrectRun($runId: Int!, $correctedOutput: String!, $rubric: String) {
    correctRun(runId: $runId, correctedOutput: $correctedOutput, rubric: $rubric) {
      id
      recipeId
      inputText
      expectedAnswer
      source
    }
  }
`

export const DELETE_AGENT_RUN_MUTATION = gql`
  mutation DeleteAgentRun($id: Int!) {
    deleteAgentRun(id: $id)
  }
`
