/**
 * SYNAPSE SCREEN SHARE // Real-Time WebRTC Media Controller
 * Version: 1.0.4
 * Features: Screen + System Audio capture (1080p60), Mic mixing,
 *           SDP Bitrate Presets, Telemetry HUD, P2P DataChannel terminal.
 */

// Generate random operative callsign
const OPERATOR_ID = 'OPR_' + Math.random().toString(36).substring(2, 6).toUpperCase();

class SynapseApp {
  constructor() {
    this.operatorId = OPERATOR_ID;
    this.roomId = this.getInitialRoom();
    
    // WebRTC & Media State
    this.pc = null;
    this.dataChannel = null;
    this.ws = null;
    this.remotePeerId = null;
    
    this.screenStream = null;
    this.micStream = null;
    this.isScreenSharing = false;
    this.isMicMuted = true;
    this.isDeafened = false;
    this.activeQuality = '1080p60';

    // Telemetry tracking
    this.statsInterval = null;
    this.prevBytesSent = 0;
    this.prevBytesReceived = 0;
    this.prevPacketsLost = 0;
    this.prevPacketsReceived = 0;
    this.prevTimestamp = 0;

    // ICE Candidate buffer (for candidates arriving before setRemoteDescription)
    this.pendingCandidates = [];

    // DOM Elements Cache
    this.cacheDom();
    this.initEventListeners();
    this.initSignaling();
  }

  getInitialRoom() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      return roomParam.toUpperCase().trim();
    }
    return 'NODE_ALPHA';
  }

  cacheDom() {
    // Header
    this.roomInput = document.getElementById('roomInput');
    this.joinRoomBtn = document.getElementById('joinRoomBtn');
    this.copyLinkBtn = document.getElementById('copyLinkBtn');
    this.copyBtnText = document.getElementById('copyBtnText');
    this.statusLed = document.getElementById('statusLed');
    this.statusText = document.getElementById('statusText');
    this.headerRtt = document.getElementById('headerRtt');
    this.toggleSidebarBtn = document.getElementById('toggleSidebarBtn');

    // Viewport
    this.stageContainer = document.getElementById('stageContainer');
    this.streamVideo = document.getElementById('streamVideo');
    this.remoteAudio = document.getElementById('remoteAudio');
    this.idleStateDisplay = document.getElementById('idleStateDisplay');
    this.crtOverlay = document.getElementById('crtOverlay');
    this.toggleScanlineBtn = document.getElementById('toggleScanlineBtn');
    this.pipBtn = document.getElementById('pipBtn');
    this.fullscreenBtn = document.getElementById('fullscreenBtn');

    // Telemetry HUD
    this.streamTypeLabel = document.getElementById('streamTypeLabel');
    this.telemetryRes = document.getElementById('telemetryRes');
    this.telemetryFps = document.getElementById('telemetryFps');
    this.telemetryBitrate = document.getElementById('telemetryBitrate');
    this.telemetryRtt = document.getElementById('telemetryRtt');
    this.telemetryLoss = document.getElementById('telemetryLoss');

    // Quantum Dock
    this.toggleMicBtn = document.getElementById('toggleMicBtn');
    this.micIcon = document.getElementById('micIcon');
    this.micLabel = document.getElementById('micLabel');
    this.toggleDeafenBtn = document.getElementById('toggleDeafenBtn');
    this.deafenIcon = document.getElementById('deafenIcon');
    this.deafenLabel = document.getElementById('deafenLabel');
    this.startShareBtn = document.getElementById('startShareBtn');
    this.startShareText = document.getElementById('startShareText');
    this.qualitySelect = document.getElementById('qualitySelect');
    this.terminateBtn = document.getElementById('terminateBtn');

    // Sidebar & Tabs
    this.sidebar = document.getElementById('sidebar');
    this.tabTerminalBtn = document.getElementById('tabTerminalBtn');
    this.tabDiagnosticsBtn = document.getElementById('tabDiagnosticsBtn');
    this.terminalTab = document.getElementById('terminalTab');
    this.diagnosticsTab = document.getElementById('diagnosticsTab');
    this.chatMessages = document.getElementById('chatMessages');
    this.chatForm = document.getElementById('chatForm');
    this.chatInput = document.getElementById('chatInput');
    this.diagLogs = document.getElementById('diagLogs');
    this.diagIceState = document.getElementById('diagIceState');
    this.clearDiagBtn = document.getElementById('clearDiagBtn');

    // Set Initial values
    this.roomInput.value = this.roomId;
  }

  initEventListeners() {
    // Room Controls
    this.joinRoomBtn.addEventListener('click', () => {
      const newRoom = this.roomInput.value.trim().toUpperCase() || 'NODE_ALPHA';
      if (newRoom !== this.roomId) {
        this.switchRoom(newRoom);
      }
    });

    this.roomInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.joinRoomBtn.click();
      }
    });

    this.copyLinkBtn.addEventListener('click', () => this.copySynapseLink());

    // Stream & Audio controls
    this.startShareBtn.addEventListener('click', () => this.toggleScreenShare());
    this.toggleMicBtn.addEventListener('click', () => this.toggleMicrophone());
    this.toggleDeafenBtn.addEventListener('click', () => this.toggleDeafen());
    this.qualitySelect.addEventListener('change', (e) => this.setQualityPreset(e.target.value));
    this.terminateBtn.addEventListener('click', () => this.terminateConnection());

    // Viewport controls
    this.toggleScanlineBtn.addEventListener('click', () => {
      this.crtOverlay.classList.toggle('hidden');
    });

    this.pipBtn.addEventListener('click', async () => {
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else if (this.streamVideo && !this.streamVideo.classList.contains('hidden')) {
          await this.streamVideo.requestPictureInPicture();
        }
      } catch (err) {
        this.logDiag(`PiP Error: ${err.message}`, 'WARN');
      }
    });

    this.fullscreenBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        this.stageContainer.requestFullscreen().catch((err) => {
          this.logDiag(`Fullscreen error: ${err.message}`, 'WARN');
        });
      } else {
        document.exitFullscreen();
      }
    });

    // Sidebar Toggles & Tabs
    this.toggleSidebarBtn.addEventListener('click', () => {
      this.sidebar.classList.toggle('hidden');
    });

    this.tabTerminalBtn.addEventListener('click', () => {
      this.tabTerminalBtn.className = 'px-3 py-1 rounded text-xs font-bold uppercase tracking-wider bg-cyber-cyan/15 text-cyber-cyan border border-cyber-cyan/40 transition-colors';
      this.tabDiagnosticsBtn.className = 'px-3 py-1 rounded text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200 transition-colors';
      this.terminalTab.classList.remove('hidden');
      this.diagnosticsTab.classList.add('hidden');
    });

    this.tabDiagnosticsBtn.addEventListener('click', () => {
      this.tabDiagnosticsBtn.className = 'px-3 py-1 rounded text-xs font-bold uppercase tracking-wider bg-cyber-purple/20 text-cyber-purple-light border border-cyber-purple/40 transition-colors';
      this.tabTerminalBtn.className = 'px-3 py-1 rounded text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200 transition-colors';
      this.diagnosticsTab.classList.remove('hidden');
      this.terminalTab.classList.add('hidden');
    });

    this.clearDiagBtn.addEventListener('click', () => {
      this.diagLogs.innerHTML = '';
    });

    // Chat Form Submit
    this.chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.sendChatMessage();
    });
  }

  // ==========================================================
  // SIGNALING & WEBSOCKET HANDLING
  // ==========================================================
  initSignaling() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    this.logDiag(`Connecting to signaling uplink: ${wsUrl}`, 'INFO');

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.logDiag(`Signaling channel OPEN. Authenticating as ${this.operatorId}...`, 'SUCCESS');
      this.updateStatus('LINK_ACTIVE', 'text-cyber-green', 'bg-cyber-green');
      this.joinRoom(this.roomId);
    };

    this.ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        await this.handleSignalingMessage(data);
      } catch (err) {
        this.logDiag(`Signaling parse error: ${err.message}`, 'ERROR');
      }
    };

    this.ws.onclose = () => {
      this.logDiag('Signaling server link severed. Reconnecting in 3s...', 'WARN');
      this.updateStatus('OFFLINE', 'text-cyber-red', 'bg-cyber-red');
      setTimeout(() => this.initSignaling(), 3000);
    };

    this.ws.onerror = (err) => {
      this.logDiag('WebSocket connection error.', 'ERROR');
    };
  }

  sendSignaling(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  joinRoom(roomId) {
    this.roomId = roomId;
    this.updateUrlRoom(roomId);
    this.logDiag(`Requesting entry into Node: [${roomId}]`, 'INFO');
    this.sendSignaling({
      type: 'join-room',
      roomId: this.roomId,
      peerId: this.operatorId
    });
  }

  switchRoom(newRoom) {
    this.terminateConnection(false);
    this.roomId = newRoom;
    this.roomInput.value = newRoom;
    this.joinRoom(newRoom);
    this.addChatMessage('SYSTEM', `Switched network node to [${newRoom}].`, true);
  }

  async handleSignalingMessage(msg) {
    switch (msg.type) {
      case 'room-joined': {
        this.logDiag(`Uplink established in Node [${msg.roomId}]. Active peers: ${msg.peers.length}`, 'SUCCESS');
        if (msg.peers.length > 0) {
          // Other peers exist, prepare connection
          this.remotePeerId = msg.peers[0];
          this.logDiag(`Target peer identified: ${this.remotePeerId}`, 'INFO');
          if (this.isScreenSharing) {
            await this.createAndSendOffer();
          }
        }
        break;
      }

      case 'peer-joined': {
        this.logDiag(`Remote peer entered Node: ${msg.peerId}`, 'INFO');
        this.remotePeerId = msg.peerId;
        this.addChatMessage('SYSTEM', `Peer ${msg.peerId} established uplink.`, true);

        // If we are currently sharing our screen, initiate an offer to the new peer!
        if (this.isScreenSharing) {
          await this.createAndSendOffer();
        }
        break;
      }

      case 'offer': {
        this.logDiag(`Received SDP Offer from ${msg.from}`, 'SIGNAL');
        this.remotePeerId = msg.from;
        await this.handleOffer(msg.sdp);
        break;
      }

      case 'answer': {
        this.logDiag(`Received SDP Answer from ${msg.from}`, 'SIGNAL');
        await this.handleAnswer(msg.sdp);
        break;
      }

      case 'ice-candidate': {
        if (msg.candidate) {
          await this.handleRemoteIceCandidate(msg.candidate);
        }
        break;
      }

      case 'peer-disconnected': {
        this.logDiag(`Peer ${msg.peerId} disconnected.`, 'WARN');
        this.addChatMessage('SYSTEM', `Peer ${msg.peerId} severed link.`, true);
        if (msg.peerId === this.remotePeerId) {
          this.remotePeerId = null;
          this.resetRemoteView();
        }
        break;
      }
    }
  }

  // ==========================================================
  // WEBRTC PEER CONNECTION PIPELINE
  // ==========================================================
  ensurePeerConnection() {
    if (this.pc && this.pc.signalingState !== 'closed') {
      return this.pc;
    }

    this.logDiag('Initializing new RTCPeerConnection (STUN: Google Public)...', 'INFO');

    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    this.pc = new RTCPeerConnection(config);

    // ICE Candidate generation
    this.pc.onicecandidate = (event) => {
      if (event.candidate && this.remotePeerId) {
        this.sendSignaling({
          type: 'ice-candidate',
          target: this.remotePeerId,
          candidate: event.candidate
        });
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      this.diagIceState.textContent = this.pc.iceConnectionState;
      this.logDiag(`ICE State changed -> ${this.pc.iceConnectionState}`, 'INFO');
      if (this.pc.iceConnectionState === 'connected' || this.pc.iceConnectionState === 'completed') {
        this.startTelemetryHUD();
      } else if (this.pc.iceConnectionState === 'failed' || this.pc.iceConnectionState === 'disconnected') {
        this.stopTelemetryHUD();
      }
    };

    this.pc.onconnectionstatechange = () => {
      this.logDiag(`Connection State -> ${this.pc.connectionState}`, 'INFO');
      if (this.pc.connectionState === 'connected') {
        this.updateStatus('TRANSMITTING', 'text-cyber-cyan-bright', 'bg-cyber-cyan');
      }
    };

    // Remote stream arrival (video/audio)
    this.pc.ontrack = (event) => {
      this.logDiag(`Received remote track: ${event.track.kind}`, 'SUCCESS');
      
      if (event.streams && event.streams[0]) {
        this.streamVideo.srcObject = event.streams[0];
        this.streamVideo.classList.remove('hidden');
        this.idleStateDisplay.classList.add('hidden');
        this.streamTypeLabel.textContent = 'RECEIVING STREAM';

        // Play video
        this.streamVideo.play().catch(e => {
          this.logDiag(`Auto-play blocked, user click needed: ${e.message}`, 'WARN');
        });
      }
    };

    // P2P DataChannel setup (when created by remote peer)
    this.pc.ondatachannel = (event) => {
      this.logDiag('Remote DataChannel arrived: ' + event.channel.label, 'INFO');
      this.setupDataChannel(event.channel);
    };

    return this.pc;
  }

  setupDataChannel(channel) {
    this.dataChannel = channel;
    this.dataChannel.onopen = () => {
      this.logDiag('RTCDataChannel is OPEN. Terminal ready.', 'SUCCESS');
      this.addChatMessage('SYSTEM', 'DataChannel established. Direct P2P link active.', true);
    };
    this.dataChannel.onclose = () => {
      this.logDiag('RTCDataChannel closed.', 'WARN');
    };
    this.dataChannel.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        this.addChatMessage(payload.sender, payload.text);
      } catch (err) {
        this.addChatMessage('REMOTE', e.data);
      }
    };
  }

  // ==========================================================
  // MEDIA: SCREEN SHARE & SYSTEM AUDIO
  // ==========================================================
  async toggleScreenShare() {
    if (this.isScreenSharing) {
      this.stopScreenShare();
      return;
    }

    try {
      this.logDiag('Requesting display media (1080p @ 60 FPS + audio)...', 'INFO');

      // Explicit constraints for 1080p60 + System Audio
      const constraints = {
        video: {
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 60, max: 60 },
          cursor: 'always'
        },
        audio: true // Captures system sound where supported
      };

      const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
      this.screenStream = stream;
      this.isScreenSharing = true;

      // Handle user clicking browser stop sharing button
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          this.logDiag('Display capture ended by user (OS trigger).', 'WARN');
          this.stopScreenShare();
        };
      }

      // Display preview locally in stage
      this.streamVideo.srcObject = stream;
      this.streamVideo.classList.remove('hidden');
      this.idleStateDisplay.classList.add('hidden');
      this.streamTypeLabel.textContent = 'TRANSMITTING LOCAL';

      // Attach tracks to PeerConnection
      const pc = this.ensurePeerConnection();

      // Create DataChannel if host
      if (!this.dataChannel) {
        const channel = pc.createDataChannel('synapse-terminal', { ordered: true });
        this.setupDataChannel(channel);
      }

      // Add video track
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Apply initial bitrate preset
      await this.applyBitrateConstraints();

      // Update button state
      this.startShareBtn.classList.remove('bg-cyber-cyan', 'hover:bg-cyber-cyan-bright', 'text-cyber-black');
      this.startShareBtn.classList.add('bg-cyber-red', 'hover:bg-red-500', 'text-white', 'neon-glow-red');
      this.startShareText.textContent = 'STOP TRANSMISSION';

      this.logDiag('Screen capture initiated successfully.', 'SUCCESS');
      this.startTelemetryHUD();

      // Send offer to connected peer if available
      if (this.remotePeerId) {
        await this.createAndSendOffer();
      } else {
        this.logDiag('Waiting for peer to connect to Node before negotiation...', 'INFO');
      }

    } catch (err) {
      this.logDiag(`Failed to capture screen: ${err.message}`, 'ERROR');
      this.stopScreenShare();
    }
  }

  stopScreenShare() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => track.stop());
      this.screenStream = null;
    }

    this.isScreenSharing = false;

    // Reset button UI
    this.startShareBtn.classList.add('bg-cyber-cyan', 'hover:bg-cyber-cyan-bright', 'text-cyber-black');
    this.startShareBtn.classList.remove('bg-cyber-red', 'hover:bg-red-500', 'text-white', 'neon-glow-red');
    this.startShareText.textContent = 'INITIALIZE SYNAPSE LINK';

    // Remove video sender tracks from PC
    if (this.pc) {
      const senders = this.pc.getSenders();
      senders.forEach((sender) => {
        if (sender.track && sender.track.kind === 'video') {
          this.pc.removeTrack(sender);
        }
      });
    }

    this.resetRemoteView();
    this.logDiag('Screen share terminated.', 'INFO');
  }

  // ==========================================================
  // MEDIA: MICROPHONE AUDIO MIXING
  // ==========================================================
  async toggleMicrophone() {
    if (!this.isMicMuted) {
      // Mute mic
      if (this.micStream) {
        this.micStream.getAudioTracks().forEach((t) => (t.enabled = false));
      }
      this.isMicMuted = true;
      this.toggleMicBtn.classList.remove('border-cyan-500/60', 'text-cyber-cyan-bright', 'neon-glow-cyan');
      this.toggleMicBtn.classList.add('border-amber-500/40', 'text-cyber-amber');
      this.micIcon.textContent = 'mic_off';
      this.micLabel.textContent = 'MIC MUTED';
      this.logDiag('Microphone muted.', 'INFO');
    } else {
      // Unmute or capture mic
      try {
        if (!this.micStream) {
          this.micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });

          // Add mic track to RTCPeerConnection
          const pc = this.ensurePeerConnection();
          const micTrack = this.micStream.getAudioTracks()[0];
          pc.addTrack(micTrack, this.micStream);
          this.logDiag('Microphone track registered into media pipeline.', 'SUCCESS');

          if (this.remotePeerId && !this.isScreenSharing) {
            await this.createAndSendOffer();
          }
        } else {
          this.micStream.getAudioTracks().forEach((t) => (t.enabled = true));
        }

        this.isMicMuted = false;
        this.toggleMicBtn.classList.add('border-cyan-500/60', 'text-cyber-cyan-bright', 'neon-glow-cyan');
        this.toggleMicBtn.classList.remove('border-amber-500/40', 'text-cyber-amber');
        this.micIcon.textContent = 'mic';
        this.micLabel.textContent = 'MIC LIVE';
        this.logDiag('Microphone uplink activated.', 'SUCCESS');
      } catch (err) {
        this.logDiag(`Microphone access error: ${err.message}`, 'ERROR');
      }
    }
  }

  toggleDeafen() {
    this.isDeafened = !this.isDeafened;
    this.streamVideo.muted = this.isDeafened;
    this.remoteAudio.muted = this.isDeafened;

    if (this.isDeafened) {
      this.toggleDeafenBtn.classList.add('border-red-500/60', 'text-cyber-red');
      this.deafenIcon.textContent = 'volume_off';
      this.deafenLabel.textContent = 'DEAFENED';
      this.logDiag('Audio output deafened.', 'WARN');
    } else {
      this.toggleDeafenBtn.classList.remove('border-red-500/60', 'text-cyber-red');
      this.deafenIcon.textContent = 'volume_up';
      this.deafenLabel.textContent = 'AUDIO ON';
      this.logDiag('Audio output restored.', 'INFO');
    }
  }

  // ==========================================================
  // QUALITY PRESETS & SDP BITRATE CONSTRAINTS
  // ==========================================================
  async setQualityPreset(preset) {
    this.activeQuality = preset;
    this.logDiag(`Adjusting pipeline preset: [${preset.toUpperCase()}]`, 'INFO');
    await this.applyBitrateConstraints();
  }

  async applyBitrateConstraints() {
    if (!this.pc) return;

    const videoSender = this.pc.getSenders().find((s) => s.track && s.track.kind === 'video');
    if (!videoSender) return;

    let maxBitrate; // in bps
    let maxFramerate;

    switch (this.activeQuality) {
      case '720p30':
        maxBitrate = 4000 * 1000; // 4 Mbps
        maxFramerate = 30;
        break;
      case '1080p60':
        maxBitrate = 8000 * 1000; // 8 Mbps
        maxFramerate = 60;
        break;
      case 'source':
      default:
        maxBitrate = 20000 * 1000; // 20 Mbps uncapped
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
      this.logDiag(`Video encoder calibrated: maxBitrate=${(maxBitrate / 1000000).toFixed(1)}Mbps, maxFPS=${maxFramerate}`, 'SUCCESS');
    } catch (err) {
      this.logDiag(`Failed to set sender parameters: ${err.message}`, 'WARN');
    }
  }

  // ==========================================================
  // SDP OFFER / ANSWER & ICE NEGOTIATION
  // ==========================================================
  async createAndSendOffer() {
    const pc = this.ensurePeerConnection();
    try {
      this.logDiag('Formulating SDP Offer with Opus/AV1/H264...', 'SIGNAL');
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await pc.setLocalDescription(offer);

      this.sendSignaling({
        type: 'offer',
        target: this.remotePeerId,
        sdp: pc.localDescription
      });
    } catch (err) {
      this.logDiag(`Create offer failed: ${err.message}`, 'ERROR');
    }
  }

  async handleOffer(sdp) {
    const pc = this.ensurePeerConnection();
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await this.drainPendingCandidates();

      this.logDiag('SDP Offer ingested. Generating Answer...', 'SIGNAL');
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      this.sendSignaling({
        type: 'answer',
        target: this.remotePeerId,
        sdp: pc.localDescription
      });
    } catch (err) {
      this.logDiag(`Handle offer failed: ${err.message}`, 'ERROR');
    }
  }

  async handleAnswer(sdp) {
    if (!this.pc) return;
    try {
      await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await this.drainPendingCandidates();
      this.logDiag('Remote SDP Answer synced.', 'SUCCESS');
    } catch (err) {
      this.logDiag(`Handle answer failed: ${err.message}`, 'ERROR');
    }
  }

  async handleRemoteIceCandidate(candidateInit) {
    const candidate = new RTCIceCandidate(candidateInit);
    if (this.pc && this.pc.remoteDescription && this.pc.remoteDescription.type) {
      try {
        await this.pc.addIceCandidate(candidate);
      } catch (err) {
        this.logDiag(`Add ICE candidate error: ${err.message}`, 'WARN');
      }
    } else {
      this.pendingCandidates.push(candidate);
    }
  }

  async drainPendingCandidates() {
    if (this.pc && this.pendingCandidates.length > 0) {
      this.logDiag(`Flushing ${this.pendingCandidates.length} queued ICE candidates...`, 'INFO');
      while (this.pendingCandidates.length > 0) {
        const candidate = this.pendingCandidates.shift();
        try {
          await this.pc.addIceCandidate(candidate);
        } catch (e) {
          // Ignore duplicate / stale candidates
        }
      }
    }
  }

  // ==========================================================
  // TELEMETRY & STATS HUD
  // ==========================================================
  startTelemetryHUD() {
    if (this.statsInterval) clearInterval(this.statsInterval);

    this.statsInterval = setInterval(async () => {
      if (!this.pc) return;

      try {
        const stats = await this.pc.getStats();
        let resolution = '0x0';
        let fps = 0;
        let bitrateMbps = 0;
        let rttMs = null;
        let packetLossPct = 0;

        const now = performance.now();
        const deltaTime = (now - (this.prevTimestamp || now)) / 1000;

        stats.forEach((report) => {
          // Outbound stats (Host transmitter)
          if (report.type === 'outbound-rtp' && report.kind === 'video') {
            if (report.frameWidth && report.frameHeight) {
              resolution = `${report.frameWidth}x${report.frameHeight}`;
            }
            if (report.framesPerSecond) {
              fps = Math.round(report.framesPerSecond);
            }
            if (deltaTime > 0 && report.bytesSent !== undefined) {
              const deltaBytes = report.bytesSent - this.prevBytesSent;
              bitrateMbps = Math.max(0, ((deltaBytes * 8) / deltaTime / 1000000));
              this.prevBytesSent = report.bytesSent;
            }
          }

          // Inbound stats (Viewer receiver)
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            if (report.frameWidth && report.frameHeight) {
              resolution = `${report.frameWidth}x${report.frameHeight}`;
            }
            if (report.framesPerSecond) {
              fps = Math.round(report.framesPerSecond);
            }
            if (deltaTime > 0 && report.bytesReceived !== undefined) {
              const deltaBytes = report.bytesReceived - this.prevBytesReceived;
              bitrateMbps = Math.max(0, ((deltaBytes * 8) / deltaTime / 1000000));
              this.prevBytesReceived = report.bytesReceived;
            }

            // Packet Loss calculation
            if (report.packetsLost !== undefined && report.packetsReceived !== undefined) {
              const deltaLost = Math.max(0, report.packetsLost - this.prevPacketsLost);
              const deltaReceived = Math.max(0, report.packetsReceived - this.prevPacketsReceived);
              const totalPackets = deltaLost + deltaReceived;
              if (totalPackets > 0) {
                packetLossPct = ((deltaLost / totalPackets) * 100).toFixed(1);
              }
              this.prevPacketsLost = report.packetsLost;
              this.prevPacketsReceived = report.packetsReceived;
            }
          }

          // Round Trip Time (RTT)
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            if (report.currentRoundTripTime !== undefined) {
              rttMs = Math.round(report.currentRoundTripTime * 1000);
            }
          }
        });

        this.prevTimestamp = now;

        // Fallback for resolution/fps from HTML video element if available
        if (resolution === '0x0' && this.streamVideo.videoWidth) {
          resolution = `${this.streamVideo.videoWidth}x${this.streamVideo.videoHeight}`;
        }

        // Render Telemetry
        this.telemetryRes.textContent = resolution;
        this.telemetryFps.textContent = fps > 0 ? fps : (this.isScreenSharing ? '60' : '0');
        this.telemetryBitrate.textContent = `${bitrateMbps.toFixed(2)} Mbps`;
        if (rttMs !== null) {
          this.telemetryRtt.textContent = `${rttMs} ms`;
          this.headerRtt.textContent = `${rttMs} ms`;
        }
        this.telemetryLoss.textContent = `${packetLossPct}%`;

      } catch (err) {
        // Stats query failure
      }
    }, 1000);
  }

  stopTelemetryHUD() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
    this.telemetryRes.textContent = '0x0';
    this.telemetryFps.textContent = '0';
    this.telemetryBitrate.textContent = '0.00 Mbps';
    this.telemetryRtt.textContent = '-- ms';
    this.telemetryLoss.textContent = '0.0%';
  }

  // ==========================================================
  // P2P TERMINAL CHAT
  // ==========================================================
  sendChatMessage() {
    const text = this.chatInput.value.trim();
    if (!text) return;

    const payload = {
      sender: this.operatorId,
      text: text,
      timestamp: Date.now()
    };

    let delivered = false;
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(payload));
      delivered = true;
    }

    // Always show in our own terminal
    this.addChatMessage(this.operatorId, text);
    this.chatInput.value = '';

    if (!delivered) {
      this.logDiag('DataChannel not connected; message cached locally.', 'WARN');
    }
  }

  addChatMessage(sender, text, isSystem = false) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-GB', { hour12: false });
    const msgDiv = document.createElement('div');
    msgDiv.className = 'leading-relaxed break-words';

    if (isSystem) {
      msgDiv.innerHTML = `
        <span class="text-slate-500 text-[10px]">[${timeStr}]</span>
        <span class="text-cyber-cyan font-bold">[SYS]:</span>
        <span class="text-slate-400">${this.escapeHtml(text)}</span>
      `;
    } else {
      const isSelf = sender === this.operatorId;
      const nameColor = isSelf ? 'text-cyber-green' : 'text-cyber-purple-light';
      msgDiv.innerHTML = `
        <span class="text-slate-500 text-[10px]">[${timeStr}]</span>
        <span class="${nameColor} font-bold">[${this.escapeHtml(sender)}]:</span>
        <span class="text-slate-200">${this.escapeHtml(text)}</span>
      `;
    }

    this.chatMessages.appendChild(msgDiv);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  // ==========================================================
  // DIAGNOSTICS & SYSTEM UTILITIES
  // ==========================================================
  logDiag(msg, level = 'INFO') {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-GB', { hour12: false }) + '.' + String(now.getMilliseconds()).padStart(3, '0');
    
    let colorClass = 'text-slate-400';
    if (level === 'SUCCESS') colorClass = 'text-cyber-green';
    if (level === 'ERROR') colorClass = 'text-cyber-red font-bold';
    if (level === 'WARN') colorClass = 'text-cyber-amber';
    if (level === 'SIGNAL') colorClass = 'text-cyber-purple-light';

    const logEntry = document.createElement('div');
    logEntry.className = 'break-all';
    logEntry.innerHTML = `<span class="text-slate-600">[${timeStr}]</span> <span class="${colorClass}">[${level}]</span> ${this.escapeHtml(msg)}`;
    
    this.diagLogs.appendChild(logEntry);
    this.diagLogs.scrollTop = this.diagLogs.scrollHeight;
  }

  updateStatus(text, textColor, bgLed) {
    this.statusText.textContent = text;
    this.statusText.className = `font-bold ${textColor}`;
    this.statusLed.className = `w-2 h-2 rounded-full ${bgLed} animate-pulse`;
  }

  updateUrlRoom(roomId) {
    const newUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?room=${encodeURIComponent(roomId)}`;
    window.history.replaceState({ path: newUrl }, '', newUrl);
  }

  copySynapseLink() {
    const shareUrl = window.location.href;
    navigator.clipboard.writeText(shareUrl).then(() => {
      const origText = this.copyBtnText.textContent;
      this.copyBtnText.textContent = 'LINK COPIED!';
      this.copyLinkBtn.classList.add('bg-cyber-cyan/30', 'border-cyber-cyan-bright');
      setTimeout(() => {
        this.copyBtnText.textContent = origText;
        this.copyLinkBtn.classList.remove('bg-cyber-cyan/30', 'border-cyber-cyan-bright');
      }, 2000);
    }).catch(err => {
      this.logDiag(`Copy failed: ${err.message}`, 'WARN');
    });
  }

  resetRemoteView() {
    this.streamVideo.srcObject = null;
    this.streamVideo.classList.add('hidden');
    this.idleStateDisplay.classList.remove('hidden');
    this.streamTypeLabel.textContent = 'STANDBY';
    this.stopTelemetryHUD();
  }

  terminateConnection(notifySignaling = true) {
    this.logDiag('Severing WebRTC link and media transceivers...', 'WARN');
    this.stopScreenShare();

    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
      this.isMicMuted = true;
      this.toggleMicBtn.classList.remove('border-cyan-500/60', 'text-cyber-cyan-bright', 'neon-glow-cyan');
      this.toggleMicBtn.classList.add('border-amber-500/40', 'text-cyber-amber');
      this.micIcon.textContent = 'mic_off';
      this.micLabel.textContent = 'MIC MUTED';
    }

    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    if (notifySignaling && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendSignaling({ type: 'leave-room' });
    }

    this.resetRemoteView();
    this.updateStatus('LINK_IDLE', 'text-slate-400', 'bg-slate-600');
    this.addChatMessage('SYSTEM', 'Uplink terminated.', true);
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Boot application upon DOM ready
window.addEventListener('DOMContentLoaded', () => {
  window.synapseApp = new SynapseApp();
});
