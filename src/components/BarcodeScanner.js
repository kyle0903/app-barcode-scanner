import React, { useState, useEffect } from 'react';
import { Box, Tabs, Tab, Grid, Card, CardContent, Typography, styled } from '@mui/material';
import Header from './Header';
import UploadTab from './UploadTab';
import ScanTab from './ScanTab';
import DataTab from './DataTab';
import { apiService } from '../services/apiService';
import { audioService } from '../services/audioService';

const StatsCard = styled(Card)(({ theme }) => ({
  background: 'rgb(54, 98, 139)',
  color: 'white',
  textAlign: 'center',
  borderRadius: '16px',
  boxShadow: '0 8px 32px rgba(54, 98, 139, 0.2)',
  transition: 'all 0.3s ease',
  '& .MuiCardContent-root': {
    padding: '20px',
  },
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: '0 12px 40px rgba(54, 98, 139, 0.3)',
  },
}));

const BarcodeScanner = () => {
  const [activeKey, setActiveKey] = useState(0);
  const [stats, setStats] = useState({
    total_barcodes: 0,
    successful_scans: 0,
    failed_scans: 0
  });
  const [barcodes, setBarcodes] = useState([]);
  const [scanHistory, setScanHistory] = useState([]);

  // 載入統計資料
  const loadStats = async () => {
    try {
      const data = await apiService.getStats();
      setStats(data);
    } catch (error) {
      console.error('載入統計資料失敗:', error);
    }
  };

  // 載入條碼清單
  const loadBarcodes = async () => {
    try {
      const data = await apiService.getBarcodes();
      setBarcodes(data);
    } catch (error) {
      console.error('載入條碼清單失敗:', error);
    }
  };

  // 載入掃描歷史
  const loadScanHistory = async () => {
    try {
      const data = await apiService.getScanHistory(10);
      setScanHistory(data);
    } catch (error) {
      console.error('載入掃描歷史失敗:', error);
    }
  };

  // 載入所有資料
  const loadData = () => {
    loadStats();
    loadBarcodes();
    loadScanHistory();
  };

  useEffect(() => {
    loadData();
    // 初始化音效系統
    audioService.init();
  }, []);

  const handleUploadSuccess = () => {
    loadData();
  };

  const handleScanResult = (result) => {
    loadData();
  };

  const handleDeleteBarcode = async (barcodeId) => {
    try {
      await apiService.deleteBarcode(barcodeId);
      loadData();
    } catch (error) {
      console.error('刪除條碼失敗:', error);
    }
  };

  const handleClearAll = async () => {
    try {
      await apiService.clearAllBarcodes();
      loadData();
    } catch (error) {
      console.error('清空資料失敗:', error);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <Header />
      
      <Box 
        sx={{ 
          borderBottom: 1, 
          borderColor: 'divider',
          backgroundColor: 'background.paper'
        }}
      >
        <Tabs 
          value={activeKey} 
          onChange={(e, newValue) => setActiveKey(newValue)}
          centered
        >
          <Tab label="上傳管理" />
          <Tab label="掃描驗證" />
          <Tab label="資料檢視" />
        </Tabs>
      </Box>

      {/* 統計卡片 - 在所有 Tab 上方顯示 */}
      <Box sx={{ padding: '10px', backgroundColor: 'background.default', marginLeft: '30px' }}>
        <Grid container spacing={3} sx={{ maxWidth: '1200px', margin: '0 auto' }}>
          <Grid item xs={12} md={4}>
            <StatsCard>
              <CardContent>
                <Typography variant="h3" component="div" sx={{ color: 'white' }}>
                  {stats?.total_barcodes || 0}
                </Typography>
                <Typography variant="body1" sx={{ color: 'white' }}>
                  總條碼數
                </Typography>
              </CardContent>
            </StatsCard>
          </Grid>
          <Grid item xs={12} md={4}>
            <StatsCard>
              <CardContent>
                <Typography variant="h3" component="div" sx={{ color: 'white' }}>
                  {stats?.successful_scans || 0}
                </Typography>
                <Typography variant="body1" sx={{ color: 'white' }}>
                  成功掃描
                </Typography>
              </CardContent>
            </StatsCard>
          </Grid>
          <Grid item xs={12} md={4}>
            <StatsCard>
              <CardContent>
                <Typography variant="h3" component="div" sx={{ color: 'white' }}>
                  {stats?.failed_scans || 0}
                </Typography>
                <Typography variant="body1" sx={{ color: 'white' }}>
                  失敗掃描
                </Typography>
              </CardContent>
            </StatsCard>
          </Grid>
        </Grid>
      </Box>

      <Box 
        sx={{ 
          flex: 1,
          overflow: 'auto',
          backgroundColor: 'background.default'
        }}
      >
          {activeKey === 0 && (
            <UploadTab 
              onUploadSuccess={handleUploadSuccess}
            />
          )}
          {activeKey === 1 && (
            <ScanTab 
              onScanResult={handleScanResult}
              scanHistory={scanHistory}
            />
          )}
        {activeKey === 2 && (
          <DataTab 
            barcodes={barcodes}
            onDeleteBarcode={handleDeleteBarcode}
            onClearAll={handleClearAll}
          />
        )}
      </Box>
    </Box>
  );
};

export default BarcodeScanner;
