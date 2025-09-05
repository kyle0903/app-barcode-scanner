/**
 * 離線掃描記錄服務
 * 整合條碼快取和掃描記錄功能，用於在斷網時本地存儲掃描記錄，並在網路恢復時同步到伺服器
 */

class OfflineScanService {
  constructor() {
    this.storageKey = "offline_scan_records";
    this.barcodeCacheKey = "barcode_cache";
    this.syncInProgress = false;

    // 條碼快取（記憶體）
    this.barcodeSet = new Set();
    this.barcodeMap = new Map();
    this.initialized = false;
  }

  /**
   * 添加掃描記錄到本地存儲
   * @param {Object} scanRecord - 掃描記錄
   * @param {string} scanRecord.barcode - 條碼
   * @param {string} scanRecord.result - 掃描結果 (success/error/duplicate)
   * @param {string} scanRecord.message - 結果訊息
   * @param {Object} scanRecord.barcode_info - 條碼資訊
   * @param {number} scanRecord.timestamp - 時間戳
   */
  addScanRecord(scanRecord) {
    try {
      const records = this.getOfflineRecords();
      const newRecord = {
        id: Date.now() + Math.random(), // 唯一ID
        barcode: scanRecord.barcode,
        result: scanRecord.result,
        message: scanRecord.message,
        barcode_info: scanRecord.barcode_info,
        timestamp: scanRecord.timestamp || new Date().toISOString(),
        synced: false, // 標記是否已同步
      };

      records.push(newRecord);
      this.saveOfflineRecords(records);

      console.log("掃描記錄已保存到本地:", newRecord);
      return newRecord;
    } catch (error) {
      console.error("保存掃描記錄失敗:", error);
      return null;
    }
  }

  /**
   * 獲取所有離線記錄
   */
  getOfflineRecords() {
    try {
      const records = localStorage.getItem(this.storageKey);
      return records ? JSON.parse(records) : [];
    } catch (error) {
      console.error("讀取離線記錄失敗:", error);
      return [];
    }
  }

  /**
   * 保存離線記錄到本地存儲
   */
  saveOfflineRecords(records) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(records));
    } catch (error) {
      console.error("保存離線記錄失敗:", error);
    }
  }

  /**
   * 獲取未同步的記錄
   */
  getUnsyncedRecords() {
    const records = this.getOfflineRecords();
    return records.filter((record) => !record.synced);
  }

  /**
   * 標記記錄為已同步
   */
  markAsSynced(recordIds) {
    try {
      const records = this.getOfflineRecords();
      records.forEach((record) => {
        if (recordIds.includes(record.id)) {
          record.synced = true;
        }
      });
      this.saveOfflineRecords(records);
    } catch (error) {
      console.error("標記同步狀態失敗:", error);
    }
  }

  /**
   * 清理已同步的記錄（保留最近100條）
   */
  cleanupSyncedRecords() {
    try {
      const records = this.getOfflineRecords();
      const syncedRecords = records.filter((record) => record.synced);
      const unsyncedRecords = records.filter((record) => !record.synced);

      // 保留最近100條已同步記錄
      const recentSynced = syncedRecords
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 100);

      const allRecords = [...recentSynced, ...unsyncedRecords];
      this.saveOfflineRecords(allRecords);

      console.log(`清理完成，保留 ${allRecords.length} 條記錄`);
    } catch (error) {
      console.error("清理記錄失敗:", error);
    }
  }

  /**
   * 獲取離線記錄統計
   */
  getStats() {
    const records = this.getOfflineRecords();
    const unsynced = records.filter((record) => !record.synced);

    return {
      total: records.length,
      unsynced: unsynced.length,
      synced: records.length - unsynced.length,
    };
  }

  /**
   * 清空所有記錄
   */
  clearAllRecords() {
    try {
      localStorage.removeItem(this.storageKey);
      console.log("所有離線記錄已清空");
    } catch (error) {
      console.error("清空記錄失敗:", error);
    }
  }

  // ==================== 條碼快取功能 ====================

  /**
   * 初始化條碼快取
   * @param {Array} barcodes - 條碼資料陣列
   */
  initializeBarcodeCache(barcodes) {
    this.clearBarcodeCache();

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
  barcodeExists(code) {
    return this.barcodeSet.has(code);
  }

  /**
   * 獲取條碼資料
   * @param {string} code - 條碼
   * @returns {Object|null} 條碼資料或 null
   */
  getBarcode(code) {
    return this.barcodeMap.get(code) || null;
  }

  /**
   * 更新條碼的掃描資訊
   * @param {string} code - 條碼
   */
  updateBarcodeScanInfo(code) {
    const barcode = this.barcodeMap.get(code);
    if (barcode) {
      barcode.scan_count += 1;
      barcode.last_scan_time = new Date().toISOString();
    }
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

    const barcode = this.getBarcode(code);

    if (!barcode) {
      return {
        result: "error",
        message: "❌ 非收單項目",
        barcode_info: null,
      };
    }

    // 不檢查重複，直接返回成功
    return {
      result: "success",
      message: "✅ 收單確認",
      barcode_info: barcode,
    };
  }

  /**
   * 清空條碼快取
   */
  clearBarcodeCache() {
    this.barcodeSet.clear();
    this.barcodeMap.clear();
    this.initialized = false;
  }

  /**
   * 檢查快取是否已初始化
   * @returns {boolean} 是否已初始化
   */
  isBarcodeCacheInitialized() {
    return this.initialized;
  }

  /**
   * 獲取條碼快取統計
   * @returns {Object} 統計資訊
   */
  getBarcodeCacheStats() {
    const all = Array.from(this.barcodeMap.values());
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

export const offlineScanService = new OfflineScanService();
