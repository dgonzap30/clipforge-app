import { describe, it, expect } from 'bun:test'
import { fetchChatLogs, parseChatLog, analyzeChatLogs, ChatMessage } from './chat'

describe('chat analysis', () => {
  describe('parseChatLog', () => {
    it('should parse chat log lines in standard format', () => {
      const rawLog = `[00:01:30] user1: Hello everyone!
[00:01:45] user2: PogChamp amazing play!
[00:02:00] user3: LETS GO!!!`

      const messages = parseChatLog(rawLog)

      expect(messages).toHaveLength(3)
      expect(messages[0]).toEqual({
        timestamp: 90, // 1:30
        username: 'user1',
        message: 'Hello everyone!',
      })
      expect(messages[1]).toEqual({
        timestamp: 105, // 1:45
        username: 'user2',
        message: 'PogChamp amazing play!',
      })
      expect(messages[2]).toEqual({
        timestamp: 120, // 2:00
        username: 'user3',
        message: 'LETS GO!!!',
      })
    })

    it('should handle empty input', () => {
      const messages = parseChatLog('')
      expect(messages).toHaveLength(0)
    })

    it('should skip invalid lines', () => {
      const rawLog = `[00:01:30] user1: Valid message
invalid line without timestamp
[00:02:00] user2: Another valid message`

      const messages = parseChatLog(rawLog)
      expect(messages).toHaveLength(2)
    })

    it('should handle hours in timestamp', () => {
      const rawLog = `[01:30:45] user1: After an hour`
      const messages = parseChatLog(rawLog)

      expect(messages[0].timestamp).toBe(5445) // 1*3600 + 30*60 + 45
    })
  })

  describe('analyzeChatLogs', () => {
    it('should return empty array for no messages', () => {
      const moments = analyzeChatLogs([])
      expect(moments).toHaveLength(0)
    })

    it('should detect moments with high message velocity', () => {
      const messages: ChatMessage[] = []
      // Create messages spanning 15 seconds with high velocity
      for (let i = 0; i < 150; i++) {
        messages.push({
          timestamp: 100 + i * 0.1, // 10 messages per second
          username: `user${i}`,
          message: 'PogChamp Wow!',
        })
      }

      const moments = analyzeChatLogs(messages)

      expect(moments.length).toBeGreaterThan(0)
      if (moments.length > 0) {
        expect(moments[0].velocity).toBeGreaterThan(5) // High velocity
        expect(moments[0].hydeScore).toBeGreaterThan(50) // Should have high score
      }
    })

    it('should detect moments with hype emotes', () => {
      const messages: ChatMessage[] = []
      // Create messages with multiple hype emotes spanning 15 seconds
      for (let i = 0; i < 90; i++) {
        messages.push({
          timestamp: 100 + i * 0.17,
          username: `user${i}`,
          message: 'PogChamp POGGERS HYPERS!',
        })
      }

      const moments = analyzeChatLogs(messages)

      expect(moments.length).toBeGreaterThan(0)
      if (moments.length > 0) {
        expect(moments[0].emoteScore).toBeGreaterThan(1) // Multiple emotes per message
      }
    })

    it('should give higher scores for caps messages', () => {
      const messages: ChatMessage[] = []
      // Create concentrated burst with CAPS and emotes spanning 15 seconds
      for (let i = 0; i < 110; i++) {
        messages.push({
          timestamp: 100 + i * 0.14,
          username: `user${i}`,
          message: 'INSANE PLAY POGGERS!!!',
        })
      }

      const moments = analyzeChatLogs(messages)

      expect(moments.length).toBeGreaterThan(0)
      if (moments.length > 0) {
        expect(moments[0].hydeScore).toBeGreaterThan(50) // High score from caps + emotes + velocity
      }
    })

    it('should merge overlapping moments', () => {
      const messages: ChatMessage[] = []
      // Create two bursts close together
      for (let i = 0; i < 15; i++) {
        messages.push({
          timestamp: 100 + i * 0.5,
          username: `user${i}`,
          message: 'PogChamp',
        })
      }
      for (let i = 0; i < 15; i++) {
        messages.push({
          timestamp: 105 + i * 0.5,
          username: `user${i + 15}`,
          message: 'POGGERS',
        })
      }

      const moments = analyzeChatLogs(messages)

      // Should merge into fewer moments due to overlap
      expect(moments.length).toBeLessThan(10)
    })

    it('should respect custom config', () => {
      const messages: ChatMessage[] = []
      for (let i = 0; i < 20; i++) {
        messages.push({
          timestamp: 100 + i,
          username: `user${i}`,
          message: 'Test',
        })
      }

      const moments = analyzeChatLogs(messages, {
        windowSize: 5,
        minVelocity: 10,
      })

      // With minVelocity of 10, fewer moments should be detected
      expect(moments.length).toBeLessThanOrEqual(5)
    })
  })

  describe('fetchChatLogs', () => {
    it('should return empty array on 404', async () => {
      // Test with a non-existent VOD ID
      const messages = await fetchChatLogs('nonexistent123')
      expect(messages).toEqual([])
    })

    it('should handle network errors gracefully', async () => {
      // Test with invalid VOD ID that will cause an error
      const messages = await fetchChatLogs('')
      expect(messages).toEqual([])
    })

    // Note: We can't easily test the successful case without mocking or using a real VOD
    // In a real test suite, you would use a mocking library like bun:test's mock functions
  })
})
