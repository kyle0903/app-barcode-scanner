import React, { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Button,
  TextField,
  Typography,
  Alert,
  Paper,
  Chip,
  Stack,
} from "@mui/material";
import { Add, Upload } from "@mui/icons-material";
import { apiService } from "../services/apiService";

const UploadTab = ({ onUploadSuccess }) => {
  const [manualBarcode, setManualBarcode] = useState("");
  const [barcodeList, setBarcodeList] = useState([]);
  const [notification, setNotification] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  const showNotification = (message, severity = "success") => {
    setNotification({ message, severity });
    setTimeout(() => setNotification(null), 3000);
  };

  // 添加條碼到列表（支持多筆輸入）
  const handleAddBarcode = () => {
    const input = manualBarcode.trim();
    if (!input) {
      showNotification("請輸入條碼！", "error");
      return;
    }

    // 分割輸入的條碼（支持空格、換行、逗號、分號等分隔符）
    const newBarcodes = input
      .split(/[\s\n,;]+/) // 用空白符號、換行、逗號、分號分隔
      .map((barcode) => barcode.trim())
      .filter((barcode) => barcode.length > 0); // 過濾空字串

    if (newBarcodes.length === 0) {
      showNotification("請輸入有效的條碼！", "error");
      return;
    }

    // 檢查重複條碼
    const duplicates = newBarcodes.filter((barcode) =>
      barcodeList.includes(barcode)
    );
    const uniqueNewBarcodes = newBarcodes.filter(
      (barcode) => !barcodeList.includes(barcode)
    );

    if (uniqueNewBarcodes.length === 0) {
      showNotification("所有條碼都已存在於列表中！", "error");
      return;
    }

    // 添加新條碼到列表
    setBarcodeList([...barcodeList, ...uniqueNewBarcodes]);
    setManualBarcode("");

    // 顯示添加結果
    let message = `成功添加 ${uniqueNewBarcodes.length} 筆條碼！`;
    if (duplicates.length > 0) {
      message += ` (跳過 ${duplicates.length} 筆重複條碼)`;
    }
    showNotification(message);
  };

  // 從列表中移除條碼
  const handleRemoveBarcode = (index) => {
    const newList = barcodeList.filter((_, i) => i !== index);
    setBarcodeList(newList);
  };

  // 批量上傳條碼
  const handleBatchUpload = async () => {
    if (barcodeList.length === 0) {
      showNotification("請先添加條碼到列表！", "error");
      return;
    }

    setIsLoading(true);
    setUploadResult(null);

    try {
      const response = await apiService.uploadBarcodes(barcodeList);

      // 使用新的回傳格式
      setUploadResult({
        total: response.total,
        added: response.added_count,
        duplicates: response.duplicate_count,
        message: response.message,
        addedBarcodes: response.added_barcodes || [],
        duplicateBarcodes: response.duplicate_barcodes || [],
      });
      setBarcodeList([]);
      onUploadSuccess();
    } catch (error) {
      showNotification("上傳失敗: " + error.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  // 清空列表
  const handleClearList = () => {
    setBarcodeList([]);
    setUploadResult(null);
    showNotification("列表已清空！");
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      // Ctrl+Enter 或 Cmd+Enter 添加條碼
      e.preventDefault();
      handleAddBarcode();
    }
  };

  return (
    <Box sx={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      {notification && (
        <Alert
          severity={notification.severity}
          onClose={() => setNotification(null)}
          sx={{ marginBottom: "20px" }}
        >
          {notification.message}
        </Alert>
      )}

      {/* 手動輸入條碼區域 */}
      <Card sx={{ marginBottom: "20px" }}>
        <CardContent>
          <Typography variant="h5" component="h3" gutterBottom>
            手動輸入條碼
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            支持一次輸入多筆條碼，用空格、換行、逗號或分號分隔，按 Ctrl+Enter
            或點擊「添加」按鈕
          </Typography>

          <Box
            sx={{ display: "flex", alignItems: "center", gap: 2, marginTop: 2 }}
          >
            <TextField
              value={manualBarcode}
              onChange={(e) => setManualBarcode(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="輸入條碼，多筆用空格分隔，例如：123456 789012 345678"
              disabled={isLoading}
              multiline
              rows={3}
              sx={{ flex: 1 }}
            />
            <Button
              onClick={handleAddBarcode}
              disabled={isLoading}
              variant="contained"
              startIcon={<Add />}
              sx={{
                background: "rgb(54, 98, 139)",
                "&:hover": {
                  background: "rgb(54, 98, 139,0.7)",
                },
              }}
            >
              添加
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* 條碼列表區域 */}
      {barcodeList.length > 0 && (
        <Card sx={{ marginBottom: "20px" }}>
          <CardContent>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 2,
              }}
            >
              <Typography variant="h6" component="h4">
                待上傳條碼列表 ({barcodeList.length} 筆)
              </Typography>
              <Button
                onClick={handleClearList}
                variant="outlined"
                color="error"
                size="small"
              >
                清空列表
              </Button>
            </Box>

            <Paper
              sx={{
                padding: 2,
                backgroundColor: "#f8f9fa",
                maxHeight: 200,
                overflow: "auto",
              }}
            >
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {barcodeList.map((barcode, index) => (
                  <Chip
                    key={index}
                    label={barcode}
                    onDelete={() => handleRemoveBarcode(index)}
                    color="primary"
                    variant="outlined"
                  />
                ))}
              </Stack>
            </Paper>

            <Box sx={{ display: "flex", gap: 2, marginTop: 2 }}>
              <Button
                onClick={handleBatchUpload}
                disabled={isLoading}
                variant="contained"
                startIcon={<Upload />}
                sx={{
                  background: "rgb(34, 139, 34)",
                  "&:hover": {
                    background: "rgb(34, 139, 34,0.7)",
                  },
                }}
              >
                {isLoading ? "上傳中..." : `上傳 ${barcodeList.length} 筆條碼`}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* 上傳結果區域 */}
      {uploadResult && (
        <Card>
          <CardContent>
            <Typography variant="h6" component="h4" gutterBottom>
              上傳結果
            </Typography>
            <Alert severity="success" sx={{ marginBottom: 2 }}>
              {uploadResult.message}
            </Alert>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 2,
                textAlign: "center",
                marginBottom: 3,
              }}
            >
              <Paper sx={{ padding: 2, backgroundColor: "#e3f2fd" }}>
                <Typography variant="h4" color="primary.main" fontWeight="bold">
                  {uploadResult.total}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  總條碼數
                </Typography>
              </Paper>
              <Paper sx={{ padding: 2, backgroundColor: "#e8f5e8" }}>
                <Typography variant="h4" color="success.main" fontWeight="bold">
                  {uploadResult.added}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  成功新增
                </Typography>
              </Paper>
              <Paper sx={{ padding: 2, backgroundColor: "#fff3e0" }}>
                <Typography variant="h4" color="warning.main" fontWeight="bold">
                  {uploadResult.duplicates}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  重複條碼
                </Typography>
              </Paper>
            </Box>

            {/* 顯示具體的新增條碼 */}
            {uploadResult.addedBarcodes &&
              uploadResult.addedBarcodes.length > 0 && (
                <Box sx={{ marginBottom: 2 }}>
                  <Typography variant="h6" color="success.main" gutterBottom>
                    新增的條碼 ({uploadResult.addedBarcodes.length} 個)
                  </Typography>
                  <Paper
                    sx={{
                      padding: 2,
                      backgroundColor: "#f1f8e9",
                      maxHeight: 200,
                      overflow: "auto",
                    }}
                  >
                    <Stack
                      direction="row"
                      spacing={1}
                      flexWrap="wrap"
                      useFlexGap
                    >
                      {uploadResult.addedBarcodes.map((barcode, index) => (
                        <Chip
                          key={index}
                          label={barcode}
                          color="success"
                          variant="outlined"
                          size="small"
                        />
                      ))}
                    </Stack>
                  </Paper>
                </Box>
              )}

            {/* 顯示具體的重複條碼 */}
            {uploadResult.duplicateBarcodes &&
              uploadResult.duplicateBarcodes.length > 0 && (
                <Box>
                  <Typography variant="h6" color="warning.main" gutterBottom>
                    重複的條碼 ({uploadResult.duplicateBarcodes.length} 個)
                  </Typography>
                  <Paper
                    sx={{
                      padding: 2,
                      backgroundColor: "#fff8e1",
                      maxHeight: 200,
                      overflow: "auto",
                    }}
                  >
                    <Stack
                      direction="row"
                      spacing={1}
                      flexWrap="wrap"
                      useFlexGap
                    >
                      {uploadResult.duplicateBarcodes.map((barcode, index) => (
                        <Chip
                          key={index}
                          label={barcode}
                          color="warning"
                          variant="outlined"
                          size="small"
                        />
                      ))}
                    </Stack>
                  </Paper>
                </Box>
              )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default UploadTab;
