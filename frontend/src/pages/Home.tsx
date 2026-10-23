import { Link } from 'react-router-dom'

const TESTS = [
  {
    num: '01',
    title: 'Visual Acuity',
    desc: 'Measures how clearly you see at various distances using Landolt C optotypes.',
  },
  {
    num: '02',
    title: 'Color Vision',
    desc: 'Identifies red-green color deficiencies using Ishihara-style dot plates.',
  },
  {
    num: '03',
    title: 'Contrast Sensitivity',
    desc: 'Measures your ability to distinguish subtle differences in light and dark.',
  },
  {
    num: '04',
    title: 'Astigmatism Check',
    desc: 'Evaluates corneal irregularities using a clock-dial spoke pattern.',
  },
  {
    num: '05',
    title: 'Amsler Grid',
    desc: 'Screens central visual field for distortion or missing areas.',
  },
]

export default function Home() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)', color: 'var(--text)' }}>

      {/* NAVBAR */}
      <header
        className="w-full border-b sticky top-0 z-50"
        style={{
          background: 'rgba(7, 13, 26, 0.85)',
          borderColor: 'rgba(61,139,255,0.12)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ background: 'linear-gradient(135deg,#3d8bff,#5c67f2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
            >
              VisionCheck
            </h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>See Clearly, Live Better</p>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            <a href="#" style={{ color: 'var(--accent)' }}>Home</a>
            <a href="#tests" className="hover:text-white transition-colors">Tests</a>
            <a href="#" className="hover:text-white transition-colors">How It Works</a>
            <a href="#" className="hover:text-white transition-colors">About</a>
          </nav>

          <Link
            to="/screening"
            className="btn-accent px-6 py-2.5 rounded-xl text-sm font-semibold"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="max-w-7xl mx-auto px-8 pt-24 pb-28 grid lg:grid-cols-2 gap-16 items-center">
        {/* LEFT */}
        <div>
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium mb-8"
            style={{ background: 'rgba(61,139,255,0.1)', border: '1px solid rgba(61,139,255,0.25)', color: 'var(--accent)' }}
          >
            <span className="w-2 h-2 rounded-full bg-green-400" style={{ animation: 'pulse 2s infinite' }} />
            AI-Powered Vision Screening
          </div>

          <h1 className="text-6xl font-bold leading-tight mb-6">
            <span className="text-white">Comprehensive</span>
            <br />
            <span
              style={{
                background: 'linear-gradient(135deg,#3d8bff,#5c67f2)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Vision Screening
            </span>
          </h1>

          <p className="text-lg leading-relaxed mb-10" style={{ color: 'var(--text-muted)', maxWidth: '480px' }}>
            Take 5 clinical tests to assess your eye health and receive a detailed AI-generated report — all processed locally on your device.
          </p>

          <div className="flex flex-wrap items-center gap-4 mb-10">
            <Link
              to="/screening"
              className="btn-accent px-8 py-4 rounded-xl text-base font-semibold"
            >
              Start Screening
            </Link>
            <button
              className="px-8 py-4 rounded-xl text-base font-semibold border transition-colors hover:bg-white/5"
              style={{ border: '1px solid rgba(61,139,255,0.3)', color: 'var(--accent)' }}
            >
              How It Works
            </button>
          </div>

          <div
            className="inline-flex items-center gap-6 px-6 py-4 rounded-xl text-sm"
            style={{ background: 'rgba(17,31,54,0.8)', border: '1px solid rgba(61,139,255,0.12)', color: 'var(--text-muted)' }}
          >
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--success)' }} />
              Quick
            </span>
            <span className="w-px h-4" style={{ background: 'rgba(61,139,255,0.2)' }} />
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
              Accurate
            </span>
            <span className="w-px h-4" style={{ background: 'rgba(61,139,255,0.2)' }} />
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#5c67f2' }} />
              Private
            </span>
          </div>
        </div>

        {/* RIGHT IMAGE */}
        <div className="relative">
          <div
            className="rounded-3xl overflow-hidden"
            style={{
              border: '1px solid rgba(61,139,255,0.2)',
              boxShadow: '0 0 60px rgba(61,139,255,0.15)',
            }}
          >
            <img
              src="https://media.istockphoto.com/id/1345498738/photo/abstract-eyesight-image-with-attractive-european-woman-portrait-digital-eye-lens-and-letters.jpg?s=612x612&w=is&k=20&c=XgytEIx_-v38BguucBRYXnUv1wO8KjlxxUkaTiJ8A-w="
              alt="Vision Screening"
              className="w-full object-cover"
              style={{ height: '560px' }}
            />
            <div
              className="absolute inset-0 rounded-3xl"
              style={{ background: 'linear-gradient(135deg,rgba(61,139,255,0.05),rgba(92,103,242,0.1))' }}
            />
          </div>

          {/* Floating stat card */}
          <div
            className="absolute -bottom-6 -left-6 px-6 py-4 rounded-2xl"
            style={{
              background: 'rgba(17,31,54,0.95)',
              border: '1px solid rgba(61,139,255,0.2)',
              backdropFilter: 'blur(16px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
          >
            <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Powered by</p>
            <p className="text-sm font-semibold text-white">Qwen2.5-VL-3B-Instruct</p>
            <p className="text-xs mt-1" style={{ color: 'var(--success)' }}>Running locally</p>
          </div>
        </div>
      </section>

      {/* TESTS SECTION */}
      <section id="tests" className="max-w-7xl mx-auto px-8 pb-28">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--accent)' }}>What We Test</p>
          <h2 className="text-4xl font-bold text-white">5 Comprehensive Tests</h2>
          <p className="mt-3 text-base" style={{ color: 'var(--text-muted)' }}>Each test follows standardized clinical protocols</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
          {TESTS.map((test) => (
            <div
              key={test.num}
              className="p-6 rounded-2xl transition-all duration-300 group cursor-default"
              style={{
                background: 'rgba(17,31,54,0.7)',
                border: '1px solid rgba(61,139,255,0.12)',
                backdropFilter: 'blur(8px)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.border = '1px solid rgba(61,139,255,0.4)'
                ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 24px rgba(61,139,255,0.1)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.border = '1px solid rgba(61,139,255,0.12)'
                ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold mb-5"
                style={{ background: 'rgba(61,139,255,0.15)', color: 'var(--accent)' }}
              >
                {test.num}
              </div>
              <h3 className="text-base font-semibold text-white mb-2">{test.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{test.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* REPORT BANNER */}
      <section className="max-w-7xl mx-auto px-8 pb-28">
        <div
          className="rounded-3xl p-10 flex flex-col md:flex-row items-center justify-between gap-8"
          style={{
            background: 'linear-gradient(135deg, rgba(61,139,255,0.12), rgba(92,103,242,0.12))',
            border: '1px solid rgba(61,139,255,0.2)',
          }}
        >
          <div className="flex items-start gap-6">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(61,139,255,0.15)', border: '1px solid rgba(61,139,255,0.25)' }}
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7" stroke="#3d8bff" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-2">Instant Report Generation</h3>
              <p className="text-base leading-relaxed" style={{ color: 'var(--text-muted)', maxWidth: '520px' }}>
                Get your detailed vision report instantly with easy-to-understand results and AI-powered recommendations.
              </p>
            </div>
          </div>

          <Link
            to="/screening"
            className="btn-accent px-8 py-4 rounded-2xl text-base font-semibold flex-shrink-0"
          >
            View Sample Report
          </Link>
        </div>
      </section>
    </div>
  )
}