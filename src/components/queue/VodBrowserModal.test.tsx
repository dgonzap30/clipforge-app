/**
 * VodBrowserModal Component Tests
 *
 * Note: This test file is a placeholder until a testing framework (e.g., Vitest, Jest)
 * is configured in the project. Once a testing framework is set up, these tests
 * can be properly executed.
 *
 * To set up testing, add the following dependencies:
 * - vitest
 * - @testing-library/react
 * - @testing-library/jest-dom
 * - @testing-library/user-event
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VodBrowserModal } from './VodBrowserModal'
import * as api from '@/lib/api'

// Mock the API module
vi.mock('@/lib/api', () => ({
  api: {
    vods: {
      getByChannel: vi.fn(),
    },
    jobs: {
      create: vi.fn(),
    },
  },
}))

describe('VodBrowserModal', () => {
  const mockOnClose = vi.fn()
  const mockOnJobCreated = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      const { container } = render(
        <VodBrowserModal
          isOpen={false}
          onClose={mockOnClose}
          onJobCreated={mockOnJobCreated}
        />
      )
      expect(container.firstChild).toBeNull()
    })

    it('should render modal when isOpen is true', () => {
      render(
        <VodBrowserModal
          isOpen={true}
          onClose={mockOnClose}
          onJobCreated={mockOnJobCreated}
        />
      )
      expect(screen.getByText('Add VOD to Queue')).toBeInTheDocument()
    })

    it('should display all three steps', () => {
      render(
        <VodBrowserModal
          isOpen={true}
          onClose={mockOnClose}
          onJobCreated={mockOnJobCreated}
        />
      )
      expect(screen.getByText('1. Search Twitch Channel')).toBeInTheDocument()
    })
  })

  describe('Channel Search', () => {
    it('should allow user to enter channel name', async () => {
      const user = userEvent.setup()
      render(
        <VodBrowserModal
          isOpen={true}
          onClose={mockOnClose}
          onJobCreated={mockOnJobCreated}
        />
      )

      const input = screen.getByPlaceholderText(/enter channel name/i)
      await user.type(input, 'shroud')
      expect(input).toHaveValue('shroud')
    })

    it('should show error when searching empty channel name', async () => {
      const user = userEvent.setup()
      render(
        <VodBrowserModal
          isOpen={true}
          onClose={mockOnClose}
          onJobCreated={mockOnJobCreated}
        />
      )

      const searchButton = screen.getByRole('button', { name: /search/i })
      await user.click(searchButton)
      expect(screen.getByText('Please enter a channel name')).toBeInTheDocument()
    })

    it('should call API when searching for a channel', async () => {
      const user = userEvent.setup()
      const mockResponse = {
        channel: {
          id: '1',
          login: 'shroud',
          displayName: 'Shroud',
          profileImageUrl: 'https://example.com/avatar.jpg',
        },
        vods: [],
        pagination: {},
      }

      vi.mocked(api.api.vods.getByChannel).mockResolvedValue(mockResponse)

      render(
        <VodBrowserModal
          isOpen={true}
          onClose={mockOnClose}
          onJobCreated={mockOnJobCreated}
        />
      )

      const input = screen.getByPlaceholderText(/enter channel name/i)
      await user.type(input, 'shroud')

      const searchButton = screen.getByRole('button', { name: /search/i })
      await user.click(searchButton)

      await waitFor(() => {
        expect(api.api.vods.getByChannel).toHaveBeenCalledWith('shroud')
      })
    })

    it('should display channel info after successful search', async () => {
      const user = userEvent.setup()
      const mockResponse = {
        channel: {
          id: '1',
          login: 'shroud',
          displayName: 'Shroud',
          profileImageUrl: 'https://example.com/avatar.jpg',
        },
        vods: [],
        pagination: {},
      }

      vi.mocked(api.api.vods.getByChannel).mockResolvedValue(mockResponse)

      render(
        <VodBrowserModal
          isOpen={true}
          onClose={mockOnClose}
          onJobCreated={mockOnJobCreated}
        />
      )

      const input = screen.getByPlaceholderText(/enter channel name/i)
      await user.type(input, 'shroud')

      const searchButton = screen.getByRole('button', { name: /search/i })
      await user.click(searchButton)

      await waitFor(() => {
        expect(screen.getByText('Shroud')).toBeInTheDocument()
        expect(screen.getByText('@shroud')).toBeInTheDocument()
      })
    })

    it('should display error message on API failure', async () => {
      const user = userEvent.setup()
      vi.mocked(api.api.vods.getByChannel).mockRejectedValue(
        new Error('Channel not found')
      )

      render(
        <VodBrowserModal
          isOpen={true}
          onClose={mockOnClose}
          onJobCreated={mockOnJobCreated}
        />
      )

      const input = screen.getByPlaceholderText(/enter channel name/i)
      await user.type(input, 'invalidchannel')

      const searchButton = screen.getByRole('button', { name: /search/i })
      await user.click(searchButton)

      await waitFor(() => {
        expect(screen.getByText('Channel not found')).toBeInTheDocument()
      })
    })
  })

  describe('VOD Selection', () => {
    it('should display VODs after successful channel search', async () => {
      const user = userEvent.setup()
      const mockVods = [
        {
          id: '123',
          title: 'Epic Gaming Stream',
          duration: 7200,
          durationFormatted: '2:00:00',
          thumbnailUrl: 'https://example.com/thumb.jpg',
          url: 'https://twitch.tv/videos/123',
          viewCount: 1000,
          createdAt: '2024-01-01T00:00:00Z',
          streamId: null,
        },
      ]

      const mockResponse = {
        channel: {
          id: '1',
          login: 'shroud',
          displayName: 'Shroud',
          profileImageUrl: 'https://example.com/avatar.jpg',
        },
        vods: mockVods,
        pagination: {},
      }

      vi.mocked(api.api.vods.getByChannel).mockResolvedValue(mockResponse)

      render(
        <VodBrowserModal
          isOpen={true}
          onClose={mockOnClose}
          onJobCreated={mockOnJobCreated}
        />
      )

      const input = screen.getByPlaceholderText(/enter channel name/i)
      await user.type(input, 'shroud')

      const searchButton = screen.getByRole('button', { name: /search/i })
      await user.click(searchButton)

      await waitFor(() => {
        expect(screen.getByText('2. Select a VOD')).toBeInTheDocument()
        expect(screen.getByText('Epic Gaming Stream')).toBeInTheDocument()
      })
    })

    it('should highlight selected VOD', async () => {
      const user = userEvent.setup()
      const mockVods = [
        {
          id: '123',
          title: 'Epic Gaming Stream',
          duration: 7200,
          durationFormatted: '2:00:00',
          thumbnailUrl: 'https://example.com/thumb.jpg',
          url: 'https://twitch.tv/videos/123',
          viewCount: 1000,
          createdAt: '2024-01-01T00:00:00Z',
          streamId: null,
        },
      ]

      const mockResponse = {
        channel: {
          id: '1',
          login: 'shroud',
          displayName: 'Shroud',
          profileImageUrl: 'https://example.com/avatar.jpg',
        },
        vods: mockVods,
        pagination: {},
      }

      vi.mocked(api.api.vods.getByChannel).mockResolvedValue(mockResponse)

      render(
        <VodBrowserModal
          isOpen={true}
          onClose={mockOnClose}
          onJobCreated={mockOnJobCreated}
        />
      )

      const input = screen.getByPlaceholderText(/enter channel name/i)
      await user.type(input, 'shroud')

      const searchButton = screen.getByRole('button', { name: /search/i })
      await user.click(searchButton)

      await waitFor(() => {
        expect(screen.getByText('Epic Gaming Stream')).toBeInTheDocument()
      })

      const vodButton = screen.getByText('Epic Gaming Stream').closest('button')!
      await user.click(vodButton)

      expect(vodButton).toHaveClass('border-forge-500')
    })

    it('should show processing settings after VOD selection', async () => {
      const user = userEvent.setup()
      const mockVods = [
        {
          id: '123',
          title: 'Epic Gaming Stream',
          duration: 7200,
          durationFormatted: '2:00:00',
          thumbnailUrl: 'https://example.com/thumb.jpg',
          url: 'https://twitch.tv/videos/123',
          viewCount: 1000,
          createdAt: '2024-01-01T00:00:00Z',
          streamId: null,
        },
      ]

      const mockResponse = {
        channel: {
          id: '1',
          login: 'shroud',
          displayName: 'Shroud',
          profileImageUrl: 'https://example.com/avatar.jpg',
        },
        vods: mockVods,
        pagination: {},
      }

      vi.mocked(api.api.vods.getByChannel).mockResolvedValue(mockResponse)

      render(
        <VodBrowserModal
          isOpen={true}
          onClose={mockOnClose}
          onJobCreated={mockOnJobCreated}
        />
      )

      const input = screen.getByPlaceholderText(/enter channel name/i)
      await user.type(input, 'shroud')

      const searchButton = screen.getByRole('button', { name: /search/i })
      await user.click(searchButton)

      await waitFor(() => {
        expect(screen.getByText('Epic Gaming Stream')).toBeInTheDocument()
      })

      const vodButton = screen.getByText('Epic Gaming Stream').closest('button')!
      await user.click(vodButton)

      expect(screen.getByText('3. Configure Processing Settings')).toBeInTheDocument()
    })
  })

  describe('Processing Settings', () => {
    it('should have default settings values', async () => {
      const user = userEvent.setup()
      const mockVods = [
        {
          id: '123',
          title: 'Epic Gaming Stream',
          duration: 7200,
          durationFormatted: '2:00:00',
          thumbnailUrl: 'https://example.com/thumb.jpg',
          url: 'https://twitch.tv/videos/123',
          viewCount: 1000,
          createdAt: '2024-01-01T00:00:00Z',
          streamId: null,
        },
      ]

      const mockResponse = {
        channel: {
          id: '1',
          login: 'shroud',
          displayName: 'Shroud',
          profileImageUrl: 'https://example.com/avatar.jpg',
        },
        vods: mockVods,
        pagination: {},
      }

      vi.mocked(api.api.vods.getByChannel).mockResolvedValue(mockResponse)

      render(
        <VodBrowserModal
          isOpen={true}
          onClose={mockOnClose}
          onJobCreated={mockOnJobCreated}
        />
      )

      const input = screen.getByPlaceholderText(/enter channel name/i)
      await user.type(input, 'shroud')

      const searchButton = screen.getByRole('button', { name: /search/i })
      await user.click(searchButton)

      await waitFor(() => {
        expect(screen.getByText('Epic Gaming Stream')).toBeInTheDocument()
      })

      const vodButton = screen.getByText('Epic Gaming Stream').closest('button')!
      await user.click(vodButton)

      // Check default values
      const minDurationInput = screen.getByLabelText(/min \(seconds\)/i) as HTMLInputElement
      const maxDurationInput = screen.getByLabelText(/max \(seconds\)/i) as HTMLInputElement

      expect(minDurationInput.value).toBe('15')
      expect(maxDurationInput.value).toBe('60')

      const chatAnalysisCheckbox = screen.getByLabelText(/chat analysis/i) as HTMLInputElement
      expect(chatAnalysisCheckbox.checked).toBe(true)
    })

    it('should allow changing settings values', async () => {
      const user = userEvent.setup()
      const mockVods = [
        {
          id: '123',
          title: 'Epic Gaming Stream',
          duration: 7200,
          durationFormatted: '2:00:00',
          thumbnailUrl: 'https://example.com/thumb.jpg',
          url: 'https://twitch.tv/videos/123',
          viewCount: 1000,
          createdAt: '2024-01-01T00:00:00Z',
          streamId: null,
        },
      ]

      const mockResponse = {
        channel: {
          id: '1',
          login: 'shroud',
          displayName: 'Shroud',
          profileImageUrl: 'https://example.com/avatar.jpg',
        },
        vods: mockVods,
        pagination: {},
      }

      vi.mocked(api.api.vods.getByChannel).mockResolvedValue(mockResponse)

      render(
        <VodBrowserModal
          isOpen={true}
          onClose={mockOnClose}
          onJobCreated={mockOnJobCreated}
        />
      )

      const input = screen.getByPlaceholderText(/enter channel name/i)
      await user.type(input, 'shroud')

      const searchButton = screen.getByRole('button', { name: /search/i })
      await user.click(searchButton)

      await waitFor(() => {
        expect(screen.getByText('Epic Gaming Stream')).toBeInTheDocument()
      })

      const vodButton = screen.getByText('Epic Gaming Stream').closest('button')!
      await user.click(vodButton)

      const minDurationInput = screen.getByLabelText(/min \(seconds\)/i)
      await user.clear(minDurationInput)
      await user.type(minDurationInput, '30')
      expect(minDurationInput).toHaveValue(30)
    })
  })

  describe('Job Submission', () => {
    it('should disable submit button when no VOD selected', () => {
      render(
        <VodBrowserModal
          isOpen={true}
          onClose={mockOnClose}
          onJobCreated={mockOnJobCreated}
        />
      )

      const submitButton = screen.getByRole('button', { name: /add to queue/i })
      expect(submitButton).toBeDisabled()
    })

    it('should submit job with correct data', async () => {
      const user = userEvent.setup()
      const mockVods = [
        {
          id: '123',
          title: 'Epic Gaming Stream',
          duration: 7200,
          durationFormatted: '2:00:00',
          thumbnailUrl: 'https://example.com/thumb.jpg',
          url: 'https://twitch.tv/videos/123',
          viewCount: 1000,
          createdAt: '2024-01-01T00:00:00Z',
          streamId: null,
        },
      ]

      const mockResponse = {
        channel: {
          id: '1',
          login: 'shroud',
          displayName: 'Shroud',
          profileImageUrl: 'https://example.com/avatar.jpg',
        },
        vods: mockVods,
        pagination: {},
      }

      const mockJob = {
        id: 'job-1',
        vodId: '123',
        vodUrl: 'https://twitch.tv/videos/123',
        title: 'Epic Gaming Stream',
        channelLogin: 'shroud',
        duration: 7200,
        status: 'queued' as const,
        progress: 0,
        currentStep: 'Waiting to start',
        clipsFound: 0,
        clipIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        settings: {
          minDuration: 15,
          maxDuration: 60,
          sensitivity: 'medium' as const,
          chatAnalysis: true,
          audioPeaks: true,
          faceReactions: true,
          autoCaptions: true,
          outputFormat: 'vertical' as const,
        },
      }

      vi.mocked(api.api.vods.getByChannel).mockResolvedValue(mockResponse)
      vi.mocked(api.api.jobs.create).mockResolvedValue(mockJob)

      render(
        <VodBrowserModal
          isOpen={true}
          onClose={mockOnClose}
          onJobCreated={mockOnJobCreated}
        />
      )

      const input = screen.getByPlaceholderText(/enter channel name/i)
      await user.type(input, 'shroud')

      const searchButton = screen.getByRole('button', { name: /search/i })
      await user.click(searchButton)

      await waitFor(() => {
        expect(screen.getByText('Epic Gaming Stream')).toBeInTheDocument()
      })

      const vodButton = screen.getByText('Epic Gaming Stream').closest('button')!
      await user.click(vodButton)

      const submitButton = screen.getByRole('button', { name: /add to queue/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(api.api.jobs.create).toHaveBeenCalledWith({
          vodId: '123',
          vodUrl: 'https://twitch.tv/videos/123',
          title: 'Epic Gaming Stream',
          channelLogin: 'shroud',
          duration: 7200,
          settings: {
            minDuration: 15,
            maxDuration: 60,
            sensitivity: 'medium',
            chatAnalysis: true,
            audioPeaks: true,
            faceReactions: true,
            autoCaptions: true,
            outputFormat: 'vertical',
          },
        })
      })
    })

    it('should call onJobCreated and onClose on successful submission', async () => {
      const user = userEvent.setup()
      const mockVods = [
        {
          id: '123',
          title: 'Epic Gaming Stream',
          duration: 7200,
          durationFormatted: '2:00:00',
          thumbnailUrl: 'https://example.com/thumb.jpg',
          url: 'https://twitch.tv/videos/123',
          viewCount: 1000,
          createdAt: '2024-01-01T00:00:00Z',
          streamId: null,
        },
      ]

      const mockResponse = {
        channel: {
          id: '1',
          login: 'shroud',
          displayName: 'Shroud',
          profileImageUrl: 'https://example.com/avatar.jpg',
        },
        vods: mockVods,
        pagination: {},
      }

      const mockJob = {
        id: 'job-1',
        vodId: '123',
        vodUrl: 'https://twitch.tv/videos/123',
        title: 'Epic Gaming Stream',
        channelLogin: 'shroud',
        duration: 7200,
        status: 'queued' as const,
        progress: 0,
        currentStep: 'Waiting to start',
        clipsFound: 0,
        clipIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        settings: {
          minDuration: 15,
          maxDuration: 60,
          sensitivity: 'medium' as const,
          chatAnalysis: true,
          audioPeaks: true,
          faceReactions: true,
          autoCaptions: true,
          outputFormat: 'vertical' as const,
        },
      }

      vi.mocked(api.api.vods.getByChannel).mockResolvedValue(mockResponse)
      vi.mocked(api.api.jobs.create).mockResolvedValue(mockJob)

      render(
        <VodBrowserModal
          isOpen={true}
          onClose={mockOnClose}
          onJobCreated={mockOnJobCreated}
        />
      )

      const input = screen.getByPlaceholderText(/enter channel name/i)
      await user.type(input, 'shroud')

      const searchButton = screen.getByRole('button', { name: /search/i })
      await user.click(searchButton)

      await waitFor(() => {
        expect(screen.getByText('Epic Gaming Stream')).toBeInTheDocument()
      })

      const vodButton = screen.getByText('Epic Gaming Stream').closest('button')!
      await user.click(vodButton)

      const submitButton = screen.getByRole('button', { name: /add to queue/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockOnJobCreated).toHaveBeenCalledWith(mockJob)
        expect(mockOnClose).toHaveBeenCalled()
      })
    })

    it('should display error message on submission failure', async () => {
      const user = userEvent.setup()
      const mockVods = [
        {
          id: '123',
          title: 'Epic Gaming Stream',
          duration: 7200,
          durationFormatted: '2:00:00',
          thumbnailUrl: 'https://example.com/thumb.jpg',
          url: 'https://twitch.tv/videos/123',
          viewCount: 1000,
          createdAt: '2024-01-01T00:00:00Z',
          streamId: null,
        },
      ]

      const mockResponse = {
        channel: {
          id: '1',
          login: 'shroud',
          displayName: 'Shroud',
          profileImageUrl: 'https://example.com/avatar.jpg',
        },
        vods: mockVods,
        pagination: {},
      }

      vi.mocked(api.api.vods.getByChannel).mockResolvedValue(mockResponse)
      vi.mocked(api.api.jobs.create).mockRejectedValue(
        new Error('Failed to create job')
      )

      render(
        <VodBrowserModal
          isOpen={true}
          onClose={mockOnClose}
          onJobCreated={mockOnJobCreated}
        />
      )

      const input = screen.getByPlaceholderText(/enter channel name/i)
      await user.type(input, 'shroud')

      const searchButton = screen.getByRole('button', { name: /search/i })
      await user.click(searchButton)

      await waitFor(() => {
        expect(screen.getByText('Epic Gaming Stream')).toBeInTheDocument()
      })

      const vodButton = screen.getByText('Epic Gaming Stream').closest('button')!
      await user.click(vodButton)

      const submitButton = screen.getByRole('button', { name: /add to queue/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Failed to create job')).toBeInTheDocument()
      })
    })
  })

  describe('Modal Controls', () => {
    it('should call onClose when close button is clicked', async () => {
      const user = userEvent.setup()
      render(
        <VodBrowserModal
          isOpen={true}
          onClose={mockOnClose}
          onJobCreated={mockOnJobCreated}
        />
      )

      const closeButton = screen.getAllByRole('button').find((btn) =>
        btn.querySelector('svg')?.classList.contains('lucide-x')
      )!
      await user.click(closeButton)

      expect(mockOnClose).toHaveBeenCalled()
    })

    it('should call onClose when cancel button is clicked', async () => {
      const user = userEvent.setup()
      render(
        <VodBrowserModal
          isOpen={true}
          onClose={mockOnClose}
          onJobCreated={mockOnJobCreated}
        />
      )

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      expect(mockOnClose).toHaveBeenCalled()
    })

    it('should reset state when modal is closed and reopened', async () => {
      const { rerender } = render(
        <VodBrowserModal
          isOpen={true}
          onClose={mockOnClose}
          onJobCreated={mockOnJobCreated}
        />
      )

      const input = screen.getByPlaceholderText(/enter channel name/i)
      fireEvent.change(input, { target: { value: 'shroud' } })

      rerender(
        <VodBrowserModal
          isOpen={false}
          onClose={mockOnClose}
          onJobCreated={mockOnJobCreated}
        />
      )

      rerender(
        <VodBrowserModal
          isOpen={true}
          onClose={mockOnClose}
          onJobCreated={mockOnJobCreated}
        />
      )

      const inputAfterReopen = screen.getByPlaceholderText(/enter channel name/i)
      expect(inputAfterReopen).toHaveValue('')
    })
  })
})
