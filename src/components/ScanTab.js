import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Button,
  TextField,
  Slider,
  Typography,
  Alert,
  Paper
} from '@mui/material';
import { VolumeUp, VolumeOff } from '@mui/icons-material';
import { apiService } from '../services/apiService';
import { audioService } from '../services/audioService';

const ScanTab = ({ onScanResult, scanHistory }) => {
  const [scanInput, setScanInput] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [volume, setVolume] = useState(70);
  const scanInputRef = useRef(null);

  useEffect(() => {
    // 確保掃描輸入框始終有焦點
    const focusInput = () => {
      if (scanInputRef.current) {
        scanInputRef.current.focus();
      }
    };

    focusInput();
    
    // 當輸入框失去焦點時，重新聚焦
    const handleBlur = () => {
      setTimeout(focusInput, 100);
    };

    const inputElement = scanInputRef.current;
    if (inputElement) {
      inputElement.addEventListener('blur', handleBlur);
      return () => inputElement.removeEventListener('blur', handleBlur);
    }
  }, []);

  const handleScan = async (e) => {
    if (e.key === 'Enter') {
      const barcode = scanInput.trim();
      setScanInput('');
      
      if (!barcode) return;

      try {
        const result = await apiService.scanBarcode(barcode);
        setScanResult(result);
        
        // 播放對應音效
        if (result.result === 'success') {
          audioService.playSuccessSound();
        } else if (result.result === 'duplicate') {
          audioService.playDuplicateSound();
        } else {
          audioService.playErrorSound();
        }

        onScanResult(result);

        // 2秒後隱藏結果
        setTimeout(() => setScanResult(null), 2000);
      } catch (error) {
        console.error('掃描失敗:', error);
      }
    }
  };

  const handleVolumeChange = (event, newValue) => {
    setVolume(newValue);
    audioService.setVolume(newValue / 100);
  };

  const testSound = (type) => {
    if (type === 'success') {
      audioService.playSuccessSound();
    } else {
      audioService.playErrorSound();
    }
  };

  const getResultSeverity = (result) => {
    switch (result) {
      case 'success':
        return 'success';
      case 'error':
        return 'error';
      case 'duplicate':
        return 'warning';
      default:
        return 'info';
    }
  };

  return (
    <Box sx={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* 音效設定 */}
      <Card sx={{ marginBottom: '30px' }}>
        <CardContent>
          <Typography variant="h6" component="h4" gutterBottom>
            音效設定
          </Typography>
          <Box sx={{ marginBottom: '20px' }}>
            <Typography variant="body2" gutterBottom>
              音量: {volume}%
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '300px' }}>
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
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              onClick={() => testSound('success')}
              variant="contained"
              color="success"
            >
              測試成功音效
            </Button>
            <Button
              onClick={() => testSound('error')}
              variant="contained"
              color="error"
            >
              測試錯誤音效
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* 掃描區域 */}
      <Card>
        <CardContent>
          <Typography variant="h5" component="h3" gutterBottom>
            掃描條碼驗證
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            請將游標聚焦在下方輸入框，然後使用掃碼槍掃描
          </Typography>
          
          <TextField
            inputRef={scanInputRef}
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            onKeyPress={handleScan}
            placeholder="掃描條碼會自動顯示在這裡..."
            fullWidth
            autoFocus
            sx={{
              marginTop: '20px',
              marginBottom: '20px',
              '& .MuiInputBase-input': {
                fontSize: '18px',
                padding: '15px'
              }
            }}
          />

          {/* 掃描結果 */}
          {scanResult && (
            <Alert
              severity={getResultSeverity(scanResult.result)}
              sx={{ marginBottom: '20px' }}
            >
              <strong>條碼: {scanResult.barcode}</strong><br/>
              狀態: {scanResult.message}
            </Alert>
          )}

          {/* 最近掃描記錄 */}
          <Box sx={{ marginTop: '20px' }}>
            <Typography variant="h6" component="h4" gutterBottom>
              最近掃描記錄：
            </Typography>
            {scanHistory.slice(0, 5).map((scan, index) => (
              <Paper
                key={index}
                elevation={1}
                sx={{
                  padding: '10px',
                  margin: '5px 0',
                  backgroundColor: scan.result === 'success' ? '#d4edda' : '#f8d7da',
                  color: scan.result === 'success' ? '#155724' : '#721c24',
                  border: `1px solid ${scan.result === 'success' ? '#c3e6cb' : '#f5c6cb'}`
                }}
              >
                {scan.barcode} - {scan.result === 'success' ? '✅ 成功' : '❌ 失敗'} - {new Date(scan.timestamp).toLocaleString()}
              </Paper>
            ))}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ScanTab;