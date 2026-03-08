import { QueueEvents } from 'bullmq'
import { processingQueue } from '../src/queue/processingQueue'
import { redisConnection } from '../src/queue/connection'
import { supabase } from '../src/lib/supabase'

async function run() {
    console.log('Starting E2E Pipeline Test...')

    // Clean up existing test jobs
    await processingQueue.obliterate({ force: true })
    console.log('Cleared existing queue.')

    const testVodId = 'test-vod-' + Date.now()
    const jobId = crypto.randomUUID()

    // Note: For a true E2E test, we'll need a real Twitch VOD URL that is accessible,
    // or a mock that bypasses the download stage if we just want to test analysis/extraction.
    // Using a known, short, public test video URL for reliability
    const testVodUrl = 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4'

    console.log(`Creating test job: ${jobId}`)

    // Create job in DB
    const { data, error } = await supabase
        .from('jobs')
        .insert({
            id: jobId,
            user_id: 'test-user-id', // Needs to be a valid UUID in auth.users if FK constraints are on, otherwise just text
            vod_id: testVodId,
            twitch_vod_id: '123456789',
            vod_url: testVodUrl,
            title: 'E2E Test VOD',
            channel_login: 'testchannel',
            vod_duration: 10,
            status: 'queued',
            progress: 0,
            current_step: 'Testing pipeline...',
            clips_found: 0,
            settings: {
                minDuration: 3,
                maxDuration: 10,
                sensitivity: 'high',
                chatAnalysis: false, // Disabling chat analysis for test video
                audioPeaks: true,
                faceReactions: false,
                autoCaptions: true,
                outputFormat: 'vertical',
                splitScreen: false,
            },
        })
        .select()
        .single()

    if (error) {
        if (error.code === '23503') {
            console.warn('Foreign key violation for user_id. You need a valid user in the DB to test this.')
        }
        console.error('Failed to create job in DB:', error)
        process.exit(1)
    }

    console.log('Job created in DB. Adding to BullMQ...')

    // Listen for queue events
    const queueEvents = new QueueEvents('processing-queue', { connection: redisConnection })

    queueEvents.on('completed', ({ jobId: completedJobId, returnvalue }) => {
        if (completedJobId === jobId) {
            console.log('✅ Pipeline completed successfully!')
            console.log('Result:', returnvalue)
            cleanup()
        }
    })

    queueEvents.on('failed', ({ jobId: failedJobId, failedReason }) => {
        if (failedJobId === jobId) {
            console.error('❌ Pipeline failed!')
            console.error('Reason:', failedReason)
            cleanup()
        }
    })

    queueEvents.on('progress', ({ jobId: progressJobId, data }) => {
        if (progressJobId === jobId) {
            console.log(`[Progress] ${data}`)
        }
    })

    await processingQueue.add('process-vod', {
        jobId,
        vodId: testVodId,
        vodUrl: testVodUrl,
        title: 'E2E Test VOD',
        channelLogin: 'testchannel',
        duration: 10,
        settings: data.settings,
    })

    console.log('Job added to queue. Waiting for processing... (Make sure worker is running with `bun run src/queue/worker.ts`)')

    // Timeout after 5 minutes
    setTimeout(() => {
        console.error('❌ Test timed out after 5 minutes.')
        cleanup()
    }, 5 * 60 * 1000)
}

function cleanup() {
    redisConnection.quit()
    process.exit(0)
}

run().catch(console.error)
