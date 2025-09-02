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
  Delete,
  DeleteSweep,
  Search,
  Clear,
  DateRange,
  ExpandMore,
  ExpandLess,
  FilterList,
  Download,
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

const DataTab = ({ barcodes, stats, onDeleteBarcode, onClearAll }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isTablet = useMediaQuery(theme.breakpoints.down("lg"));

  const [searchInput, setSearchInput] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filteredBarcodes, setFilteredBarcodes] = useState(barcodes);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const handleDelete = (barcodeId) => {
    if (window.confirm("確定要刪除此條碼嗎？")) {
      onDeleteBarcode(barcodeId);
    }
  };

  const handleClearAll = () => {
    if (window.confirm("確定要清空所有資料嗎？此操作無法復原！")) {
      onClearAll();
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
          <Button
            onClick={handleClearAll}
            variant="contained"
            color="error"
            startIcon={<DeleteSweep />}
            size="medium"
          >
            清空資料
          </Button>
        </Box>
      </GlassContainer>

      <GlassContainer sx={{ padding: 3, overflow: "hidden" }}>
        {isMobile ? (
          // 手機版：簡潔列表佈局
          <Box>
            {currentBarcodes.length === 0 ? (
              <Box sx={{ textAlign: "center", padding: "40px" }}>
                <Typography variant="body1" color="text.secondary">
                  {searchMessage ? "查詢結果為空" : "尚無條碼資料"}
                </Typography>
              </Box>
            ) : (
              <Stack spacing={1}>
                {currentBarcodes.map((barcode, index) => (
                  <Box
                    key={barcode.id}
                    sx={{
                      padding: 2,
                      background: "rgba(255, 255, 255, 0.7)",
                      borderRadius: "12px",
                      border: "1px solid rgba(226, 232, 240, 0.6)",
                      transition: "all 0.2s ease",
                      "&:hover": {
                        background: "rgba(255, 255, 255, 0.9)",
                        transform: "translateX(4px)",
                        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                      },
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 1,
                      }}
                    >
                      <Chip
                        label={`#${startIndex + index + 1}`}
                        size="small"
                        variant="outlined"
                        color="primary"
                      />
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDelete(barcode.id)}
                        sx={{
                          background: "rgba(244, 67, 54, 0.1)",
                          "&:hover": {
                            background: "rgba(244, 67, 54, 0.2)",
                          },
                        }}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Box>

                    <Typography
                      variant="body1"
                      sx={{
                        fontFamily: "monospace",
                        fontWeight: "bold",
                        color: "primary.main",
                        marginBottom: 1.5,
                        fontSize: "1.1rem",
                      }}
                    >
                      {barcode.code}
                    </Typography>

                    <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                      <Chip
                        label={`掃描 ${barcode.scan_count} 次`}
                        size="small"
                        color={barcode.scan_count > 0 ? "success" : "default"}
                        variant="filled"
                      />
                      <Chip
                        label={
                          barcode.upload_time
                            ? new Date(barcode.upload_time).toLocaleDateString()
                            : "未知日期"
                        }
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                  </Box>
                ))}
              </Stack>
            )}
          </Box>
        ) : (
          // 桌面版：表格佈局
          <TableContainer
            component={Box}
            sx={{
              overflowX: "auto",
              background: "rgba(255, 255, 255, 0.5)",
              borderRadius: "12px",
              boxShadow: "inset 0 1px 3px rgba(0, 0, 0, 0.1)",
            }}
          >
            <Table sx={{ minWidth: isTablet ? 500 : 650 }}>
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
                    <strong>操作</strong>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {currentBarcodes.map((barcode, index) => (
                  <TableRow
                    key={barcode.id}
                    sx={{
                      "&:nth-of-type(odd)": {
                        backgroundColor: "rgba(255, 255, 255, 0.7)",
                      },
                      "&:nth-of-type(even)": {
                        backgroundColor: "rgba(255, 255, 255, 0.4)",
                      },
                      "&:hover": {
                        backgroundColor: "rgba(102, 126, 234, 0.1)",
                        transform: "scale(1.01)",
                      },
                      transition: "all 0.2s ease",
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
                        variant="contained"
                        color="error"
                        startIcon={<Delete />}
                        onClick={() => handleDelete(barcode.id)}
                        sx={{ minWidth: isTablet ? "60px" : "80px" }}
                      >
                        刪除
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {currentBarcodes.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={isTablet ? 4 : 6}
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
        )}

        {/* 分頁組件 */}
        {totalPages > 1 && (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              padding: "20px 0",
              marginTop: 2,
              borderTop: "1px solid rgba(226, 232, 240, 0.6)",
              background: "rgba(255, 255, 255, 0.3)",
              borderRadius: "0 0 12px 12px",
            }}
          >
            <Pagination
              count={totalPages}
              page={currentPage}
              onChange={handlePageChange}
              color="primary"
              size={isMobile ? "small" : "medium"}
              showFirstButton
              showLastButton
            />
          </Box>
        )}
      </GlassContainer>
    </Box>
  );
};

export default DataTab;
