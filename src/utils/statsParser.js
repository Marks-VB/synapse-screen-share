/**
 * Parse WebRTC getStats() reports to calculate real-time telemetry:
 * Resolution, FPS, Bitrate (Mbps), Round Trip Time (RTT ms), and Packet Loss %.
 */
export function parseWebRTCStats(stats, prevState = {}) {
  let resolution = '0x0';
  let fps = 0;
  let bitrateMbps = 0;
  let rttMs = null;
  let packetLossPct = 0;

  const now = performance.now();
  const prevTimestamp = prevState.timestamp || now;
  const deltaTime = (now - prevTimestamp) / 1000;

  let currentBytesSent = prevState.bytesSent || 0;
  let currentBytesReceived = prevState.bytesReceived || 0;
  let currentPacketsLost = prevState.packetsLost || 0;
  let currentPacketsReceived = prevState.packetsReceived || 0;

  stats.forEach((report) => {
    // Outbound track (Host transmitting)
    if (report.type === 'outbound-rtp' && report.kind === 'video') {
      if (report.frameWidth && report.frameHeight) {
        resolution = `${report.frameWidth}x${report.frameHeight}`;
      }
      if (report.framesPerSecond) {
        fps = Math.round(report.framesPerSecond);
      }
      if (deltaTime > 0 && report.bytesSent !== undefined) {
        const deltaBytes = Math.max(0, report.bytesSent - (prevState.bytesSent || 0));
        bitrateMbps = Math.max(0, (deltaBytes * 8) / deltaTime / 1000000);
        currentBytesSent = report.bytesSent;
      }
    }

    // Inbound track (Viewer receiving)
    if (report.type === 'inbound-rtp' && report.kind === 'video') {
      if (report.frameWidth && report.frameHeight) {
        resolution = `${report.frameWidth}x${report.frameHeight}`;
      }
      if (report.framesPerSecond) {
        fps = Math.round(report.framesPerSecond);
      }
      if (deltaTime > 0 && report.bytesReceived !== undefined) {
        const deltaBytes = Math.max(0, report.bytesReceived - (prevState.bytesReceived || 0));
        bitrateMbps = Math.max(0, (deltaBytes * 8) / deltaTime / 1000000);
        currentBytesReceived = report.bytesReceived;
      }

      // Packet loss percentage calculation
      if (report.packetsLost !== undefined && report.packetsReceived !== undefined) {
        const deltaLost = Math.max(0, report.packetsLost - (prevState.packetsLost || 0));
        const deltaReceived = Math.max(0, report.packetsReceived - (prevState.packetsReceived || 0));
        const total = deltaLost + deltaReceived;
        if (total > 0) {
          packetLossPct = ((deltaLost / total) * 100).toFixed(1);
        }
        currentPacketsLost = report.packetsLost;
        currentPacketsReceived = report.packetsReceived;
      }
    }

    // Selected ICE candidate pair (RTT calculation)
    if (report.type === 'candidate-pair' && report.state === 'succeeded') {
      if (report.currentRoundTripTime !== undefined) {
        rttMs = Math.round(report.currentRoundTripTime * 1000);
      }
    }
  });

  return {
    metrics: {
      resolution,
      fps,
      bitrateMbps: bitrateMbps.toFixed(2),
      rttMs,
      packetLossPct: Number(packetLossPct)
    },
    nextState: {
      timestamp: now,
      bytesSent: currentBytesSent,
      bytesReceived: currentBytesReceived,
      packetsLost: currentPacketsLost,
      packetsReceived: currentPacketsReceived
    }
  };
}
