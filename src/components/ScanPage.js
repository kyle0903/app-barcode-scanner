import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Box,
  Card,
  CardContent,
  Button,
  Typography,
  Paper,
  Stack,
  CircularProgress,
} from "@mui/material";
import { apiService } from "../services/apiService";
import { audioService } from "../services/audioService";
import { offlineScanService } from "../services/offlineScanService";
import { wakeLockService } from "../services/wakeLockService";

const ScanPage = () => {
  const [scanResult, setScanResult] = useState(null);

  const [scanHistory, setScanHistory] = useState([]);
  const [isOnline, setIsOnline] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [offlineStats, setOfflineStats] = useState({ total: 0, unsynced: 0 });
  const [barcodeStats, setBarcodeStats] = useState({
    total: 0,
    scanned: 0,
    notScanned: 0,
  });
  const [hasPlayedAchievement, setHasPlayedAchievement] = useState(() => {
    // 從 localStorage 讀取是否已播放過慶祝音效
    try {
      const saved = localStorage.getItem("hasPlayedAchievement");
      return saved === "true";
    } catch (error) {
      return false;
    }
  });

  // 保存慶祝音效播放狀態到 localStorage
  const saveAchievementStatus = (status) => {
    try {
      localStorage.setItem("hasPlayedAchievement", status.toString());
      setHasPlayedAchievement(status);
    } catch (error) {
      console.warn("保存慶祝音效狀態失敗:", error);
      setHasPlayedAchievement(status);
    }
  };

  // 掃描器輸入緩衝區
  const scanBuffer = useRef("");
  const scanTimeout = useRef(null);

  const loadScanHistory = useCallback(async () => {
    try {
      const data = await apiService.getScanHistory();
      setScanHistory(data);
      // API成功時，設置為線上狀態
      setIsOnline(true);
    } catch (error) {
      console.error("載入掃描歷史失敗:", error);
      // API失敗時，設置為離線狀態並使用本地記錄
      setIsOnline(false);

      // 使用本地離線記錄作為備用
      updateLocalHistory();
      console.log(`使用本地記錄顯示今日掃描歷史`);
    } finally {
      // 完成初始化
      setIsInitializing(false);
    }
  }, []);

  const loadBarcodes = useCallback(async () => {
    try {
      const data = await apiService.getBarcodes();
      offlineScanService.initializeBarcodeCache(data);
      updateBarcodeStats();
      // API成功時，設置為線上狀態
      setIsOnline(true);
    } catch (error) {
      console.error("載入條碼清單失敗:", error);
      // API失敗時，設置為離線狀態
      setIsOnline(false);
    }
  }, []);

  const loadData = useCallback(() => {
    loadScanHistory();
    loadBarcodes();
  }, [loadScanHistory, loadBarcodes]);

  // 更新同步統計
  const updateOfflineStats = () => {
    const stats = offlineScanService.getStats();
    setOfflineStats(stats);
  };

  // 更新條碼統計
  const updateBarcodeStats = () => {
    const stats = offlineScanService.getBarcodeCacheStats();
    setBarcodeStats(stats);
  };

  // 更新本地歷史記錄（用於離線狀態）
  const updateLocalHistory = () => {
    const localHistory = offlineScanService.getTodayRecords();
    setScanHistory(localHistory);
  };

  // 同步離線記錄
  const syncOfflineRecords = useCallback(
    async (isManualTrigger = false) => {
      const unsyncedRecords = offlineScanService.getUnsyncedRecords();
      if (unsyncedRecords.length === 0) {
        console.log("沒有需要同步的記錄");
        return;
      }

      // 如果是手動觸發，設置同步中狀態
      if (isManualTrigger) {
        setIsSyncing(true);
      }

      try {
        console.log(`開始同步 ${unsyncedRecords.length} 條離線記錄`);

        // 準備同步資料
        const recordsToSync = unsyncedRecords.map((record) => ({
          barcode: record.barcode,
          result: record.result,
          message: record.message,
          timestamp: record.timestamp,
        }));

        // 調用同步 API
        const result = await apiService.syncOfflineRecords(recordsToSync);
        console.log("同步結果:", result);

        // 同步成功，設置為線上狀態
        setIsOnline(true);

        // 標記為已同步
        const syncedIds = unsyncedRecords.map((record) => record.id);
        offlineScanService.markAsSynced(syncedIds);

        // 清理已同步記錄
        offlineScanService.cleanupSyncedRecords();

        // 更新統計
        updateOfflineStats();

        // 重新載入掃描歷史
        loadScanHistory();
        loadBarcodes();
      } catch (error) {
        console.error("同步離線記錄失敗:", error);
        // 同步失敗時設置為離線狀態
        setIsOnline(false);

        // 如果是手動觸發，顯示錯誤訊息
        if (isManualTrigger) {
          alert(`同步失敗：${"網路連線異常，請稍後再試"}`);
        }
      } finally {
        // 如果是手動觸發，清除同步中狀態
        if (isManualTrigger) {
          setIsSyncing(false);
        }
      }
    },
    [loadScanHistory, loadBarcodes]
  );

  // 處理掃描到的條碼
  const handleScannedCode = useCallback(
    async (barcode) => {
      if (!barcode) return;

      try {
        let result;

        // 如果本地快取已初始化，優先使用本地快取進行驗證
        if (offlineScanService.isBarcodeCacheInitialized()) {
          result = offlineScanService.localScan(barcode);

          // 更新本地快取的掃描資訊
          if (result.barcode_info) {
            offlineScanService.updateBarcodeScanInfo(result.barcode_info.code);
            updateBarcodeStats();
          }

          // 在本地掃描時快速檢查網路狀態（非阻塞）
          Promise.race([
            apiService.healthCheck(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("timeout")), 1000)
            ),
          ])
            .then(() => {
              setIsOnline(true);
            })
            .catch(() => {
              setIsOnline(false);
            });
        } else {
          // 如果快取未初始化，嘗試使用API掃描條碼
          try {
            result = await apiService.scanBarcode(barcode);
            // API成功時，設置為線上狀態
            setIsOnline(true);
          } catch (error) {
            console.error("API掃描失敗:", error);
            // API失敗時，設置為離線狀態並返回錯誤結果
            setIsOnline(false);
            result = {
              result: "error",
              message: "❌ 掃描失敗，請檢查後端連接",
              barcode_info: null,
            };
          }
        }
        setScanResult(result);

        // 播放對應音效
        try {
          if (result.result === "success") {
            // 先播放普通成功音效
            await audioService.playSuccessSound();

            const currentStats = offlineScanService.getBarcodeCacheStats();
            const progress = (currentStats.scanned / currentStats.total) * 100;

            // 檢查是否第一次達成 100% 且尚未播放過慶祝音效
            if (progress >= 100 && hasPlayedAchievement == false) {
              // 稍微延遲後播放慶祝音效
              await new Promise((resolve) => setTimeout(resolve, 100));
              await audioService.playAchievementSound();
              saveAchievementStatus(true);
            }
          } else {
            await audioService.playErrorSound();
          }
        } catch (error) {
          console.warn("音效播放失敗:", error);
        }

        // 保存到離線記錄（包含所有掃描結果）
        const scanRecord = {
          barcode: result.barcode_info?.code || barcode,
          result: result.result,
          message: result.message,
          barcode_info: result.barcode_info,
          timestamp: new Date().toISOString(),
        };
        offlineScanService.addScanRecord(scanRecord);
        updateOfflineStats();

        // 如果是離線狀態，立即更新本地歷史記錄顯示
        if (!isOnline) {
          updateLocalHistory();
        }

        // 嘗試異步同步，不等待結果，並更新線上狀態
        syncOfflineRecords().catch((error) => {
          console.log("背景同步失敗:", error);
          // 背景同步失敗時，確保設置為離線狀態
          setIsOnline(false);
        });

        setTimeout(() => setScanResult(null), 2000);
      } catch (error) {
        console.error("掃描失敗:", error);
        // 顯示錯誤結果
        setScanResult({
          result: "error",
          message: "掃描失敗，請稍後再試",
          barcode_info: null,
        });
        try {
          await audioService.playErrorSound();
        } catch (error) {
          console.warn("音效播放失敗:", error);
        }
        setTimeout(() => setScanResult(null), 2000);
      }
    },
    [syncOfflineRecords, hasPlayedAchievement]
  );

  useEffect(() => {
    loadData();
    // 初始化音效服務
    audioService.init();
    // 設定音量為100%
    audioService.setVolume(1.0);

    // 初始化螢幕長亮（預設啟用）
    wakeLockService.init();

    // 更新同步統計
    updateOfflineStats();

    // 更新條碼統計
    updateBarcodeStats();

    // 清理函數
    return () => {
      wakeLockService.cleanup();
    };
  }, [loadData]);

  // 當條碼統計更新時，檢查是否需要重置慶祝狀態
  useEffect(() => {
    if (barcodeStats.total > 0) {
      const progress = (barcodeStats.scanned / barcodeStats.total) * 100;
      // 如果進度不到100%，重置慶祝狀態，讓下次達到100%時可以再次播放
      if (progress < 100 && hasPlayedAchievement) {
        saveAchievementStatus(false);
      }
    }
  }, [barcodeStats, hasPlayedAchievement]);

  useEffect(() => {
    // 全域鍵盤事件監聽，用於處理掃描器輸入
    const handleGlobalKeyPress = (e) => {
      // 掃描器通常會快速連續輸入字符，然後以 Enter 結束
      if (e.key === "Enter") {
        // 處理完整的掃描輸入
        const scannedCode = scanBuffer.current.trim();
        if (scannedCode) {
          handleScannedCode(scannedCode);
          scanBuffer.current = "";
        }
      } else if (e.key.length === 1) {
        // 累積掃描字符
        scanBuffer.current += e.key;

        // 清除之前的超時
        if (scanTimeout.current) {
          clearTimeout(scanTimeout.current);
        }

        // 設定超時，如果 100ms 內沒有新字符，清空緩衝區
        scanTimeout.current = setTimeout(() => {
          scanBuffer.current = "";
        }, 100);
      }
    };

    // 添加事件監聽
    document.addEventListener("keypress", handleGlobalKeyPress);

    return () => {
      document.removeEventListener("keypress", handleGlobalKeyPress);
      if (scanTimeout.current) {
        clearTimeout(scanTimeout.current);
      }
    };
  }, [handleScannedCode]);

  return (
    <Box sx={{ minHeight: "100vh", backgroundColor: "#f5f5f5" }}>
      <Box sx={{ padding: "16px", maxWidth: "600px", margin: "0 auto" }}>
        {/* 離線同步按鈕 - 只在初始化完成且離線狀態且有未同步記錄時顯示 */}
        {!isInitializing && !isOnline && offlineStats.unsynced > 0 && (
          <Card sx={{ marginBottom: "16px" }}>
            <CardContent>
              <Box sx={{ textAlign: "center" }}>
                <Button
                  onClick={() => syncOfflineRecords(true)}
                  variant="contained"
                  color="primary"
                  size="large"
                  disabled={isSyncing}
                  startIcon={
                    isSyncing ? (
                      <CircularProgress size={20} color="inherit" />
                    ) : null
                  }
                  sx={{ marginBottom: 1 }}
                >
                  {isSyncing
                    ? "同步中..."
                    : `同步離線記錄 (${offlineStats.unsynced} 條)`}
                </Button>
                <Typography variant="body2" color="text.secondary">
                  {isSyncing
                    ? "正在同步本地記錄到伺服器..."
                    : "點擊同步本地記錄到伺服器"}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* 條碼統計 */}
        <Card sx={{ marginBottom: "16px" }}>
          <CardContent>
            <Typography variant="h6" component="h4" gutterBottom>
              收單統計
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 2,
                textAlign: "center",
              }}
            >
              <Box>
                <Typography variant="h4" color="primary.main" fontWeight="bold">
                  {barcodeStats.total}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  總收單數
                </Typography>
              </Box>
              <Box>
                <Typography variant="h4" color="success.main" fontWeight="bold">
                  {barcodeStats.scanned}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  已掃描數
                </Typography>
              </Box>
              <Box>
                <Typography variant="h4" color="warning.main" fontWeight="bold">
                  {barcodeStats.notScanned}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  待掃描數
                </Typography>
              </Box>
            </Box>
            {barcodeStats.total > 0 && (
              <Box sx={{ marginTop: 2 }}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  textAlign="center"
                >
                  掃描進度:{" "}
                  {Math.round(
                    (barcodeStats.scanned / barcodeStats.total) * 100
                  )}
                  %
                </Typography>
                <Box
                  sx={{
                    width: "100%",
                    height: 8,
                    backgroundColor: "grey.200",
                    borderRadius: 4,
                    marginTop: 1,
                    overflow: "hidden",
                  }}
                >
                  <Box
                    sx={{
                      width: `${
                        (barcodeStats.scanned / barcodeStats.total) * 100
                      }%`,
                      height: "100%",
                      backgroundColor: "success.main",
                      transition: "width 0.3s ease",
                    }}
                  />
                </Box>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* 掃描結果 - 大透明方框 */}
        {scanResult && (
          <Box
            sx={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 9999,
              width: "400px",
              height: "200px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "16px",
              backgroundColor:
                scanResult.result === "success"
                  ? "rgba(76, 175, 80, 0.8)" // 綠色
                  : "rgba(244, 67, 54, 0.8)", // 紅色
              backdropFilter: "blur(10px)",
              border: `3px solid ${
                scanResult.result === "success"
                  ? "rgba(76, 175, 80, 1)"
                  : "rgba(244, 67, 54, 1)"
              }`,
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
            }}
          >
            <Box sx={{ textAlign: "center", color: "white" }}>
              <Typography
                variant="h4"
                fontWeight="bold"
                sx={{
                  marginBottom: 1,
                  textShadow: "2px 2px 4px rgba(0, 0, 0, 0.5)",
                }}
              >
                {scanResult.barcode_info
                  ? scanResult.barcode_info.code
                  : "掃描結果"}
              </Typography>
              <Typography
                variant="h6"
                sx={{
                  marginBottom: 1,
                  textShadow: "1px 1px 2px rgba(0, 0, 0, 0.5)",
                }}
              >
                {scanResult.message}
              </Typography>
              {scanResult.barcode_info?.scan_count && (
                <Typography
                  variant="body1"
                  sx={{
                    textShadow: "1px 1px 2px rgba(0, 0, 0, 0.5)",
                  }}
                >
                  掃描次數: {scanResult.barcode_info.scan_count}
                </Typography>
              )}
            </Box>
          </Box>
        )}

        {/* 最近掃描記錄 */}
        <Card>
          <CardContent>
            <Typography variant="h6" component="h4" gutterBottom>
              今日掃描記錄
            </Typography>
            {scanHistory.length === 0 ? (
              <Typography
                variant="body2"
                color="text.secondary"
                textAlign="center"
              >
                尚無掃描記錄
              </Typography>
            ) : (
              <Stack spacing={1}>
                {scanHistory.map((scan, index) => (
                  <Paper
                    key={index}
                    elevation={1}
                    sx={{
                      padding: "12px",
                      backgroundColor:
                        scan.result === "success" ? "#d4edda" : "#f8d7da",
                      color: scan.result === "success" ? "#155724" : "#721c24",
                      border: `1px solid ${
                        scan.result === "success" ? "#c3e6cb" : "#f5c6cb"
                      }`,
                    }}
                  >
                    <Typography variant="body1" fontWeight="bold">
                      {scan.barcode}
                    </Typography>
                    <Typography variant="body2">
                      {scan.result === "success"
                        ? "✅ 收單確認"
                        : "❌ 非收單項目"}{" "}
                      - {new Date(scan.timestamp).toLocaleString()}
                    </Typography>
                  </Paper>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default ScanPage;
