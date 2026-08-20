import { gql } from '@apollo/client'

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
      id
      recipeId
      inputText
      outputText
      createdAt
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
        }
      }
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
      id
      recipeId
      inputText
      outputText
      createdAt
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
        }
      }
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
