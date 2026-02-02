import { Save } from 'lucide-react'
import { useStore, type Settings as SettingsType } from '../store'
import { useState } from 'react'

export function Settings() {
  const settings = useStore((state) => state.settings)
  const updateSettings = useStore((state) => state.updateSettings)

  // Local form state
  const [formData, setFormData] = useState<SettingsType>(settings)

  // Update local form state
  const updateFormData = (updates: Partial<SettingsType>) => {
    setFormData((prev) => ({
      ...prev,
      ...updates,
      detection: {
        ...prev.detection,
        ...(updates.detection || {}),
      },
      output: {
        ...prev.output,
        ...(updates.output || {}),
      },
    }))
  }

  // Save handler
  const handleSave = () => {
    updateSettings(formData)
    // The persist middleware in Zustand will automatically save to localStorage
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-dark-400 mt-1">Configure your clip generation preferences</p>
      </div>

      {/* Detection Settings */}
      <section className="card p-6 space-y-6">
        <h2 className="text-lg font-semibold">Detection Settings</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Clip Duration Range
            </label>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-xs text-dark-400">Min (seconds)</label>
                <input
                  type="number"
                  value={formData.detection.minDuration}
                  onChange={(e) => updateFormData({
                    detection: { ...formData.detection, minDuration: Number(e.target.value) }
                  })}
                  className="input mt-1"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-dark-400">Max (seconds)</label>
                <input
                  type="number"
                  value={formData.detection.maxDuration}
                  onChange={(e) => updateFormData({
                    detection: { ...formData.detection, maxDuration: Number(e.target.value) }
                  })}
                  className="input mt-1"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Detection Sensitivity
            </label>
            <select
              className="input"
              value={formData.detection.sensitivity}
              onChange={(e) => updateFormData({
                detection: { ...formData.detection, sensitivity: e.target.value as 'low' | 'medium' | 'high' }
              })}
            >
              <option value="low">Low - Fewer clips, higher quality</option>
              <option value="medium">Medium - Balanced</option>
              <option value="high">High - More clips, some may be lower quality</option>
            </select>
          </div>

          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.detection.chatAnalysis}
                onChange={(e) => updateFormData({
                  detection: { ...formData.detection, chatAnalysis: e.target.checked }
                })}
                className="w-5 h-5 rounded border-dark-600 bg-dark-800 text-forge-500 focus:ring-forge-500"
              />
              <div>
                <span className="font-medium">Chat Analysis</span>
                <p className="text-sm text-dark-400">Detect moments with high chat activity</p>
              </div>
            </label>
          </div>

          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.detection.audioPeaks}
                onChange={(e) => updateFormData({
                  detection: { ...formData.detection, audioPeaks: e.target.checked }
                })}
                className="w-5 h-5 rounded border-dark-600 bg-dark-800 text-forge-500 focus:ring-forge-500"
              />
              <div>
                <span className="font-medium">Audio Peaks</span>
                <p className="text-sm text-dark-400">Detect loud/hype moments from audio</p>
              </div>
            </label>
          </div>

          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.detection.faceReactions}
                onChange={(e) => updateFormData({
                  detection: { ...formData.detection, faceReactions: e.target.checked }
                })}
                className="w-5 h-5 rounded border-dark-600 bg-dark-800 text-forge-500 focus:ring-forge-500"
              />
              <div>
                <span className="font-medium">Face Reactions</span>
                <p className="text-sm text-dark-400">Analyze streamer face cam for reactions</p>
              </div>
            </label>
          </div>
        </div>
      </section>

      {/* Output Settings */}
      <section className="card p-6 space-y-6">
        <h2 className="text-lg font-semibold">Output Settings</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Default Format
            </label>
            <select
              className="input"
              value={formData.output.defaultFormat}
              onChange={(e) => updateFormData({
                output: { ...formData.output, defaultFormat: e.target.value as 'vertical' | 'square' | 'horizontal' }
              })}
            >
              <option value="vertical">Vertical (9:16) - TikTok, Reels, Shorts</option>
              <option value="square">Square (1:1) - Instagram Feed</option>
              <option value="horizontal">Horizontal (16:9) - YouTube, Twitter</option>
            </select>
          </div>

          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.output.autoCaptions}
                onChange={(e) => updateFormData({
                  output: { ...formData.output, autoCaptions: e.target.checked }
                })}
                className="w-5 h-5 rounded border-dark-600 bg-dark-800 text-forge-500 focus:ring-forge-500"
              />
              <div>
                <span className="font-medium">Auto Captions</span>
                <p className="text-sm text-dark-400">Generate animated captions automatically</p>
              </div>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Caption Style
            </label>
            <select
              className="input"
              value={formData.output.captionStyle}
              onChange={(e) => updateFormData({
                output: { ...formData.output, captionStyle: e.target.value as 'minimal' | 'bold' | 'tiktok' }
              })}
            >
              <option value="minimal">Minimal - Clean white text</option>
              <option value="bold">Bold - Highlighted keywords</option>
              <option value="tiktok">TikTok - Word-by-word animation</option>
            </select>
          </div>
        </div>
      </section>
      
      {/* Connected Accounts */}
      <section className="card p-6 space-y-6">
        <h2 className="text-lg font-semibold">Connected Accounts</h2>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-dark-800 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center font-bold">
                T
              </div>
              <div>
                <p className="font-medium">Twitch</p>
                <p className="text-sm text-dark-400">Not connected</p>
              </div>
            </div>
            <button className="btn-secondary">Connect</button>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-dark-800 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center font-bold">
                T
              </div>
              <div>
                <p className="font-medium">TikTok</p>
                <p className="text-sm text-dark-400">For auto-upload</p>
              </div>
            </div>
            <button className="btn-secondary">Connect</button>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-dark-800 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center font-bold">
                Y
              </div>
              <div>
                <p className="font-medium">YouTube</p>
                <p className="text-sm text-dark-400">For Shorts upload</p>
              </div>
            </div>
            <button className="btn-secondary">Connect</button>
          </div>
        </div>
      </section>


      {/* Save button */}
      <div className="flex justify-end">
        <button className="btn-primary" onClick={handleSave}>
          <Save className="w-4 h-4" />
          Save Settings
        </button>
      </div>
    </div>
  )
}
