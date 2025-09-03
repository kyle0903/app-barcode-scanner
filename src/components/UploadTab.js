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
import { Upload } from "@mui/icons-material";
import { apiService } from "../services/apiService";

const UploadTab = ({ onUploadSuccess }) => {
  const [manualBarcode, setManualBarcode] = useState("");
  const [notification, setNotification] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  const showNotification = (message, severity = "success") => {
    setNotification({ message, severity });
    setTimeout(() => setNotification(null), 3000);
  };

  // 直接上傳條碼
  const handleDirectUpload = async () => {
    const input = manualBarcode.trim();
    if (!input) {
      showNotification("請輸入條碼！", "error");
      return;
    }

    // 分割輸入的條碼（支持空格、換行、逗號、分號等分隔符）
    const barcodes = input
      .split(/[\s\n,;]+/) // 用空白符號、換行、逗號、分號分隔
      .map((barcode) => barcode.trim())
      .filter((barcode) => barcode.length > 0); // 過濾空字串

    if (barcodes.length === 0) {
      showNotification("請輸入有效的條碼！", "error");
      return;
    }

    setIsLoading(true);
    setUploadResult(null);

    try {
      const response = await apiService.uploadBarcodes(barcodes);

      // 使用新的回傳格式
      setUploadResult({
        total: response.total,
        added: response.added_count,
        duplicates: response.duplicate_count,
        message: response.message,
        addedBarcodes: response.added_barcodes || [],
        duplicateBarcodes: response.duplicate_barcodes || [],
      });

      // 清空輸入框
      setManualBarcode("");
      onUploadSuccess();
      showNotification(
        `上傳完成！新增 ${response.added_count} 筆，重複 ${response.duplicate_count} 筆`
      );
    } catch (error) {
      showNotification("上傳失敗: " + error.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      // Ctrl+Enter 或 Cmd+Enter 直接上傳條碼
      e.preventDefault();
      handleDirectUpload();
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
            或點擊「上傳」按鈕直接上傳
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
              onClick={handleDirectUpload}
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
              {isLoading ? "上傳中..." : "上傳"}
            </Button>
          </Box>
        </CardContent>
      </Card>

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
