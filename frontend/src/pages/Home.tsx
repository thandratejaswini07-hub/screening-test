import { Link } from 'react-router-dom'
import eyeBanner from '../assets/eyeBanner.jpg'

const TESTS = [
  {
    icon: '👁️',
    title: 'Visual Acuity Test',
    desc: 'Checks how well you see at various distances.',
  },
  {
   icon: '🌈',
    title: 'Color Blindness Test',
    desc: 'Identifies color vision deficiencies.',
  },
  {
    icon: '🎯',
    title: 'Eye Coordination Test',
    desc: 'Evaluates how well your eyes work together.',
  },
  {
    icon: '🕒',
    title: 'Contrast Sensitivity Test',
    desc: 'Measures your ability to distinguish contrasts.',
  },
  {
    icon: '⚡',
    title: 'Glare Recovery Test',
    desc: 'Assesses how well your eyes recover from glare.',
  },
]

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f7f9fc] text-[#0f172a]">
      {/* NAVBAR */}
      <header className="w-full border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-8 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-blue-700">
              VisionCheck
            </h1>
            <p className="text-sm text-blue-500">
              See Clearly, Live Better
            </p>
          </div>

          <nav className="hidden md:flex items-center gap-10 text-gray-700 font-medium">
            <a
              href="#"
              className="text-blue-600 border-b-2 border-blue-600 pb-1"
            >
              Home
            </a>
            <a href="#">Tests</a>
            <a href="#">How It Works</a>
            <a href="#">About Us</a>
            <a href="#">Contact</a>
          </nav>

          <Link
            to="/screening"
            className="bg-blue-600 hover:bg-blue-700 text-white px-7 py-3 rounded-xl font-semibold transition"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="max-w-7xl mx-auto px-8 pt-16 pb-20 grid lg:grid-cols-2 gap-10 items-center">
        {/* LEFT */}
        <div>
          <h1 className="text-6xl font-bold leading-tight mb-6">
            Comprehensive
            <br />
            Vision Screening
          </h1>

          <p className="text-2xl text-gray-600 leading-relaxed mb-10 max-w-xl">
            Take 5 simple tests to check your eye health and get your detailed
            report instantly.
          </p>

          <div className="flex flex-wrap items-center gap-6 mb-10">
            <Link
              to="/screening"
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl text-xl font-semibold shadow-lg transition"
            >
              Start Screening →
            </Link>

            <button className="flex items-center gap-3 text-blue-600 text-xl font-medium">
              <span className="w-12 h-12 rounded-full border-2 border-blue-600 flex items-center justify-center">
                ▶
              </span>
              How It Works
            </button>
          </div>

          <div className="inline-flex items-center gap-4 bg-[#eef3fb] px-6 py-4 rounded-xl text-gray-700">
            <span>🛡 Quick</span>
            <span>•</span>
            <span>Accurate</span>
            <span>•</span>
            <span>Private</span>
          </div>
        </div>

        {/* RIGHT IMAGE */}
        <div className="relative">
          <div className="rounded-3xl overflow-hidden shadow-2xl">
            <img
            src="https://media.istockphoto.com/id/1345498738/photo/abstract-eyesight-image-with-attractive-european-woman-portrait-digital-eye-lens-and-letters.jpg?s=612x612&w=is&k=20&c=XgytEIx_-v38BguucBRYXnUv1wO8KjlxxUkaTiJ8A-w="
            alt="Vision Screening"
            className="w-full h-[650px] object-cover"
            />
          </div>

          <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-blue-500/10 rounded-3xl"></div>
        </div>
      </section>

      {/* TESTS SECTION */}
      <section className="max-w-7xl mx-auto px-8 pb-20">
        <div className="flex items-center gap-6 mb-10">
          <div className="flex-1 h-px bg-gray-300" />

          <h2 className="text-4xl font-bold text-center">
            5 Comprehensive Tests
          </h2>

          <div className="flex-1 h-px bg-gray-300" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {TESTS.map((test, i) => (
            <div
              key={i}
              className="bg-white border border-gray-200 rounded-3xl p-8 text-center hover:shadow-xl transition"
            >
              <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center text-4xl mx-auto mb-6">
                {test.icon}
              </div>

              <h3 className="text-xl font-semibold mb-4">
                {test.title}
              </h3>

              <p className="text-gray-600 leading-relaxed">
                {test.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* REPORT SECTION */}
      <section className="max-w-7xl mx-auto px-8 pb-24">
        <div className="bg-[#eef3fb] rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-start gap-5">
            <div className="text-5xl">📄</div>

            <div>
              <h3 className="text-3xl font-semibold mb-2">
                Instant Report Generation
              </h3>

              <p className="text-gray-600 text-lg max-w-2xl">
                Get your detailed report instantly with easy-to-understand
                results and recommendations.
              </p>
            </div>
          </div>

          <button className="border border-blue-300 hover:bg-blue-50 text-blue-600 px-8 py-4 rounded-2xl text-lg font-semibold transition">
            📄 View Sample Report
          </button>
        </div>
      </section>
    </div>
  )
}