import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://mnr-qwen-1.onrender.com/api',
  timeout: 300000,
})

export const submitScreening = (
  tests: {
    test_id:          string
    normalized_score: number
    flags:            string[]
    raw_data:         Record<string, any>
    completed_at:     string
  }[]
) => api.post('/screening/submit', { tests }).then((r) => r.data)

/** Kick off background report generation (returns immediately with status=pending) */
export const generateReport = (sessionId: string) =>
  api.post(`/reports/generate/${sessionId}`).then((r) => r.data)

/**
 * Poll GET /reports/status/{sessionId} until the report is ready.
 * Resolves with the report object, or throws after maxWaitMs.
 */
export const pollForReport = async (
  sessionId: string,
  intervalMs = 3000,
  maxWaitMs  = 300_000,
): Promise<any> => {
  const deadline = Date.now() + maxWaitMs

  while (Date.now() < deadline) {
    const res = await api.get(`/reports/status/${sessionId}`).then((r) => r.data)
    if (res.ready && res.report) return res.report
    if (res.status === 'error') throw new Error('Report generation failed on server')
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  throw new Error('Report generation timed out — please try again')
}

export const getReport = (reportId: string) =>
  api.get(`/reports/${reportId}`).then((r) => r.data)

export const analyseEyeImage = (file: File, analysisType: string) => {
  const form = new FormData()
  form.append('file', file)
  form.append('analysis_type', analysisType)
  return api
    .post('/analyse/retina', form, {   // backend route is /api/analyse/retina
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300_000,
    })
    .then((r) => r.data)
}
