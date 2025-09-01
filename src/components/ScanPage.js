import React, { useState, useEffect, useRef } from "react";
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
  ArrowBack,
} from "@mui/icons-material";
import { apiService } from "../services/apiService";
import { audioService } from "../services/audioService";
import { barcodeCache } from "../services/barcodeCache";

const ScanPage = () => {
  const [scanResult, setScanResult] = useState(null);
  const [volume, setVolume] = useState(70);
  const [isScanning, setIsScanning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [scanHistory, setScanHistory] = useState([]);

  // 掃描器輸入緩衝區
  const scanBuffer = useRef("");
  const scanTimeout = useRef(null);

  // 載入掃描歷史
  useEffect(() => {
    const loadScanHistory = async () => {
      try {
        const data = await apiService.getScanHistory(10);
        setScanHistory(data);
      } catch (error) {
        console.error("載入掃描歷史失敗:", error);
      }
    };
    loadScanHistory();
  }, []);

  useEffect(() => {
    // 全域鍵盤事件監聽，用於處理掃描器輸入
    const handleGlobalKeyPress = (e) => {
      // 如果正在輸入框中輸入，不處理掃描
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
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

    // 添加全域事件監聽
    document.addEventListener("keypress", handleGlobalKeyPress);

    // 設定掃描狀態
    setIsScanning(true);

    return () => {
      document.removeEventListener("keypress", handleGlobalKeyPress);
      if (scanTimeout.current) {
        clearTimeout(scanTimeout.current);
      }
      setIsScanning(false);
    };
  }, []);

  // 處理掃描到的條碼
  const handleScannedCode = async (barcode) => {
    if (!barcode) return;

    try {
      let result;

      // 如果本地快取已初始化，先使用本地快取進行驗證
      if (barcodeCache.isInitialized()) {
        result = barcodeCache.localScan(barcode);

        // 如果是成功掃描，需要調用 API 更新伺服器端的掃描記錄
        if (result.result === "success") {
          try {
            const serverResult = await apiService.scanBarcode(barcode);
            // 使用伺服器返回的最新資料
            result = serverResult;

            // 更新本地快取中的掃描資訊
            if (serverResult.barcode_info) {
              barcodeCache.updateScanInfo(
                serverResult.barcode_info.code,
                serverResult.barcode_info.scan_count,
                serverResult.barcode_info.last_scan_time
              );
            }
          } catch (error) {
            console.error("更新伺服器掃描記錄失敗:", error);
            // 即使伺服器更新失敗，仍然顯示本地驗證結果
            console.log("使用本地快取結果");
          }
        }
      } else {
        // 如果快取未初始化，使用原來的 API 方式
        console.log("快取未初始化，使用 API 掃描");
        result = await apiService.scanBarcode(barcode);
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

      // 更新掃描歷史
      const newScan = {
        barcode: result.barcode_info?.code || barcode,
        result: result.result,
        timestamp: new Date().toISOString(),
      };
      setScanHistory((prev) => [newScan, ...prev.slice(0, 9)]);

      // 2秒後隱藏結果
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
  };

  const handleVolumeChange = (event, newValue) => {
    setVolume(newValue);
    audioService.setVolume(newValue / 100);
  };

  const testSound = (type) => {
    if (type === "success") {
      audioService.playSuccessSound();
    } else {
      audioService.playErrorSound();
    }
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
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => window.history.back()}
            sx={{ mr: 2 }}
          >
            <ArrowBack />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
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
              <Box>
                <Typography variant="h6" fontWeight="bold">
                  {isScanning ? "掃描器已啟動" : "掃描器未啟動"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {isScanning ? "可直接掃描條碼" : "請檢查掃描器連接"}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* 掃描結果 */}
        {scanResult && (
          <Card sx={{ marginBottom: "16px" }}>
            <CardContent>
              <Alert
                severity={getResultSeverity(scanResult.result)}
                sx={{ marginBottom: 0 }}
              >
                <strong>
                  條碼: {scanResult.barcode_info?.code || scanResult.barcode}
                </strong>
                <br />
                狀態: {scanResult.message}
                {scanResult.barcode_info && (
                  <>
                    <br />
                    掃描次數: {scanResult.barcode_info.scan_count}
                  </>
                )}
              </Alert>
            </CardContent>
          </Card>
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
              <Stack direction="row" spacing={2}>
                <Button
                  onClick={() => testSound("success")}
                  variant="contained"
                  color="success"
                  size="small"
                >
                  測試成功音效
                </Button>
                <Button
                  onClick={() => testSound("error")}
                  variant="contained"
                  color="error"
                  size="small"
                >
                  測試錯誤音效
                </Button>
              </Stack>
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
                {scanHistory.slice(0, 5).map((scan, index) => (
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
                      {scan.result === "success" ? "✅ 成功" : "❌ 失敗"} -{" "}
                      {new Date(scan.timestamp).toLocaleString()}
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
