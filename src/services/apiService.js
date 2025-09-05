import axios from "axios";

const API_BASE_URL = "http://localhost:8000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export const apiService = {
  // 獲取所有條碼
  getBarcodes: async () => {
    const response = await api.get("/barcodes");
    return response.data;
  },

  // 健康檢查
  healthCheck: async () => {
    const response = await api.get("/health");
    return response.data;
  },

  // 批量上傳條碼
  uploadBarcodes: async (codes) => {
    try {
      const response = await api.post("/barcodes/bulk", { codes });
      return response.data;
    } catch (error) {
      if (error.response && error.response.data && error.response.data.detail) {
        throw new Error(error.response.data.detail);
      }
      throw new Error("批量上傳條碼失敗");
    }
  },

  // 刪除條碼
  deleteBarcode: async (barcodeId) => {
    try {
      const response = await api.delete(`/barcodes/id/${barcodeId}`);
      return response.data;
    } catch (error) {
      if (error.response && error.response.data && error.response.data.detail) {
        throw new Error(error.response.data.detail);
      }
      throw new Error("刪除條碼失敗");
    }
  },

  // 清空所有條碼
  clearAllBarcodes: async () => {
    try {
      const response = await api.delete("/barcodes/clear");
      return response.data;
    } catch (error) {
      if (error.response && error.response.data && error.response.data.detail) {
        throw new Error(error.response.data.detail);
      }
      throw new Error("清空所有條碼失敗");
    }
  },

  // 掃描條碼
  scanBarcode: async (code) => {
    const response = await api.post("/scan", { code });
    return response.data;
  },

  // 獲取掃描歷史
  getScanHistory: async () => {
    const response = await api.get(`/scan-history`);
    return response.data;
  },

  // 獲取統計資料
  getStats: async () => {
    const response = await api.get("/stats");
    return response.data;
  },

  // 多筆條碼查詢
  searchBarcodes: async (codes) => {
    const response = await api.post("/barcodes/search", { codes });
    return response.data;
  },

  // 日期範圍查詢條碼
  getBarcodesByDateRange: async (startDate, endDate) => {
    const response = await api.post("/barcodes/date-range", {
      start_date: startDate,
      end_date: endDate,
    });
    return response.data;
  },

  // 下載excel
  downloadExcel: async (data) => {
    const response = await api.post(
      "/barcodes/download",
      { data },
      {
        responseType: "blob",
      }
    );
    return response.data;
  },

  // 同步離線掃描記錄
  syncOfflineRecords: async (records) => {
    try {
      const response = await api.post("/offline-sync", { records });
      return response.data;
    } catch (error) {
      console.error("同步離線記錄失敗:", error);
      throw error;
    }
  },

  // 獲取條碼詳細資料（所有上傳記錄和掃描歷史）
  getBarcodeDetails: async (code) => {
    const response = await api.get(
      `/barcodes/details/${encodeURIComponent(code)}`
    );
    return response.data;
  },
};
