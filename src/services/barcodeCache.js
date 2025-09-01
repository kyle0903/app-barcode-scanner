/**
 * 本地條碼快取服務
 * 提供條碼資料的本地存储和快速查詢功能
 */

class BarcodeCacheService {
  constructor() {
    // 使用 Set 來存儲條碼，提供 O(1) 的查詢速度
    this.barcodeSet = new Set();
    // 使用 Map 來存儲完整的條碼資料，包含掃描次數等資訊
    this.barcodeMap = new Map();
    this.initialized = false;
  }

  /**
   * 初始化快取，載入所有條碼資料
   * @param {Array} barcodes - 條碼資料陣列
   */
  initialize(barcodes) {
    this.clear();

    barcodes.forEach((barcode) => {
      this.barcodeSet.add(barcode.code);
      this.barcodeMap.set(barcode.code, {
        id: barcode.id,
        code: barcode.code,
        upload_time: barcode.upload_time,
        scan_count: barcode.scan_count,
        last_scan_time: barcode.last_scan_time,
      });
    });

    this.initialized = true;
    console.log(`條碼快取已初始化：${this.barcodeSet.size} 筆條碼`);
  }

  /**
   * 檢查條碼是否存在
   * @param {string} code - 條碼
   * @returns {boolean} 是否存在
   */
  exists(code) {
    return this.barcodeSet.has(code);
  }

  /**
   * 獲取條碼資料
   * @param {string} code - 條碼
   * @returns {Object|null} 條碼資料或 null
   */
  get(code) {
    return this.barcodeMap.get(code) || null;
  }

  /**
   * 新增條碼到快取
   * @param {Object} barcode - 條碼資料
   */
  add(barcode) {
    this.barcodeSet.add(barcode.code);
    this.barcodeMap.set(barcode.code, {
      id: barcode.id,
      code: barcode.code,
      upload_time: barcode.upload_time,
      scan_count: barcode.scan_count || 0,
      last_scan_time: barcode.last_scan_time || null,
    });
  }

  /**
   * 從快取中移除條碼
   * @param {string} code - 條碼
   */
  remove(code) {
    this.barcodeSet.delete(code);
    this.barcodeMap.delete(code);
  }

  /**
   * 更新條碼的掃描資訊
   * @param {string} code - 條碼
   * @param {number} scan_count - 掃描次數
   * @param {string} last_scan_time - 最後掃描時間
   */
  updateScanInfo(code, scan_count, last_scan_time) {
    const barcode = this.barcodeMap.get(code);
    if (barcode) {
      barcode.scan_count = scan_count;
      barcode.last_scan_time = last_scan_time;
    }
  }

  /**
   * 批量新增條碼
   * @param {Array} barcodes - 條碼陣列
   */
  addBatch(barcodes) {
    barcodes.forEach((barcode) => this.add(barcode));
    console.log(`批量新增 ${barcodes.length} 筆條碼到快取`);
  }

  /**
   * 清空快取
   */
  clear() {
    this.barcodeSet.clear();
    this.barcodeMap.clear();
    this.initialized = false;
  }

  /**
   * 獲取快取大小
   * @returns {number} 快取中的條碼數量
   */
  size() {
    return this.barcodeSet.size;
  }

  /**
   * 獲取所有條碼資料
   * @returns {Array} 所有條碼資料
   */
  getAll() {
    return Array.from(this.barcodeMap.values());
  }

  /**
   * 檢查快取是否已初始化
   * @returns {boolean} 是否已初始化
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * 本地掃描驗證
   * @param {string} code - 條碼
   * @returns {Object} 掃描結果
   */
  localScan(code) {
    if (!this.initialized) {
      throw new Error("條碼快取尚未初始化");
    }

    const barcode = this.get(code);

    if (!barcode) {
      return {
        result: "not_found",
        message: "條碼不存在於資料庫中",
        barcode_info: null,
      };
    }

    // 檢查是否已經掃描過
    if (barcode.scan_count > 0) {
      return {
        result: "duplicate",
        message: `此條碼已掃描過 ${barcode.scan_count} 次`,
        barcode_info: barcode,
      };
    }

    return {
      result: "success",
      message: "掃描成功",
      barcode_info: barcode,
    };
  }

  /**
   * 獲取快取統計資訊
   * @returns {Object} 統計資訊
   */
  getStats() {
    const all = this.getAll();
    const scanned = all.filter((b) => b.scan_count > 0);
    const notScanned = all.filter((b) => b.scan_count === 0);

    return {
      total: all.length,
      scanned: scanned.length,
      notScanned: notScanned.length,
      initialized: this.initialized,
    };
  }
}

// 創建單例實例
export const barcodeCache = new BarcodeCacheService();
export default barcodeCache;
