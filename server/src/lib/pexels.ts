/**
 * Pexels API Client
 *
 * Fetch free stock footage from Pexels for B-roll insertion.
 */

export interface PexelsVideo {
  id: number
  url: string
  width: number
  height: number
  duration: number
  videoFiles: PexelsVideoFile[]
  image: string // Preview image
}

export interface PexelsVideoFile {
  id: number
  quality: string
  fileType: string
  width: number
  height: number
  link: string
}

export interface PexelsSearchResult {
  videos: PexelsVideo[]
  totalResults: number
  page: number
  perPage: number
}

export interface PexelsConfig {
  apiKey: string
  perPage?: number
  orientation?: 'landscape' | 'portrait' | 'square'
  size?: 'large' | 'medium' | 'small'
}

/**
 * Search for videos on Pexels
 */
export async function searchPexelsVideos(
  query: string,
  config: PexelsConfig
): Promise<PexelsSearchResult> {
  const { apiKey, perPage = 5, orientation = 'landscape', size = 'medium' } = config

  const params = new URLSearchParams({
    query,
    per_page: String(perPage),
    orientation,
    size,
  })

  const response = await fetch(
    `https://api.pexels.com/videos/search?${params.toString()}`,
    {
      headers: {
        Authorization: apiKey,
      },
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Pexels API error: ${error}`)
  }

  const result = await response.json()

  return {
    videos: result.videos || [],
    totalResults: result.total_results || 0,
    page: result.page || 1,
    perPage: result.per_page || perPage,
  }
}

/**
 * Download video from Pexels URL
 */
export async function downloadPexelsVideo(
  videoUrl: string,
  outputPath: string
): Promise<void> {
  const response = await fetch(videoUrl)

  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.statusText}`)
  }

  const buffer = await response.arrayBuffer()
  await Bun.write(outputPath, buffer)
}

/**
 * Get best quality video file for given dimensions
 */
export function getBestVideoFile(
  video: PexelsVideo,
  preferredWidth: number = 1920,
  preferredHeight: number = 1080
): PexelsVideoFile | null {
  if (!video.videoFiles || video.videoFiles.length === 0) {
    return null
  }

  // Filter for MP4 files
  const mp4Files = video.videoFiles.filter(f => f.fileType === 'video/mp4')

  if (mp4Files.length === 0) {
    return null
  }

  // Sort by closeness to preferred dimensions
  const sorted = mp4Files.sort((a, b) => {
    const aDiff = Math.abs(a.width - preferredWidth) + Math.abs(a.height - preferredHeight)
    const bDiff = Math.abs(b.width - preferredWidth) + Math.abs(b.height - preferredHeight)
    return aDiff - bDiff
  })

  return sorted[0]
}

/**
 * Find B-roll video for a search query
 */
export async function findBRollVideo(
  searchQuery: string,
  apiKey: string,
  options?: {
    orientation?: 'landscape' | 'portrait' | 'square'
    minDuration?: number
  }
): Promise<{ video: PexelsVideo; downloadUrl: string } | null> {
  const { orientation = 'landscape', minDuration = 5 } = options || {}

  const result = await searchPexelsVideos(searchQuery, {
    apiKey,
    perPage: 10,
    orientation,
  })

  if (result.videos.length === 0) {
    return null
  }

  // Find first video that meets duration requirement
  const suitableVideo = result.videos.find(v => v.duration >= minDuration)

  if (!suitableVideo) {
    // Fall back to any video
    const video = result.videos[0]
    const videoFile = getBestVideoFile(video)

    if (!videoFile) {
      return null
    }

    return {
      video,
      downloadUrl: videoFile.link,
    }
  }

  const videoFile = getBestVideoFile(suitableVideo)

  if (!videoFile) {
    return null
  }

  return {
    video: suitableVideo,
    downloadUrl: videoFile.link,
  }
}
