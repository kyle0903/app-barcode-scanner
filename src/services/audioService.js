class AudioService {
  constructor() {
    this.audioContext = null;
    this.currentVolume = 0.7;
  }

  // 初始化音效系統
  init() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (error) {
      console.warn('音效系統初始化失敗:', error);
    }
  }

  // 產生音效
  generateTone(frequency, duration, volume = this.currentVolume) {
    if (!this.audioContext) return;

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = 'square';
      
      gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
      
      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + duration);
    } catch (error) {
      console.warn('音效播放失敗:', error);
    }
  }

  // 播放成功音效
  playSuccessSound() {
    this.generateTone(600, 0.2, this.currentVolume);
    setTimeout(() => this.generateTone(1000, 0.2, this.currentVolume), 200);
  }

  // 播放錯誤音效
  playErrorSound() {
    this.generateTone(300, 0.5, this.currentVolume);
  }

  // 播放重複音效
  playDuplicateSound() {
    this.generateTone(500, 0.3, this.currentVolume);
    setTimeout(() => this.generateTone(500, 0.3, this.currentVolume), 300);
  }

  // 設定音量
  setVolume(volume) {
    this.currentVolume = Math.max(0, Math.min(1, volume));
  }

  // 獲取當前音量
  getVolume() {
    return this.currentVolume;
  }
}

export const audioService = new AudioService();
