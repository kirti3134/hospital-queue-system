// ✅ ENHANCED: UNIVERSAL VOICE SERVICE - CENTRALIZED SYSTEM
class UniversalVoiceService {
  constructor() {
    this.speechEngine = null;
    this.voiceReady = false;
    this.selectedVoice = null;
    this.isSpeaking = false;
    this.socket = null;
    this.fallbackMode = false;
    this.audioContext = null;
    this.audioElements = new Map();
    this.currentAudio = null;
    this.audioCache = new Map();
    this.isMP3Supported = true;
    
    this.init();
  }

  setSocket(socket) {
    this.socket = socket;
  }

  init() {
    // Check browser support
    if (!('speechSynthesis' in window)) {
      console.warn('❌ Speech synthesis not supported, using MP3 mode only');
      this.fallbackMode = true;
    }

    // Check MP3 support
    const audio = new Audio();
    this.isMP3Supported = !!audio.canPlayType && (
      audio.canPlayType('audio/mp3') !== '' ||
      audio.canPlayType('audio/mpeg') !== ''
    );

    console.log(`🔊 CENTRALIZED MP3 Support: ${this.isMP3Supported ? '✅' : '❌'}`);

    this.speechEngine = window.speechSynthesis;
    this.loadVoices();
    
    // Additional fallback initialization
    this.initFallbackMode();
  }

  initFallbackMode() {
    // Create audio context for fallback sounds
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      console.log('✅ Audio context created for fallback sounds');
    } catch (error) {
      console.warn('❌ Audio context not supported:', error);
    }
  }

  loadVoices() {
    if (!this.speechEngine) return;

    const loadAvailableVoices = () => {
      const voices = this.speechEngine.getVoices();
      
      // Try to find Urdu voice first
      const urduVoice = this.findBestUrduVoice(voices);
      
      if (urduVoice) {
        this.selectedVoice = urduVoice;
        this.voiceReady = true;
        console.log('✅ Centralized Urdu voice loaded:', urduVoice.name);
      } else if (voices.length > 0) {
        // Fallback to any available voice
        this.selectedVoice = voices[0];
        this.voiceReady = true;
        console.log('✅ Centralized default voice loaded:', voices[0].name);
      } else {
        console.warn('❌ No voices available, using MP3/fallback mode');
        this.fallbackMode = true;
      }
    };

    if (this.speechEngine.getVoices().length > 0) {
      loadAvailableVoices();
    } else {
      this.speechEngine.addEventListener('voiceschanged', loadAvailableVoices);
    }

    // Multiple retry attempts
    setTimeout(() => this.loadVoices(), 1000);
    setTimeout(() => this.loadVoices(), 3000);
  }

  findBestUrduVoice(voices) {
    if (!voices || voices.length === 0) return null;

    const scoredVoices = voices.map(voice => {
      let score = 0;
      const voiceLang = voice.lang.toLowerCase();
      const voiceName = voice.name.toLowerCase();

      if (voiceLang.includes('ur-pk')) score += 1000;
      if (voiceLang.includes('ur_in')) score += 800;
      if (voiceLang.includes('ur')) score += 600;
      if (voiceName.includes('female')) score += 500;
      if (voiceName.includes('pakistan')) score += 600;
      if (voiceName.includes('urdu')) score += 400;
      if (voice.localService) score += 200;
      if (voice.default) score += 300;

      return { voice, score };
    });

    scoredVoices.sort((a, b) => b.score - a.score);
    return scoredVoices.length > 0 && scoredVoices[0].score > 0 ? scoredVoices[0].voice : null;
  }

  // ✅ ENHANCED: PLAY CENTRALIZED MP3 ANNOUNCEMENT WITH CACHING - NO VISUAL
  async playMP3Announcement(announcementData) {
    const { audioUrl, ticketNumber, counterNumber, isRecall } = announcementData;
    
    console.log(`🔊 CENTRALIZED MP3 ANNOUNCEMENT: Playing ${audioUrl}`);
    
    // ✅ NO VISUAL NOTIFICATION - CENTRALIZED VOICE ONLY
    
    try {
      await this.playAudioFile(audioUrl);
      console.log('✅ Centralized MP3 announcement completed');
    } catch (error) {
      console.error('❌ Centralized MP3 playback failed:', error);
      // Fallback to TTS
      await this.playTTSAnnouncement(announcementData);
    }
  }

  // ✅ ENHANCED: PLAY AUDIO FILE WITH BETTER ERROR HANDLING
  playAudioFile(audioUrl) {
    return new Promise((resolve, reject) => {
      // Stop any currently playing audio
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio = null;
      }
      
      // Check cache first
      if (this.audioCache.has(audioUrl)) {
        console.log('🔊 Using cached centralized audio');
        const audio = this.audioCache.get(audioUrl).cloneNode();
        this.setupAudioElement(audio, resolve, reject);
        return;
      }
      
      const audio = new Audio(audioUrl);
      this.audioCache.set(audioUrl, audio.cloneNode());
      
      this.setupAudioElement(audio, resolve, reject);
    });
  }

  setupAudioElement(audio, resolve, reject) {
    this.currentAudio = audio;
    
    audio.onended = () => {
      this.currentAudio = null;
      resolve();
    };
    
    audio.onerror = (error) => {
      this.currentAudio = null;
      console.error('❌ Centralized audio playback error:', error);
      reject(error);
    };

    audio.oncanplaythrough = () => {
      console.log('🔊 Centralized audio loaded and ready to play');
    };

    // Start playback with error handling
    const playPromise = audio.play();
    
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log('🔊 Centralized audio playback started successfully');
        })
        .catch(error => {
          console.error('❌ Centralized audio play failed:', error);
          reject(error);
        });
    }
  }

  // ✅ UPDATED: CENTRALIZED TTS ANNOUNCEMENT (FALLBACK) - NO VISUAL
  async playTTSAnnouncement(announcementData) {
    const { ticketNumber, counterNumber, isRecall, message } = announcementData;
    
    console.log(`🔊 CENTRALIZED TTS FALLBACK: ${ticketNumber} for Counter ${counterNumber}`);
    
    // ✅ NO VISUAL NOTIFICATION - CENTRALIZED VOICE ONLY
    
    try {
      const urduMessage = message || this.getUrduAnnouncementMessage(ticketNumber, counterNumber, isRecall);
      await this.speakUrduAnnouncement(urduMessage);
      console.log('✅ Centralized TTS announcement completed');
    } catch (error) {
      console.error('❌ Centralized TTS announcement failed:', error);
      // Final fallback to sound
      await this.playFallbackSound();
    }
  }

  convertToUrduPronunciation(text) {
    if (!text) return text;
    
    let result = '';
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      switch (char.toUpperCase()) {
        case 'A': result += 'ای '; break;
        case 'B': result += 'بی '; break;
        case 'C': result += 'سی '; break;
        case 'D': result += 'ڈی '; break;
        case 'E': result += 'ای '; break;
        case 'F': result += 'ایف '; break;
        case 'G': result += 'جی '; break;
        case 'H': result += 'ایچ '; break;
        case 'I': result += 'آئی '; break;
        case 'J': result += 'جے '; break;
        case 'K': result += 'کے '; break;
        case 'L': result += 'ایل '; break;
        case 'M': result += 'ایم '; break;
        case 'N': result += 'این '; break;
        case 'O': result += 'او '; break;
        case 'P': result += 'پی '; break;
        case 'Q': result += 'کیو '; break;
        case 'R': result += 'آر '; break;
        case 'S': result += 'ایس '; break;
        case 'T': result += 'ٹی '; break;
        case 'U': result += 'یو '; break;
        case 'V': result += 'وی '; break;
        case 'W': result += 'ڈبلیو '; break;
        case 'X': result += 'ایکس '; break;
        case 'Y': result += 'وائے '; break;
        case 'Z': result += 'زیڈ '; break;
        case '0': result += 'زیرو '; break;
        case '1': result += 'ایک '; break;
        case '2': result += 'دو '; break;
        case '3': result += 'تین '; break;
        case '4': result += 'چار '; break;
        case '5': result += 'پانچ '; break;
        case '6': result += 'چھ '; break;
        case '7': result += 'سات '; break;
        case '8': result += 'آٹھ '; break;
        case '9': result += 'نو '; break;
        case '-': result += '  '; break;
        case ' ': result += '  '; break;
        default: result += char + ' '; break;
      }
    }
    
    return result.trim();
  }

  getUrduAnnouncementMessage(ticketNumber, counterNumber, isRecall = false) {
    const urduTicketNumber = this.convertToUrduPronunciation(ticketNumber);
    const urduCounterNumber = this.convertToUrduPronunciation(counterNumber.toString());

    if (isRecall) {
      return `ٹکٹ نمبر ${urduTicketNumber} برائے کرم فوری طور پر کاؤنٹر نمبر ${urduCounterNumber} پر تشریف لائیں۔ شکریہ۔`;
    } else {
      return `ٹکٹ نمبر ${urduTicketNumber} برائے کرم کاؤنٹر نمبر ${urduCounterNumber} پر تشریف لائیں۔ شکریہ۔`;
    }
  }

  // ✅ FIXED: ENHANCED CENTRALIZED VOICE ANNOUNCEMENT WITH FALLBACK - NO VISUAL
  speakUrduAnnouncement(text) {
    return new Promise((resolve) => {
      if (this.fallbackMode || !this.isMP3Supported) {
        console.log('🔊 Using centralized fallback mode for announcement');
        this.playFallbackSound().then(resolve);
        return;
      }

      if (!this.speechEngine || this.isSpeaking || !this.voiceReady) {
        console.warn('❌ Centralized voice system not ready, using fallback');
        this.playFallbackSound().then(resolve);
        return;
      }

      try {
        this.isSpeaking = true;
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = this.selectedVoice;
        utterance.lang = 'ur-PK';
        utterance.rate = 0.85;
        utterance.pitch = 1.2;
        utterance.volume = 1.0;

        utterance.onend = () => {
          this.isSpeaking = false;
          console.log('✅ Centralized voice announcement completed');
          setTimeout(resolve, 500);
        };

        utterance.onerror = (event) => {
          this.isSpeaking = false;
          console.error('❌ Centralized voice announcement error:', event);
          // Fallback to sound
          this.playFallbackSound().then(resolve);
        };

        // Cancel any ongoing speech
        if (this.speechEngine.speaking) {
          this.speechEngine.cancel();
          setTimeout(() => {
            this.speechEngine.speak(utterance);
          }, 300);
        } else {
          this.speechEngine.speak(utterance);
        }

      } catch (error) {
        this.isSpeaking = false;
        console.error('❌ Error in centralized voice announcement:', error);
        this.playFallbackSound().then(resolve);
      }
    });
  }

  // ✅ FIXED: CENTRALIZED FALLBACK SOUND SYSTEM
  playFallbackSound() {
    return new Promise((resolve) => {
      try {
        // Create beep sound using Web Audio API
        if (this.audioContext) {
          const oscillator = this.audioContext.createOscillator();
          const gainNode = this.audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(this.audioContext.destination);
          
          oscillator.frequency.value = 800;
          oscillator.type = 'sine';
          
          gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
          gainNode.gain.linearRampToValueAtTime(0.1, this.audioContext.currentTime + 0.1);
          gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.5);
          
          oscillator.start(this.audioContext.currentTime);
          oscillator.stop(this.audioContext.currentTime + 0.5);
          
          setTimeout(() => {
            resolve();
          }, 800);
        } else {
          // Fallback to timeout if audio context fails
          setTimeout(() => {
            resolve();
          }, 1000);
        }
      } catch (error) {
        console.error('❌ Centralized fallback sound error:', error);
        setTimeout(() => {
          resolve();
        }, 1000);
      }
    });
  }

  // ✅ REMOVED VISUAL NOTIFICATION FUNCTION COMPLETELY

  // ✅ ENHANCED CENTRALIZED VOICE STATUS WITH MP3 SUPPORT
  getVoiceStatus() {
    return {
      voiceReady: this.voiceReady,
      isSpeaking: this.isSpeaking,
      fallbackMode: this.fallbackMode,
      mp3Supported: this.isMP3Supported,
      currentAudio: !!this.currentAudio,
      audioCacheSize: this.audioCache.size,
      voicesAvailable: this.speechEngine ? this.speechEngine.getVoices().length : 0,
      selectedVoice: this.selectedVoice ? this.selectedVoice.name : 'None',
      system: 'centralized_universal_mp3_tts_fallback'
    };
  }

  // Test centralized voice system
  async testVoiceSystem() {
    console.log('🔊 Testing centralized voice system...');
    const status = this.getVoiceStatus();
    console.log('Centralized Voice Status:', status);
    
    if (status.mp3Supported) {
      // Test with a simple MP3 if available, or use TTS
      if (status.voiceReady) {
        await this.speakUrduAnnouncement('مرکزی نظام کامیاب ہے۔ آواز کا نظام کام کر رہا ہے۔');
        return { success: true, method: 'centralized_tts' };
      } else {
        await this.playFallbackSound();
        return { success: true, method: 'centralized_fallback' };
      }
    } else {
      console.warn('Centralized MP3 not supported, using fallback');
      await this.playFallbackSound();
      return { success: true, method: 'centralized_fallback' };
    }
  }

  // Clear centralized audio cache
  clearAudioCache() {
    const previousSize = this.audioCache.size;
    this.audioCache.clear();
    console.log(`🧹 Cleared centralized audio cache (${previousSize} entries)`);
    return previousSize;
  }

  // Preload centralized audio files
  async preloadAudio(audioUrls) {
    const loadPromises = audioUrls.map(url => {
      return new Promise((resolve) => {
        if (this.audioCache.has(url)) {
          resolve(true);
          return;
        }

        const audio = new Audio();
        audio.src = url;
        audio.preload = 'auto';
        
        audio.oncanplaythrough = () => {
          this.audioCache.set(url, audio);
          resolve(true);
        };
        
        audio.onerror = () => {
          console.warn(`❌ Failed to preload centralized audio: ${url}`);
          resolve(false);
        };
      });
    });

    return Promise.all(loadPromises);
  }

  // Centralized announce ticket (main method) - NO VISUAL
  async announceTicket(ticketNumber, counterNumber, isRecall = false) {
    const announcementData = {
      ticketNumber,
      counterNumber,
      isRecall,
      type: 'centralized_tts_announcement',
      message: this.getUrduAnnouncementMessage(ticketNumber, counterNumber, isRecall)
    };
    
    return this.playTTSAnnouncement(announcementData);
  }

  // ✅ ADDED: Process centralized announcement from server
  async processCentralizedAnnouncement(announcementData) {
    console.log('🔊 Processing centralized announcement:', announcementData);
    
    const { type, audioUrl, ticketNumber, counterNumber, isRecall, message } = announcementData;
    
    try {
      if (type === 'mp3_announcement' && audioUrl) {
        await this.playMP3Announcement(announcementData);
      } else {
        await this.playTTSAnnouncement(announcementData);
      }
      return { success: true, method: type };
    } catch (error) {
      console.error('❌ Centralized announcement processing failed:', error);
      return { success: false, error: error.message };
    }
  }
}

// Create global centralized instance
const universalVoiceService = new UniversalVoiceService();

// Make it available globally for debugging
window.voiceService = universalVoiceService;

export default universalVoiceService;