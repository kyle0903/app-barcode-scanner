/**
 * 螢幕長亮服務
 * 使用 Screen Wake Lock API 防止螢幕進入休眠狀態
 */
class WakeLockService {
  constructor() {
    this.wakeLock = null;
    this.isSupported = "wakeLock" in navigator;
  }

  /**
   * 檢查瀏覽器是否支援 Wake Lock API
   */
  isWakeLockSupported() {
    return this.isSupported;
  }

  /**
   * 啟用螢幕長亮
   */
  async enableWakeLock() {
    if (!this.isSupported) {
      console.warn("此瀏覽器不支援 Screen Wake Lock API");
      return false;
    }

    try {
      // 如果已經有 wake lock，先釋放
      if (this.wakeLock && !this.wakeLock.released) {
        await this.wakeLock.release();
      }

      // 請求新的 wake lock
      this.wakeLock = await navigator.wakeLock.request("screen");

      console.log("螢幕長亮已啟用");

      // 監聽 wake lock 釋放事件
      this.wakeLock.addEventListener("release", () => {
        console.log("螢幕長亮已釋放");
      });

      return true;
    } catch (error) {
      console.error("啟用螢幕長亮失敗:", error);
      return false;
    }
  }

  /**
   * 禁用螢幕長亮
   */
  async disableWakeLock() {
    if (this.wakeLock && !this.wakeLock.released) {
      try {
        await this.wakeLock.release();
        this.wakeLock = null;
        console.log("螢幕長亮已禁用");
        return true;
      } catch (error) {
        console.error("禁用螢幕長亮失敗:", error);
        return false;
      }
    }
    return true;
  }

  /**
   * 檢查 wake lock 是否處於活躍狀態
   */
  isActive() {
    return this.wakeLock && !this.wakeLock.released;
  }

  /**
   * 處理頁面可見性變化
   * 當頁面重新變為可見時，重新啟用 wake lock
   */
  handleVisibilityChange() {
    if (document.visibilityState === "visible" && this.wakeLock?.released) {
      this.enableWakeLock();
    }
  }

  /**
   * 初始化服務，設置事件監聽器
   */
  init() {
    if (!this.isSupported) {
      console.warn("此瀏覽器不支援 Screen Wake Lock API，將使用替代方案");
      this.useFallbackMethod();
      return;
    }

    // 監聽頁面可見性變化
    document.addEventListener("visibilitychange", () => {
      this.handleVisibilityChange();
    });

    // 頁面載入時自動啟用螢幕長亮
    this.enableWakeLock();
  }

  /**
   * 替代方案：使用隱藏的影片元素防止螢幕休眠
   * 適用於不支援 Wake Lock API 的舊瀏覽器
   */
  useFallbackMethod() {
    try {
      // 創建隱藏的影片元素
      const video = document.createElement("video");
      video.setAttribute("muted", "");
      video.setAttribute("loop", "");
      video.setAttribute("playsinline", "");
      video.style.position = "fixed";
      video.style.top = "-1px";
      video.style.left = "-1px";
      video.style.width = "1px";
      video.style.height = "1px";
      video.style.opacity = "0";
      video.style.pointerEvents = "none";

      // 創建空白影片數據
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, 1, 1);

      // 將 canvas 轉換為 blob 並創建影片 URL
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        video.src = url;
        video.play().catch(() => {
          console.warn("無法播放隱藏影片，螢幕長亮替代方案可能無效");
        });
      });

      document.body.appendChild(video);
      console.log("使用替代方案啟用螢幕長亮");
    } catch (error) {
      console.error("螢幕長亮替代方案失敗:", error);
    }
  }

  /**
   * 清理資源
   */
  cleanup() {
    this.disableWakeLock();

    // 移除事件監聽器
    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange
    );
  }
}

// 創建單例實例
const wakeLockService = new WakeLockService();

export { wakeLockService };
