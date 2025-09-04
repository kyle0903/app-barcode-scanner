import React, { useState, useEffect, useCallback } from "react";
import { Box, Tabs, Tab } from "@mui/material";
import Header from "./Header";
import UploadTab from "./UploadTab";
import DataTab from "./DataTab";
import { apiService } from "../services/apiService";

const OrderReceiving = () => {
  const [activeKey, setActiveKey] = useState(0);
  const [stats, setStats] = useState({
    total_barcodes: 0,
    successful_scans: 0,
    failed_scans: 0,
  });
  const [barcodes, setBarcodes] = useState([]);

  // 載入統計資料
  const loadStats = async () => {
    try {
      const data = await apiService.getStats();
      setStats(data);
    } catch (error) {
      console.error("載入統計資料失敗:", error);
    }
  };

  // 載入條碼清單
  const loadBarcodes = async () => {
    try {
      const data = await apiService.getBarcodes();
      setBarcodes(data);
    } catch (error) {
      console.error("載入條碼清單失敗:", error);
    }
  };

  // 載入所有資料
  const loadData = useCallback(() => {
    loadStats();
    loadBarcodes();
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUploadSuccess = () => {
    loadData();
  };

  const handleDeleteBarcode = async (barcodeId) => {
    try {
      await apiService.deleteBarcode(barcodeId);
      loadData();
    } catch (error) {
      console.error("刪除條碼失敗:", error);
      alert("刪除條碼失敗: " + error.message);
    }
  };

  const handleClearAll = async () => {
    try {
      await apiService.clearAllBarcodes();
      loadData();
    } catch (error) {
      console.error("清空資料失敗:", error);
      alert("清空資料失敗: " + error.message);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Header />

      <Box
        sx={{
          borderBottom: 1,
          borderColor: "divider",
          backgroundColor: "background.paper",
        }}
      >
        <Tabs
          value={activeKey}
          onChange={(e, newValue) => setActiveKey(newValue)}
          centered
        >
          <Tab label="資料檢視" />
          <Tab label="上傳管理" />
        </Tabs>
      </Box>

      <Box
        sx={{
          flex: 1,
          overflow: "auto",
          backgroundColor: "background.default",
        }}
      >
        {activeKey === 1 && <UploadTab onUploadSuccess={handleUploadSuccess} />}
        {activeKey === 0 && (
          <DataTab
            barcodes={barcodes}
            stats={stats}
            onDeleteBarcode={handleDeleteBarcode}
            onClearAll={handleClearAll}
          />
        )}
      </Box>
    </Box>
  );
};

export default OrderReceiving;
