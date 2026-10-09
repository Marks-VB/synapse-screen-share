import { describe, it, expect } from 'vitest';
import { parseWebRTCStats } from '../src/utils/statsParser';

describe('parseWebRTCStats', () => {
  it('returns default zeroed metrics for empty stats report', () => {
    const stats = new Map();
    const result = parseWebRTCStats(stats);

    expect(result.metrics).toEqual({
      resolution: '0x0',
      fps: 0,
      bitrateMbps: '0.00',
      rttMs: null,
      packetLossPct: 0
    });
    expect(result.nextState).toBeDefined();
  });

  it('calculates outbound video resolution, fps, and bitrate', () => {
    const prevState = {
      timestamp: performance.now() - 1000,
      bytesSent: 1000000
    };

    const mockStats = [
      {
        type: 'outbound-rtp',
        kind: 'video',
        frameWidth: 1920,
        frameHeight: 1080,
        framesPerSecond: 60,
        bytesSent: 2000000 // 1MB sent in ~1 sec = ~8 Mbps
      }
    ];

    const { metrics, nextState } = parseWebRTCStats(mockStats, prevState);

    expect(metrics.resolution).toBe('1920x1080');
    expect(metrics.fps).toBe(60);
    expect(parseFloat(metrics.bitrateMbps)).toBeGreaterThan(0);
    expect(nextState.bytesSent).toBe(2000000);
  });

  it('calculates inbound video packet loss percentage correctly', () => {
    const prevState = {
      timestamp: performance.now() - 1000,
      packetsLost: 10,
      packetsReceived: 90
    };

    const mockStats = [
      {
        type: 'inbound-rtp',
        kind: 'video',
        frameWidth: 1280,
        frameHeight: 720,
        framesPerSecond: 30,
        bytesReceived: 500000,
        packetsLost: 15, // +5 lost
        packetsReceived: 185 // +95 received => 5 / 100 = 5%
      }
    ];

    const { metrics } = parseWebRTCStats(mockStats, prevState);

    expect(metrics.resolution).toBe('1280x720');
    expect(metrics.fps).toBe(30);
    expect(metrics.packetLossPct).toBe(5);
  });

  it('extracts round trip time (RTT) from candidate-pair report', () => {
    const mockStats = [
      {
        type: 'candidate-pair',
        state: 'succeeded',
        currentRoundTripTime: 0.024 // 24 ms
      }
    ];

    const { metrics } = parseWebRTCStats(mockStats);
    expect(metrics.rttMs).toBe(24);
  });
});
