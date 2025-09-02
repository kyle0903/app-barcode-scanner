import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Box,
  Card,
  CardContent,
  Button,
  Slider,
  Typography,
  Alert,
  Paper,
  Stack,
  IconButton,
  AppBar,
  Toolbar,
} from "@mui/material";
import {
  VolumeUp,
  VolumeOff,
  QrCodeScanner,
  Settings,
} from "@mui/icons-material";
import { apiService } from "../services/apiService";
import { audioService } from "../services/audioService";
import { offlineScanService } from "../services/offlineScanService";

const ScanPage = () => {
  const [scanResult, setScanResult] = useState(null);
  const [volume, setVolume] = useState(100);
  const [isScanning, setIsScanning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [scanHistory, setScanHistory] = useState([]);
  const [isOnline, setIsOnline] = useState(false);
  const [offlineStats, setOfflineStats] = useState({ total: 0, unsynced: 0 });
  const [barcodeStats, setBarcodeStats] = useState({
    total: 0,
    scanned: 0,
    notScanned: 0,
  });

  // 掃描器輸入緩衝區
  const scanBuffer = useRef("");
  const scanTimeout = useRef(null);

  const loadScanHistory = useCallback(async () => {
    try {
      const data = await apiService.getScanHistory(100);
      setScanHistory(data);
    } catch (error) {
      console.error("載入掃描歷史失敗:", error);
    }
  }, []);

  const loadBarcodes = useCallback(async () => {
    try {
      const data = await apiService.getBarcodes();
      offlineScanService.initializeBarcodeCache(data);
      updateBarcodeStats();
    } catch (error) {
      console.error("載入條碼清單失敗:", error);
    }
  }, []);

  const loadData = useCallback(() => {
    loadScanHistory();
    loadBarcodes();
  }, [loadScanHistory, loadBarcodes]);

  // 更新離線統計
  const updateOfflineStats = () => {
    const stats = offlineScanService.getStats();
    setOfflineStats(stats);
  };

  // 更新條碼統計
  const updateBarcodeStats = () => {
    const stats = offlineScanService.getBarcodeCacheStats();
    setBarcodeStats(stats);
  };

  // 檢查後端連接
  const checkBackendConnection = async () => {
    try {
      const isConnected = await offlineScanService.checkBackendConnection();
      setIsOnline(isConnected);
      console.log("後端連接狀態:", isConnected ? "已連接" : "未連接");
    } catch (error) {
      console.error("檢查後端連接失敗:", error);
      setIsOnline(false);
    }
  };

  // 同步離線記錄
  const syncOfflineRecords = useCallback(async () => {
    if (!isOnline) {
      console.log("後端未連接，跳過同步");
      return;
    }

    const unsyncedRecords = offlineScanService.getUnsyncedRecords();
    if (unsyncedRecords.length === 0) {
      console.log("沒有需要同步的記錄");
      return;
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

      // 標記為已同步
      const syncedIds = unsyncedRecords.map((record) => record.id);
      offlineScanService.markAsSynced(syncedIds);

      // 清理已同步記錄
      offlineScanService.cleanupSyncedRecords();

      // 更新統計
      updateOfflineStats();

      // 重新載入掃描歷史
      loadScanHistory();
    } catch (error) {
      console.error("同步離線記錄失敗:", error);
      // 同步失敗時不影響掃描功能，只是記錄錯誤
    }
  }, [isOnline, loadScanHistory]);

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
        } else {
          // 如果快取未初始化且後端連接正常，嘗試使用API掃描條碼
          if (isOnline) {
            try {
              result = await apiService.scanBarcode(barcode);
            } catch (error) {
              console.error("API掃描失敗:", error);
              // API失敗時，返回錯誤結果
              result = {
                result: "error",
                message: "❌ 掃描失敗，請檢查後端連接",
                barcode_info: null,
              };
            }
          } else {
            // 後端未連接且無快取時，無法驗證
            result = {
              result: "error",
              message: "❌ 後端未連接且無條碼快取，無法驗證",
              barcode_info: null,
            };
          }
        }
        setScanResult(result);

        // 播放對應音效
        if (result.result === "success") {
          audioService.playSuccessSound();
        } else if (result.result === "duplicate") {
          audioService.playDuplicateSound();
        } else {
          audioService.playErrorSound();
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

        if (isOnline) {
          // 異步同步，不等待結果
          syncOfflineRecords().catch((error) => {
            console.log("背景同步失敗:", error);
          });
        }

        setTimeout(() => setScanResult(null), 2000);
      } catch (error) {
        console.error("掃描失敗:", error);
        // 顯示錯誤結果
        setScanResult({
          result: "error",
          message: "掃描失敗，請稍後再試",
          barcode_info: null,
        });
        audioService.playErrorSound();
        setTimeout(() => setScanResult(null), 2000);
      }
    },
    [isOnline, syncOfflineRecords]
  );

  useEffect(() => {
    loadData();
    // 初始化音效服務
    audioService.init();

    // 更新同步統計
    updateOfflineStats();

    // 更新條碼統計
    updateBarcodeStats();

    // 檢查後端連接狀態
    checkBackendConnection();

    // 定期檢查後端連接狀態（每10秒）
    const intervalId = setInterval(() => {
      checkBackendConnection();
    }, 10000);

    // 返回清理函數
    return () => {
      clearInterval(intervalId);
    };
  }, [loadData, syncOfflineRecords]);

  useEffect(() => {
    // 檢查頁面是否可見和是否有焦點
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // 頁面不可見時，停止掃描器
        setIsScanning(false);
        console.log("頁面不可見，掃描器已停止");
      } else {
        // 頁面可見時，檢查是否有焦點
        if (document.hasFocus()) {
          setIsScanning(true);
          console.log("頁面可見且有焦點，掃描器已啟動");
        } else {
          setIsScanning(false);
          console.log("頁面可見但無焦點，掃描器已停止");
        }
      }
    };

    // 檢查頁面焦點變化
    const handleFocusChange = () => {
      if (document.hidden) {
        return; // 如果頁面不可見，不處理焦點變化
      }

      if (document.hasFocus()) {
        setIsScanning(true);
        console.log("頁面獲得焦點，掃描器已啟動");
      } else {
        setIsScanning(false);
        console.log("頁面失去焦點，掃描器已停止");
      }
    };

    // 全域鍵盤事件監聽，用於處理掃描器輸入
    const handleGlobalKeyPress = (e) => {
      // 只有在頁面可見且掃描器啟動時才處理
      if (document.hidden || !isScanning) {
        return;
      }

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
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocusChange);
    window.addEventListener("blur", handleFocusChange);

    // 初始設定掃描狀態
    const initialScanningState = !document.hidden && document.hasFocus();
    setIsScanning(initialScanningState);
    console.log("初始掃描狀態:", initialScanningState ? "啟動" : "停止");

    return () => {
      document.removeEventListener("keypress", handleGlobalKeyPress);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocusChange);
      window.removeEventListener("blur", handleFocusChange);
      if (scanTimeout.current) {
        clearTimeout(scanTimeout.current);
      }
      setIsScanning(false);
    };
  }, [loadData, handleScannedCode, isScanning]);

  const handleVolumeChange = (event, newValue) => {
    setVolume(newValue);
    audioService.setVolume(newValue / 100);
  };

  const getResultSeverity = (result) => {
    switch (result) {
      case "success":
        return "success";
      case "error":
        return "error";
      case "duplicate":
        return "warning";
      default:
        return "info";
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", backgroundColor: "#f5f5f5" }}>
      {/* 獨立的頂部導航欄 */}
      <AppBar position="static" sx={{ backgroundColor: "#1976d2" }}>
        <Toolbar>
          <Typography
            variant="h4"
            component="div"
            sx={{
              flexGrow: 1,
              textAlign: "center",
              fontWeight: "bold",
            }}
          >
            條碼掃描器
          </Typography>
          <IconButton
            color="inherit"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box sx={{ padding: "16px", maxWidth: "600px", margin: "0 auto" }}>
        {/* 掃描狀態指示器 */}
        <Card sx={{ marginBottom: "16px" }}>
          <CardContent>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                padding: 2,
                borderRadius: 2,
                backgroundColor: isScanning
                  ? "rgba(76, 175, 80, 0.1)"
                  : "rgba(158, 158, 158, 0.1)",
                border: `2px solid ${isScanning ? "#4caf50" : "#9e9e9e"}`,
              }}
            >
              <QrCodeScanner
                sx={{
                  color: isScanning ? "#4caf50" : "#9e9e9e",
                  fontSize: "2rem",
                }}
              />
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" fontWeight="bold">
                  {isScanning ? "掃描器已啟動" : "掃描器未啟動"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {isScanning ? "可直接掃描條碼" : "請檢查掃描器連接"}
                </Typography>
              </Box>
              <Box sx={{ textAlign: "right" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography
                    variant="body2"
                    color={isOnline ? "success.main" : "error.main"}
                    fontWeight="bold"
                  >
                    {isOnline ? "🟢 線上" : "🔴 離線"}
                  </Typography>
                </Box>
                {offlineStats.unsynced > 0 && (
                  <Typography variant="caption" color="warning.main">
                    待同步: {offlineStats.unsynced} 條
                  </Typography>
                )}
              </Box>
            </Box>
          </CardContent>
        </Card>

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
                  : scanResult.result === "duplicate"
                  ? "rgba(255, 193, 7, 0.8)" // 黃色
                  : "rgba(244, 67, 54, 0.8)", // 紅色
              backdropFilter: "blur(10px)",
              border: `3px solid ${
                scanResult.result === "success"
                  ? "rgba(76, 175, 80, 1)"
                  : scanResult.result === "duplicate"
                  ? "rgba(255, 193, 7, 1)"
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

        {/* 設定面板 */}
        {showSettings && (
          <Card sx={{ marginBottom: "16px" }}>
            <CardContent>
              <Typography variant="h6" component="h4" gutterBottom>
                音效設定
              </Typography>
              <Box sx={{ marginBottom: "16px" }}>
                <Typography variant="body2" gutterBottom>
                  音量: {volume}%
                </Typography>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                  }}
                >
                  <VolumeOff />
                  <Slider
                    value={volume}
                    onChange={handleVolumeChange}
                    min={0}
                    max={100}
                    step={10}
                    valueLabelDisplay="auto"
                    sx={{ flex: 1 }}
                  />
                  <VolumeUp />
                </Box>
              </Box>

              {/* 離線同步設定 */}
              <Typography variant="h6" component="h4" gutterBottom>
                離線同步
              </Typography>
              <Box sx={{ marginBottom: "16px" }}>
                <Typography variant="body2" gutterBottom>
                  本地記錄: {offlineStats.total} 條，未同步:{" "}
                  {offlineStats.unsynced} 條
                </Typography>
                <Stack direction="row" spacing={2}>
                  <Button
                    onClick={syncOfflineRecords}
                    variant="outlined"
                    color="primary"
                    size="small"
                    disabled={!isOnline || offlineStats.unsynced === 0}
                  >
                    手動同步
                  </Button>
                </Stack>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* 最近掃描記錄 */}
        <Card>
          <CardContent>
            <Typography variant="h6" component="h4" gutterBottom>
              最近掃描記錄
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
                        scan.result === "success"
                          ? "#d4edda"
                          : scan.result === "duplicate"
                          ? "#fff3cd"
                          : "#f8d7da",
                      color:
                        scan.result === "success"
                          ? "#155724"
                          : scan.result === "duplicate"
                          ? "#856404"
                          : "#721c24",
                      border: `1px solid ${
                        scan.result === "success"
                          ? "#c3e6cb"
                          : scan.result === "duplicate"
                          ? "#ffeaa7"
                          : "#f5c6cb"
                      }`,
                    }}
                  >
                    <Typography variant="body1" fontWeight="bold">
                      {scan.barcode}
                    </Typography>
                    <Typography variant="body2">
                      {scan.result === "success"
                        ? "✅ 收單確認"
                        : scan.result === "duplicate"
                        ? "⚠️ 收單已確認"
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
