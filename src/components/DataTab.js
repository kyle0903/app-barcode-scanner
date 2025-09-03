import React, { useState } from "react";
import {
  Box,
  Button,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Grid,
  Divider,
  Chip,
  Alert,
  useTheme,
  useMediaQuery,
  Stack,
  Collapse,
  IconButton,
  Pagination,
  styled,
} from "@mui/material";
import {
  Search,
  Clear,
  DateRange,
  ExpandMore,
  ExpandLess,
  FilterList,
  Download,
  Info,
} from "@mui/icons-material";
import { apiService } from "../services/apiService";

// 現代化玻璃效果容器
const GlassContainer = styled(Box)(({ theme }) => ({
  background:
    "linear-gradient(135deg, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0.1) 100%)",
  backdropFilter: "blur(20px)",
  borderRadius: "20px",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
  padding: theme.spacing(3),
  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  "&:hover": {
    transform: "translateY(-2px)",
    boxShadow: "0 12px 40px rgba(0, 0, 0, 0.15)",
    background:
      "linear-gradient(135deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0.15) 100%)",
  },
}));

// 統計數據項目
const StatItem = styled(Box)(({ theme }) => ({
  textAlign: "center",
  padding: theme.spacing(2.5),
  background: "linear-gradient(135deg, #667eea 0%,rgb(85, 54, 116) 100%)",
  borderRadius: "16px",
  color: "white",
  boxShadow: "0 4px 20px rgba(102, 126, 234, 0.3)",
  transition: "all 0.3s ease",
  position: "relative",
  overflow: "hidden",
  "&::before": {
    content: '""',
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background:
      "linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, transparent 50%)",
    borderRadius: "inherit",
  },
  "&:hover": {
    transform: "scale(1.02)",
    boxShadow: "0 8px 30px rgba(102, 126, 234, 0.4)",
  },
}));

// 搜尋區域容器
const SearchContainer = styled(Box)(({ theme }) => ({
  background: "linear-gradient(145deg, #f8fafc 0%, #e2e8f0 100%)",
  borderRadius: "20px",
  padding: theme.spacing(3),
  border: "1px solid rgba(226, 232, 240, 0.8)",
  boxShadow:
    "inset 0 2px 4px rgba(0, 0, 0, 0.02), 0 4px 20px rgba(0, 0, 0, 0.05)",
}));

const DataTab = ({ barcodes, stats }) => {
  const theme = useTheme();
  const isTablet = useMediaQuery(theme.breakpoints.down("lg"));

  const [searchInput, setSearchInput] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filteredBarcodes, setFilteredBarcodes] = useState(barcodes);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRow, setExpandedRow] = useState(null);
  const [barcodeDetails, setBarcodeDetails] = useState({});
  const itemsPerPage = 100;

  // 處理詳細內容展開/收起
  const handleToggleDetails = async (barcodeCode) => {
    if (expandedRow === barcodeCode) {
      setExpandedRow(null);
      return;
    }

    setExpandedRow(barcodeCode);

    // 如果還沒有載入過這個條碼的詳細資料，就去載入
    if (!barcodeDetails[barcodeCode]) {
      try {
        // 這裡需要新的 API 來獲取條碼的所有記錄和掃描歷史
        const details = await apiService.getBarcodeDetails(barcodeCode);
        setBarcodeDetails((prev) => ({
          ...prev,
          [barcodeCode]: details,
        }));
      } catch (error) {
        console.error("載入詳細資料失敗:", error);
      }
    }
  };

  // 下載顯示資料
  const handleDownloadData = async () => {
    try {
      // 使用 filteredBarcodes 來下載所有符合條件的資料，而不只是當前頁面
      const blob = await apiService.downloadExcel(filteredBarcodes);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      // 根據是否有搜尋條件來決定檔案名稱
      const fileName = `條碼資料_${filteredBarcodes.length}.xlsx`;

      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("下載失敗:", error);
      alert("下載失敗，請稍後再試");
    }
  };

  // 多筆條碼查詢
  const handleMultiSearch = async () => {
    if (!searchInput.trim()) {
      setSearchMessage("請輸入要查詢的條碼");
      return;
    }

    setIsSearching(true);
    setSearchMessage("");

    try {
      // 按換行分割條碼，移除空白
      const codes = searchInput
        .split("\n")
        .map((code) => code.trim())
        .filter((code) => code.length > 0);

      if (codes.length === 0) {
        setSearchMessage("請輸入有效的條碼");
        return;
      }

      const results = await apiService.searchBarcodes(codes);
      setFilteredBarcodes(results);
      setSearchMessage(
        `找到 ${results.length} 個條碼，查詢了 ${codes.length} 個條碼`
      );
    } catch (error) {
      console.error("查詢失敗:", error);
      setSearchMessage("查詢失敗: " + error.message);
    } finally {
      setIsSearching(false);
    }
  };

  // 日期範圍查詢
  const handleDateRangeSearch = async () => {
    if (!startDate && !endDate) {
      setSearchMessage("請選擇至少一個日期");
      return;
    }

    setIsSearching(true);
    setSearchMessage("");

    try {
      const results = await apiService.getBarcodesByDateRange(
        startDate,
        endDate
      );
      setFilteredBarcodes(results);
      setSearchMessage(`找到 ${results.length} 個條碼`);
    } catch (error) {
      console.error("日期查詢失敗:", error);
      setSearchMessage("日期查詢失敗: " + error.message);
    } finally {
      setIsSearching(false);
    }
  };

  // 清除搜尋結果
  const handleClearSearch = () => {
    setSearchInput("");
    setStartDate("");
    setEndDate("");
    setFilteredBarcodes(barcodes);
    setSearchMessage("");
  };

  // 當 barcodes prop 更新時，同步更新 filteredBarcodes
  React.useEffect(() => {
    if (!isSearching && !searchMessage) {
      setFilteredBarcodes(barcodes);
      setCurrentPage(1); // 重置到第一頁
    }
  }, [barcodes, isSearching, searchMessage]);

  // 分頁計算
  const totalPages = Math.ceil(filteredBarcodes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentBarcodes = filteredBarcodes.slice(startIndex, endIndex);

  // 處理分頁變更
  const handlePageChange = (event, newPage) => {
    setCurrentPage(newPage);
  };

  return (
    <Box sx={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* 統計卡片和查詢功能並排顯示 */}
      <Box
        sx={{
          padding: { xs: "5px", md: "10px" },
          backgroundColor: "background.default",
          marginBottom: "20px",
        }}
      >
        <Grid
          container
          spacing={{ xs: 2, md: 3 }}
          sx={{ maxWidth: "1200px", margin: "0 auto" }}
        >
          {/* 統計數據區域 */}
          <Grid item xs={12} lg={8}>
            <Grid container spacing={{ xs: 2, md: 3 }}>
              <Grid item xs={12} md={4}>
                <StatItem>
                  <Typography
                    variant="h3"
                    component="div"
                    sx={{
                      fontSize: { xs: "2rem", md: "2.5rem" },
                      fontWeight: "bold",
                      marginBottom: 1,
                      position: "relative",
                      zIndex: 1,
                    }}
                  >
                    {stats?.total_barcodes || 0}
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      fontSize: { xs: "0.875rem", md: "1rem" },
                      opacity: 0.9,
                      position: "relative",
                      zIndex: 1,
                    }}
                  >
                    總收單筆數
                  </Typography>
                </StatItem>
              </Grid>
              <Grid item xs={12} md={4}>
                <StatItem>
                  <Typography
                    variant="h3"
                    component="div"
                    sx={{
                      fontSize: { xs: "2rem", md: "2.5rem" },
                      fontWeight: "bold",
                      marginBottom: 1,
                      position: "relative",
                      zIndex: 1,
                    }}
                  >
                    {stats?.successful_scans || 0}
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      fontSize: { xs: "0.875rem", md: "1rem" },
                      opacity: 0.9,
                      position: "relative",
                      zIndex: 1,
                    }}
                  >
                    已掃描筆數
                  </Typography>
                </StatItem>
              </Grid>
            </Grid>
          </Grid>

          {/* 查詢功能區域 */}
          <Grid item xs={12} lg={4}>
            <SearchContainer sx={{ height: "100%" }}>
              <Box
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    marginBottom: 1,
                  }}
                  onClick={() => setShowSearchPanel(!showSearchPanel)}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <FilterList color="action" />
                    <Typography variant="h6" component="h4">
                      收單查詢
                    </Typography>
                    {searchMessage && (
                      <Chip
                        size="small"
                        label="已篩選"
                        color="primary"
                        variant="outlined"
                      />
                    )}
                  </Box>
                  <IconButton size="small">
                    {showSearchPanel ? <ExpandLess /> : <ExpandMore />}
                  </IconButton>
                </Box>

                <Collapse in={showSearchPanel}>
                  <Box sx={{ flex: 1 }}>
                    <Grid container spacing={5}>
                      {/* 多筆條碼查詢 */}
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" gutterBottom>
                          多筆條碼查詢
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          display="block"
                          gutterBottom
                        >
                          輸入單號，每行一個條碼
                        </Typography>
                        <TextField
                          multiline
                          rows={2}
                          placeholder="請輸入條碼，每行一個"
                          value={searchInput}
                          onChange={(e) => setSearchInput(e.target.value)}
                          disabled={isSearching}
                          size="small"
                          fullWidth
                          sx={{ marginBottom: 1 }}
                        />
                        <Button
                          onClick={handleMultiSearch}
                          variant="contained"
                          color="primary"
                          startIcon={<Search />}
                          disabled={isSearching || !searchInput.trim()}
                          size="small"
                          fullWidth
                        >
                          {isSearching ? "查詢中..." : "查詢條碼"}
                        </Button>
                      </Grid>

                      {/* 日期範圍查詢 */}
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2">
                          日期範圍查詢
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          display="block"
                          marginBottom={1}
                        >
                          依上傳日期查詢條碼
                        </Typography>
                        <Stack spacing={1} sx={{ marginBottom: 1 }}>
                          <TextField
                            type="date"
                            label="開始日期"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            disabled={isSearching}
                            InputLabelProps={{
                              shrink: true,
                            }}
                            size="small"
                            fullWidth
                          />
                          <TextField
                            type="date"
                            label="結束日期"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            disabled={isSearching}
                            InputLabelProps={{
                              shrink: true,
                            }}
                            size="small"
                            fullWidth
                          />
                        </Stack>
                        <Button
                          onClick={handleDateRangeSearch}
                          variant="contained"
                          color="primary"
                          startIcon={<DateRange />}
                          disabled={isSearching || (!startDate && !endDate)}
                          size="small"
                          fullWidth
                        >
                          {isSearching ? "查詢中..." : "日期查詢"}
                        </Button>
                      </Grid>
                    </Grid>

                    {/* 清除搜尋按鈕和查詢結果訊息 */}
                    <Box sx={{ marginTop: 2 }}>
                      <Button
                        onClick={handleClearSearch}
                        variant="outlined"
                        color="primary"
                        startIcon={<Clear />}
                        disabled={isSearching}
                        size="small"
                        fullWidth
                      >
                        清除搜尋
                      </Button>

                      {/* 查詢結果訊息 */}
                      {searchMessage && (
                        <Alert
                          severity={
                            searchMessage.includes("失敗") ? "error" : "info"
                          }
                          size="small"
                          sx={{ marginTop: 1 }}
                        >
                          {searchMessage}
                        </Alert>
                      )}
                    </Box>
                  </Box>
                </Collapse>
              </Box>
            </SearchContainer>
          </Grid>
        </Grid>
      </Box>

      <Divider
        sx={{
          marginY: 3,
          background:
            "linear-gradient(90deg, transparent 0%, #e2e8f0 50%, transparent 100%)",
          height: "2px",
          border: "none",
        }}
      />

      {/* 結果統計 */}
      <GlassContainer
        sx={{
          marginBottom: 3,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: 2,
        }}
      >
        <Typography variant="h6" component="h4">
          收單資料列表
        </Typography>

        {filteredBarcodes.length > 0 && (
          <Chip
            label={`第 ${startIndex + 1}-${Math.min(
              endIndex,
              filteredBarcodes.length
            )} 筆，共 ${filteredBarcodes.length} 筆資料`}
            color="primary"
            variant="outlined"
          />
        )}

        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100%",
            minHeight: "60px",
            gap: 2,
          }}
        >
          <Button
            onClick={handleDownloadData}
            variant="outlined"
            color="primary"
            startIcon={<Download />}
            size="medium"
            disabled={filteredBarcodes.length === 0}
          >
            下載資料 ({filteredBarcodes.length} 筆)
          </Button>
        </Box>
      </GlassContainer>

      <GlassContainer
        sx={{
          padding: 3,
          overflow: "hidden",
        }}
      >
        <TableContainer
          component={Box}
          sx={{
            flex: 1,
            overflowX: "auto",
            background: "rgba(255, 255, 255, 0.5)",
            borderRadius: "12px",
            boxShadow: "inset 0 1px 3px rgba(0, 0, 0, 0.1)",
            maxHeight: "calc(100% - 80px)", // 為分頁組件預留空間
          }}
        >
          <Table
            sx={{
              minWidth: isTablet ? 500 : 650,
              tableLayout: "fixed", // 固定表格佈局，防止列寬動態變化
              "& .MuiTableCell-root": {
                padding: "8px 12px",
                fontSize: "0.875rem",
              },
              "& .MuiTableHead-root .MuiTableCell-root": {
                padding: "6px 12px",
                fontSize: "0.8rem",
              },
            }}
          >
            <TableHead>
              <TableRow
                sx={{
                  background:
                    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  "& .MuiTableCell-root": {
                    color: "white",
                    fontWeight: "bold",
                    borderBottom: "none",
                  },
                }}
              >
                <TableCell>
                  <strong>#</strong>
                </TableCell>
                <TableCell>
                  <strong>條碼</strong>
                </TableCell>
                {!isTablet && (
                  <TableCell>
                    <strong>上傳時間</strong>
                  </TableCell>
                )}
                <TableCell>
                  <strong>被掃描次數</strong>
                </TableCell>
                {!isTablet && (
                  <TableCell>
                    <strong>最後掃描時間</strong>
                  </TableCell>
                )}
                <TableCell>
                  <strong>詳細內容</strong>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {currentBarcodes.map((barcode, index) => (
                <React.Fragment key={barcode.id}>
                  <TableRow
                    sx={{
                      "&:nth-of-type(odd)": {
                        backgroundColor: "rgba(255, 255, 255, 0.7)",
                      },
                      "&:nth-of-type(even)": {
                        backgroundColor: "rgba(255, 255, 255, 0.4)",
                      },
                      "&:hover": {
                        backgroundColor: "rgba(102, 126, 234, 0.1)",
                      },
                      transition: "background-color 0.2s ease", // 只保留背景色變化，移除縮放
                      height: "44px", // 稍微增加行高，讓滾動更順暢
                    }}
                  >
                    <TableCell>{startIndex + index + 1}</TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: "monospace",
                          wordBreak: "break-all",
                        }}
                      >
                        {barcode.code}
                      </Typography>
                    </TableCell>
                    {!isTablet && (
                      <TableCell>
                        <Typography variant="body2">
                          {barcode.upload_time
                            ? new Date(barcode.upload_time).toLocaleString()
                            : "-"}
                        </Typography>
                      </TableCell>
                    )}
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: "bold",
                          color:
                            barcode.scan_count > 0
                              ? "success.main"
                              : "text.secondary",
                        }}
                      >
                        {barcode.scan_count}
                      </Typography>
                    </TableCell>
                    {!isTablet && (
                      <TableCell>
                        <Typography variant="body2">
                          {barcode.last_scan_time
                            ? new Date(barcode.last_scan_time).toLocaleString()
                            : "未掃描"}
                        </Typography>
                      </TableCell>
                    )}
                    <TableCell>
                      <Button
                        size="small"
                        variant="outlined"
                        color="primary"
                        startIcon={<Info />}
                        onClick={() => handleToggleDetails(barcode.code)}
                        sx={{ minWidth: isTablet ? "60px" : "80px" }}
                      >
                        {expandedRow === barcode.code ? "收起" : "查看"}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandedRow === barcode.code && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        sx={{
                          backgroundColor: "rgba(240, 245, 255, 0.8)",
                          padding: 3,
                        }}
                      >
                        <Box>
                          <Typography variant="h6" gutterBottom color="primary">
                            條碼 {barcode.code} 詳細資料
                          </Typography>

                          {barcodeDetails[barcode.code] ? (
                            <Box
                              sx={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: 3,
                              }}
                            >
                              {/* 上傳記錄 */}
                              <Box>
                                <Typography
                                  variant="subtitle1"
                                  fontWeight="bold"
                                  gutterBottom
                                >
                                  上傳記錄 (
                                  {barcodeDetails[barcode.code].total_uploads}{" "}
                                  次)
                                </Typography>
                                <Box
                                  sx={{
                                    maxHeight: 200,
                                    overflow: "auto",
                                  }}
                                >
                                  {barcodeDetails[
                                    barcode.code
                                  ].upload_records.map((record, idx) => (
                                    <Box
                                      key={record.id}
                                      sx={{
                                        padding: 1,
                                        marginBottom: 1,
                                        backgroundColor:
                                          "rgba(255, 255, 255, 0.7)",
                                        borderRadius: 1,
                                        fontSize: "0.875rem",
                                      }}
                                    >
                                      <Typography variant="body2">
                                        <strong>#{idx + 1}</strong>{" "}
                                        {new Date(
                                          record.upload_time
                                        ).toLocaleString()}
                                      </Typography>
                                      <Typography
                                        variant="caption"
                                        color="text.secondary"
                                      >
                                        掃描次數: {record.scan_count} |
                                        最後掃描:{" "}
                                        {record.last_scan_time
                                          ? new Date(
                                              record.last_scan_time
                                            ).toLocaleString()
                                          : "未掃描"}
                                      </Typography>
                                    </Box>
                                  ))}
                                </Box>
                              </Box>

                              {/* 掃描歷史 */}
                              <Box>
                                <Typography
                                  variant="subtitle1"
                                  fontWeight="bold"
                                  gutterBottom
                                >
                                  掃描歷史 (
                                  {barcodeDetails[barcode.code].total_scans} 次)
                                </Typography>
                                <Box sx={{ maxHeight: 200, overflow: "auto" }}>
                                  {barcodeDetails[
                                    barcode.code
                                  ].scan_history.map((scan, idx) => (
                                    <Box
                                      key={scan.id}
                                      sx={{
                                        padding: 1,
                                        marginBottom: 1,
                                        backgroundColor:
                                          scan.result === "success"
                                            ? "#e8f5e8"
                                            : "#ffeaa7",
                                        borderRadius: 1,
                                        fontSize: "0.875rem",
                                      }}
                                    >
                                      <Typography variant="body2">
                                        <strong>#{idx + 1}</strong>{" "}
                                        {new Date(
                                          scan.timestamp
                                        ).toLocaleString()}
                                      </Typography>
                                      <Typography variant="caption">
                                        {scan.result === "success"
                                          ? "✅ 收單確認"
                                          : "❌ 非收單項目"}
                                      </Typography>
                                    </Box>
                                  ))}
                                </Box>
                              </Box>
                            </Box>
                          ) : (
                            <Typography>載入中...</Typography>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
              {currentBarcodes.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={isTablet ? 5 : 6}
                    align="center"
                    sx={{ padding: "40px" }}
                  >
                    <Typography variant="body1" color="text.secondary">
                      {searchMessage ? "查詢結果為空" : "尚無條碼資料"}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* 分頁組件 */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "20px 0",
            marginTop: "auto",
            borderTop: "1px solid rgba(226, 232, 240, 0.6)",
            background: "rgba(255, 255, 255, 0.3)",
            borderRadius: "0 0 12px 12px",
            minHeight: "80px", // 固定最小高度
            flexShrink: 0, // 防止被壓縮
            flexDirection: "column",
          }}
        >
          <Pagination
            count={totalPages}
            page={currentPage}
            onChange={handlePageChange}
            color="primary"
            size="medium"
            showFirstButton
            showLastButton
          />
        </Box>
      </GlassContainer>
    </Box>
  );
};

export default DataTab;
