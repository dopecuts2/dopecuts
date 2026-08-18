import { useState } from "react"
import { useNavigate } from "react-router-dom"
import api from "../lib/api"

export default function Login() {
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [step, setStep] = useState("email")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleRequestOtp = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await api.post("/auth/request-otp", { email })
      setStep("otp")
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send OTP")
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await api.post("/auth/verify-otp", { email, otp })
      localStorage.setItem("admin_token", res.data.token)
      navigate("/dashboard")
    } catch (err) {
      setError(err.response?.data?.message || "Invalid OTP")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-widest">DOPECUTS</h1>
          <p className="text-gray-400 text-sm mt-1">Admin Panel</p>
        </div>
        <div className="bg-[#1a1d27] rounded-2xl p-8 border border-gray-800">
          <h2 className="text-white text-xl font-semibold mb-2">{step === "email" ? "Sign in" : "Enter OTP"}</h2>
          <p className="text-gray-500 text-sm mb-6">{step === "email" ? "Enter your admin email to receive a code." : "Code sent to " + email}</p>
          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
          {step === "email" ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@dopecuts.com" required className="w-full bg-[#0f1117] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none text-sm" />
              </div>
              <button type="submit" disabled={loading} className="w-full bg-white text-black font-semibold rounded-lg py-3 text-sm hover:bg-gray-200 transition-colors disabled:opacity-50">{loading ? "Sending..." : "Send OTP"}</button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm mb-1 block">OTP Code</label>
                <input type="text" value={otp} onChange={e => setOtp(e.target.value)} placeholder="Enter 6-digit code" required className="w-full bg-[#0f1117] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none text-sm text-center text-lg tracking-widest" />
              </div>
              <button type="submit" disabled={loading} className="w-full bg-white text-black font-semibold rounded-lg py-3 text-sm hover:bg-gray-200 transition-colors disabled:opacity-50">{loading ? "Verifying..." : "Verify & Sign in"}</button>
              <button type="button" onClick={() => setStep("email")} className="w-full text-gray-500 text-sm hover:text-gray-300 transition-colors">Back</button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}