import { useState, useRef, useCallback } from 'react';

export function useMediaStream({ onScreenEnded, onLog }) {
  const [screenStream, setScreenStream] = useState(null);
  const [micStream, setMicStream] = useState(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(true);
  const [isDeafened, setIsDeafened] = useState(false);
  const [activeQuality, setActiveQuality] = useState('1080p60');

  const screenStreamRef = useRef(null);
  const micStreamRef = useRef(null);

  const log = useCallback((msg, level = 'INFO') => {
    if (onLog) onLog(msg, level);
  }, [onLog]);

  // Start Screen Capture (1080p60 with system audio)
  const startScreenShare = useCallback(async () => {
    try {
      log('Requesting screen capture pipeline (1080p @ 60 FPS + audio)...', 'INFO');

      const constraints = {
        video: {
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 60, max: 60 },
          cursor: 'always'
        },
        audio: true
      };

      const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
      screenStreamRef.current = stream;
      setScreenStream(stream);
      setIsScreenSharing(true);

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          log('Screen capture terminated by OS / user.', 'WARN');
          stopScreenShare();
          if (onScreenEnded) onScreenEnded();
        };
      }

      log('Screen capture stream acquired successfully.', 'SUCCESS');
      return stream;
    } catch (err) {
      log(`Display media acquisition failed: ${err.message}`, 'ERROR');
      throw err;
    }
  }, [log, onScreenEnded]);

  // Stop Screen Share
  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    setScreenStream(null);
    setIsScreenSharing(false);
    log('Screen share pipeline stopped.', 'INFO');
  }, [log]);

  // Toggle Microphone
  const toggleMicrophone = useCallback(async (pc) => {
    if (!micStreamRef.current) {
      try {
        log('Acquiring microphone device...', 'INFO');
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        micStreamRef.current = stream;
        setMicStream(stream);
        setIsMicMuted(false);

        // Add mic track to active PeerConnection if available
        if (pc) {
          const micTrack = stream.getAudioTracks()[0];
          pc.addTrack(micTrack, stream);
          log('Microphone track added to PeerConnection.', 'SUCCESS');
        }
        log('Microphone unmuted.', 'SUCCESS');
        return stream;
      } catch (err) {
        log(`Microphone access error: ${err.message}`, 'ERROR');
        throw err;
      }
    } else {
      const isMutedNow = !isMicMuted;
      micStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !isMutedNow;
      });
      setIsMicMuted(isMutedNow);
      log(isMutedNow ? 'Microphone muted.' : 'Microphone unmuted.', 'INFO');
      return micStreamRef.current;
    }
  }, [isMicMuted, log]);

  // Toggle Audio Deafen
  const toggleDeafen = useCallback(() => {
    setIsDeafened((prev) => {
      const next = !prev;
      log(next ? 'System audio deafened.' : 'System audio active.', 'INFO');
      return next;
    });
  }, [log]);

  // Apply Bitrate Presets via RTCRtpSender.setParameters()
  const applySenderBitrate = useCallback(async (pc, preset = activeQuality) => {
    if (!pc) return;
    const videoSender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
    if (!videoSender) return;

    let maxBitrate;
    let maxFramerate;

    switch (preset) {
      case '720p30':
        maxBitrate = 4000 * 1000;
        maxFramerate = 30;
        break;
      case '1080p60':
        maxBitrate = 8000 * 1000;
        maxFramerate = 60;
        break;
      case 'source':
      default:
        maxBitrate = 20000 * 1000;
        maxFramerate = 60;
        break;
    }

    try {
      const params = videoSender.getParameters();
      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}];
      }
      params.encodings[0].maxBitrate = maxBitrate;
      params.encodings[0].maxFramerate = maxFramerate;
      await videoSender.setParameters(params);
      log(`Encoder constraints applied: ${(maxBitrate / 1000000).toFixed(1)} Mbps @ ${maxFramerate} FPS`, 'SUCCESS');
    } catch (err) {
      log(`Encoder setParameters error: ${err.message}`, 'WARN');
    }
  }, [activeQuality, log]);

  const setQualityPreset = useCallback(async (preset, pc) => {
    setActiveQuality(preset);
    if (pc) {
      await applySenderBitrate(pc, preset);
    }
  }, [applySenderBitrate]);

  // Cleanup all media on unmount
  const stopAllMedia = useCallback(() => {
    stopScreenShare();
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    setMicStream(null);
    setIsMicMuted(true);
  }, [stopScreenShare]);

  return {
    screenStream,
    micStream,
    isScreenSharing,
    isMicMuted,
    isDeafened,
    activeQuality,
    startScreenShare,
    stopScreenShare,
    toggleMicrophone,
    toggleDeafen,
    setQualityPreset,
    applySenderBitrate,
    stopAllMedia
  };
}
