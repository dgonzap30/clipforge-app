/**
 * Tests for JobCard component
 *
 * Note: These tests require a test framework like Vitest or Jest to be set up.
 * To run these tests, add testing dependencies:
 *
 * bun add -d vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
 *
 * Then add to package.json:
 * "scripts": {
 *   "test": "vitest",
 *   "test:ui": "vitest --ui"
 * }
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JobCard } from './JobCard'
import { ProcessingJob } from '@/lib/api'

const mockJob: ProcessingJob = {
  id: 'test-job-1',
  vodId: 'vod-123',
  vodUrl: 'https://twitch.tv/videos/123',
  title: 'Test Stream VOD',
  channelLogin: 'testchannel',
  duration: 7200, // 2 hours
  status: 'analyzing',
  progress: 45,
  currentStep: 'Analyzing chat logs',
  clipsFound: 3,
  clipIds: ['clip1', 'clip2', 'clip3'],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:15:00Z',
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
}

describe('JobCard', () => {
  it('renders job information correctly', () => {
    render(<JobCard job={mockJob} />)

    expect(screen.getByText('Test Stream VOD')).toBeInTheDocument()
    expect(screen.getByText(/testchannel/)).toBeInTheDocument()
    expect(screen.getByText(/2:00:00/)).toBeInTheDocument() // Duration format
  })

  it('displays correct status for analyzing job', () => {
    render(<JobCard job={mockJob} />)

    expect(screen.getByText(/Analyzing/)).toBeInTheDocument()
    expect(screen.getByText(/Analyzing chat logs/)).toBeInTheDocument()
  })

  it('shows progress bar for processing jobs', () => {
    render(<JobCard job={mockJob} />)

    expect(screen.getByText('45%')).toBeInTheDocument()
    expect(screen.getByText('Processing...')).toBeInTheDocument()
  })

  it('displays clips found count during processing', () => {
    render(<JobCard job={mockJob} />)

    expect(screen.getByText('3 potential clips found')).toBeInTheDocument()
  })

  it('shows cancel button for processing jobs', () => {
    const onCancel = vi.fn()
    render(<JobCard job={mockJob} onCancel={onCancel} />)

    const cancelButton = screen.getByTitle('Cancel job')
    expect(cancelButton).toBeInTheDocument()
  })

  it('calls onCancel when cancel button is clicked', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(<JobCard job={mockJob} onCancel={onCancel} />)

    const cancelButton = screen.getByTitle('Cancel job')
    await user.click(cancelButton)

    expect(onCancel).toHaveBeenCalledWith('test-job-1')
  })

  it('shows retry button for failed jobs', () => {
    const failedJob = { ...mockJob, status: 'failed' as const, error: 'Network error' }
    const onRetry = vi.fn()
    render(<JobCard job={failedJob} onRetry={onRetry} />)

    const retryButton = screen.getByTitle('Retry job')
    expect(retryButton).toBeInTheDocument()
  })

  it('calls onRetry when retry button is clicked', async () => {
    const failedJob = { ...mockJob, status: 'failed' as const, error: 'Network error' }
    const onRetry = vi.fn()
    const user = userEvent.setup()
    render(<JobCard job={failedJob} onRetry={onRetry} />)

    const retryButton = screen.getByTitle('Retry job')
    await user.click(retryButton)

    expect(onRetry).toHaveBeenCalledWith('test-job-1')
  })

  it('displays error message for failed jobs', () => {
    const failedJob = { ...mockJob, status: 'failed' as const, error: 'Network error' }
    render(<JobCard job={failedJob} />)

    expect(screen.getByText(/Network error/)).toBeInTheDocument()
  })

  it('shows completed status with clips found', () => {
    const completedJob = {
      ...mockJob,
      status: 'completed' as const,
      progress: 100,
      clipsFound: 5,
    }
    render(<JobCard job={completedJob} />)

    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getByText('5 clips found')).toBeInTheDocument()
  })

  it('handles singular clip count correctly', () => {
    const completedJob = {
      ...mockJob,
      status: 'completed' as const,
      progress: 100,
      clipsFound: 1,
    }
    render(<JobCard job={completedJob} />)

    expect(screen.getByText('1 clip found')).toBeInTheDocument()
  })

  it('does not show progress bar for completed jobs', () => {
    const completedJob = {
      ...mockJob,
      status: 'completed' as const,
      progress: 100,
    }
    render(<JobCard job={completedJob} />)

    expect(screen.queryByText('Processing...')).not.toBeInTheDocument()
  })

  it('does not show cancel button for completed jobs', () => {
    const completedJob = {
      ...mockJob,
      status: 'completed' as const,
      progress: 100,
    }
    const onCancel = vi.fn()
    render(<JobCard job={completedJob} onCancel={onCancel} />)

    expect(screen.queryByTitle('Cancel job')).not.toBeInTheDocument()
  })

  it('shows delete button when onDelete is provided', () => {
    const onDelete = vi.fn()
    render(<JobCard job={mockJob} onDelete={onDelete} />)

    const deleteButton = screen.getByTitle('Delete job')
    expect(deleteButton).toBeInTheDocument()
  })

  it('calls onDelete when delete button is clicked', async () => {
    const onDelete = vi.fn()
    const user = userEvent.setup()
    render(<JobCard job={mockJob} onDelete={onDelete} />)

    const deleteButton = screen.getByTitle('Delete job')
    await user.click(deleteButton)

    expect(onDelete).toHaveBeenCalledWith('test-job-1')
  })

  it('renders VOD link with correct href', () => {
    render(<JobCard job={mockJob} />)

    const link = screen.getByTitle('Open VOD')
    expect(link).toHaveAttribute('href', 'https://twitch.tv/videos/123')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('shows queued status correctly', () => {
    const queuedJob = { ...mockJob, status: 'queued' as const, progress: 0 }
    render(<JobCard job={queuedJob} />)

    expect(screen.getByText('Queued')).toBeInTheDocument()
    expect(screen.getByText('Waiting in queue...')).toBeInTheDocument()
  })

  it('formats duration correctly for short videos', () => {
    const shortJob = { ...mockJob, duration: 125 } // 2:05
    render(<JobCard job={shortJob} />)

    expect(screen.getByText(/2:05/)).toBeInTheDocument()
  })

  it('formats duration correctly for long videos', () => {
    const longJob = { ...mockJob, duration: 12665 } // 3:31:05
    render(<JobCard job={longJob} />)

    expect(screen.getByText(/3:31:05/)).toBeInTheDocument()
  })

  it('shows different status icons for different states', () => {
    const { rerender } = render(<JobCard job={mockJob} />)

    // Processing job should show spinner
    expect(screen.getByText('Analyzing')).toBeInTheDocument()

    // Completed job should show check icon
    const completedJob = { ...mockJob, status: 'completed' as const }
    rerender(<JobCard job={completedJob} />)
    expect(screen.getByText('Completed')).toBeInTheDocument()

    // Failed job should show alert icon
    const failedJob = { ...mockJob, status: 'failed' as const }
    rerender(<JobCard job={failedJob} />)
    expect(screen.getByText('Failed')).toBeInTheDocument()
  })
})
