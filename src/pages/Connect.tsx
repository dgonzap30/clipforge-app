import { Flame, ArrowRight, Check } from 'lucide-react'

export function Connect() {
  return (
    <div className="min-h-screen flex">
      {/* Left side - branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-forge-600 to-forge-800 p-12 flex-col justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
            <Flame className="w-7 h-7 text-white" />
          </div>
          <span className="text-2xl font-bold text-white">ClipForge</span>
        </div>
        
        <div className="space-y-8">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Turn your streams into<br />
            <span className="text-forge-200">viral short-form content</span>
          </h1>
          
          <ul className="space-y-4">
            {[
              'AI-powered highlight detection',
              'Automatic vertical reframing',
              'One-click export to TikTok, Reels, Shorts',
              'Animated captions included',
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-3 text-white/90">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                  <Check className="w-4 h-4" />
                </div>
                {feature}
              </li>
            ))}
          </ul>
        </div>
        
        <p className="text-white/60 text-sm">
          © 2026 ClipForge. Stream smarter.
        </p>
      </div>
      
      {/* Right side - auth */}
      <div className="flex-1 flex items-center justify-center p-8 bg-dark-950">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-forge-400 to-forge-600 flex items-center justify-center">
              <Flame className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-bold">ClipForge</span>
          </div>
          
          <div className="text-center lg:text-left">
            <h2 className="text-2xl font-bold">Get started</h2>
            <p className="text-dark-400 mt-2">
              Connect your Twitch account to start generating clips
            </p>
          </div>
          
          {/* Twitch OAuth button */}
          <button className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-[#9146FF] hover:bg-[#7c3aed] rounded-xl font-semibold text-white transition-colors">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
            </svg>
            Connect with Twitch
            <ArrowRight className="w-5 h-5" />
          </button>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-dark-800" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-dark-950 text-dark-500">or continue with</span>
            </div>
          </div>
          
          {/* Email signup */}
          <div className="space-y-4">
            <input
              type="email"
              placeholder="Email address"
              className="input"
            />
            <button className="w-full btn-secondary py-3">
              Continue with Email
            </button>
          </div>
          
          <p className="text-sm text-dark-500 text-center">
            By continuing, you agree to our{' '}
            <a href="#" className="text-forge-400 hover:underline">Terms of Service</a>
            {' '}and{' '}
            <a href="#" className="text-forge-400 hover:underline">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  )
}
