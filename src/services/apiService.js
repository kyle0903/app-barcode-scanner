import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const apiService = {
  // 獲取所有條碼
  getBarcodes: async () => {
    const response = await api.get('/barcodes');
    return response.data;
  },

  // 新增單個條碼
  addBarcode: async (code) => {
    const response = await api.post('/barcodes', { code });
    return response.data;
  },

  // 批量上傳條碼
  uploadBarcodes: async (codes) => {
    const response = await api.post('/barcodes/bulk', { codes });
    return response.data;
  },

  // 刪除條碼
  deleteBarcode: async (barcodeId) => {
    const response = await api.delete(`/barcodes/${barcodeId}`);
    return response.data;
  },

  // 清空所有條碼
  clearAllBarcodes: async () => {
    const response = await api.delete('/barcodes/clear');
    return response.data;
  },

  // 掃描條碼
  scanBarcode: async (code) => {
    const response = await api.post('/scan', { code });
    return response.data;
  },

  // 獲取掃描歷史
  getScanHistory: async (limit = 10) => {
    const response = await api.get(`/scan-history?limit=${limit}`);
    return response.data;
  },

  // 獲取統計資料
  getStats: async () => {
    const response = await api.get('/stats');
    return response.data;
  },
};
