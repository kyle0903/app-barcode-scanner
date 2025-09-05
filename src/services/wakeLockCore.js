/*! wakeLockCore.js
 * Screen Wake Lock helper (ES6 module).
 * - Works on Android Chrome and iOS Safari/Chrome (iOS 16.4+).
 * - Requires HTTPS or localhost.
 * - Must be called from a user gesture on iOS.
 */

class WakeLockService {
  constructor() {
    this.wakeLock = null;
    this.isSupported = "wakeLock" in navigator;
    this.enabledWanted = false;

    // bindings
    this._onVisibilityChange = this._onVisibilityChange.bind(this);
    this._onFocus = this._onFocus.bind(this);
    this._onRelease = this._onRelease.bind(this);

    this._userGestureArmed = false;
    this._boundUserGestureHandler = this._onFirstUserGesture.bind(this);
    this._inited = false;
  }

  init() {
    if (this._inited) return;
    this._inited = true;
    document.addEventListener("visibilitychange", this._onVisibilityChange);
    window.addEventListener("focus", this._onFocus);
  }

  async enable() {
    this.enabledWanted = true;

    if (!this.isSupported) {
      this._emit(false);
      return false;
    }

    // Clean any previous lock
    if (this.wakeLock && !this.wakeLock.released) {
      try {
        await this.wakeLock.release();
      } catch (e) {}
      this.wakeLock = null;
    }

    try {
      this.wakeLock = await navigator.wakeLock.request("screen");
      this.wakeLock.addEventListener("release", this._onRelease);
      this._emit(true);
      return true;
    } catch (err) {
      // Likely NotAllowedError on iOS if not in a user gesture
      this._armUserGestureOnce();
      this._emit(false);
      return false;
    }
  }

  async disable() {
    this.enabledWanted = false;
    this._disarmUserGesture();
    if (this.wakeLock && !this.wakeLock.released) {
      try {
        await this.wakeLock.release();
      } catch (e) {}
      this.wakeLock = null;
    }
    this._emit(false);
    return true;
  }

  isActive() {
    return !!(this.wakeLock && !this.wakeLock.released);
  }

  // ---- internal helpers ----

  _onRelease() {
    if (this.enabledWanted && document.visibilityState === "visible") {
      // try to re-acquire; if rejected, arm the gesture
      this.enable();
    } else {
      this._emit(false);
    }
  }

  _onVisibilityChange() {
    if (
      this.enabledWanted &&
      document.visibilityState === "visible" &&
      !this.isActive()
    ) {
      this.enable();
    }
  }

  _onFocus() {
    if (this.enabledWanted && !this.isActive()) {
      this.enable();
    }
  }

  _armUserGestureOnce() {
    if (this._userGestureArmed) return;
    this._userGestureArmed = true;
    const opts = { capture: true, once: true, passive: true };
    document.addEventListener("click", this._boundUserGestureHandler, opts);
    document.addEventListener("touchend", this._boundUserGestureHandler, opts);
    document.addEventListener("keydown", this._boundUserGestureHandler, opts);
  }

  _disarmUserGesture() {
    if (!this._userGestureArmed) return;
    this._userGestureArmed = false;
    document.removeEventListener("click", this._boundUserGestureHandler, true);
    document.removeEventListener(
      "touchend",
      this._boundUserGestureHandler,
      true
    );
    document.removeEventListener(
      "keydown",
      this._boundUserGestureHandler,
      true
    );
  }

  async _onFirstUserGesture() {
    await this.enable();
    this._disarmUserGesture();
  }

  _emit(active) {
    try {
      window.dispatchEvent(
        new CustomEvent("wakelock:state", { detail: { active: !!active } })
      );
    } catch (_) {}
  }

  // 清理資源
  cleanup() {
    this.disable();
    document.removeEventListener("visibilitychange", this._onVisibilityChange);
    window.removeEventListener("focus", this._onFocus);
  }
}

// 創建單例實例並匯出
const wakeLockService = new WakeLockService();

export { wakeLockService };
