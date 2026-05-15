import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Screening from './pages/Screening'
import Report from './pages/Report'

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/screening" element={<Screening />} />
          <Route path="/report" element={<Report />} />
        </Routes>
      </main>
    </div>
  )
}