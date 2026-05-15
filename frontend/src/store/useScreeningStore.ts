import { create } from 'zustand'

export type TestId =
  | 'calibration'
  | 'acuity'
  | 'contrast'
  | 'color'
  | 'astigmatism'
  | 'amsler'

export interface TestResult {
  testId:          TestId
  normalizedScore: number
  rawData:         Record<string, any>
  flags:           string[]
  completedAt:     string
}

interface ScreeningStore {
  currentStep: number
  steps:       TestId[]
  isComplete:  boolean
  pixelsPerMm: number | null
  results:     Partial<Record<TestId, TestResult>>
  sessionId:   string | null
  report:      any | null

  setPixelsPerMm: (ppm: number)                    => void
  setTestResult:  (id: TestId, result: TestResult) => void
  nextStep:       ()                               => void
  setSession:     (id: string)                     => void
  setReport:      (report: any)                    => void
  reset:          ()                               => void
}

const STEPS: TestId[] = [
  'calibration',
  'acuity',
  'contrast',
  'color',
  'astigmatism',
  'amsler',
]

export const useScreeningStore = create<ScreeningStore>((set, get) => ({
  currentStep: 0,
  steps:       STEPS,
  isComplete:  false,
  pixelsPerMm: null,
  results:     {},
  sessionId:   null,
  report:      null,

  setPixelsPerMm: (ppm) => set({ pixelsPerMm: ppm }),

  setTestResult: (id, result) =>
    set((state) => ({
      results: { ...state.results, [id]: result },
    })),

  nextStep: () => {
    const { currentStep, steps } = get()
    const next = currentStep + 1
    if (next >= steps.length) {
      set({ isComplete: true })
    } else {
      set({ currentStep: next })
    }
  },

  setSession: (id)     => set({ sessionId: id }),
  setReport:  (report) => set({ report }),

  reset: () =>
    set({
      currentStep: 0,
      isComplete:  false,
      pixelsPerMm: null,
      results:     {},
      sessionId:   null,
      report:      null,
    }),
}))