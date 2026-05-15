import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
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

export const generateReport = (sessionId: string) =>
  api.post(`/reports/generate/${sessionId}`).then((r) => r.data)

export const getReport = (reportId: string) =>
  api.get(`/reports/${reportId}`).then((r) => r.data)

export const analyseEyeImage = (file: File, analysisType: string) => {
  const form = new FormData()
  form.append('file', file)
  form.append('analysis_type', analysisType)
  return api
    .post('/analyse/eye-image', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
    })
    .then((r) => r.data)
}