import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Button,
  TextField,
  Typography,
  Alert,
  Paper,
  styled
} from '@mui/material';
import { CloudUpload } from '@mui/icons-material';
import { apiService } from '../services/apiService';

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

const UploadTab = ({ onUploadSuccess }) => {
  const [manualBarcode, setManualBarcode] = useState('');
  const [notification, setNotification] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const showNotification = (message, severity = 'success') => {
    setNotification({ message, severity });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsLoading(true);
    
    try {
      const text = await file.text();
      const codes = text.split('\n')
        .map(line => line.trim())
        .filter(line => line);

      const responses = await apiService.uploadBarcodes(codes);

      showNotification(`成功上傳 ${responses.message}！`);
      onUploadSuccess();
    } catch (error) {
      showNotification('上傳失敗: ' + error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualAdd = async () => {
    if (!manualBarcode.trim()) {
      showNotification('請輸入條碼！', 'error');
      return;
    }

    setIsLoading(true);
    try {
      await apiService.addBarcode(manualBarcode.trim());
      setManualBarcode('');
      showNotification('條碼新增成功！');
      onUploadSuccess();
    } catch (error) {
      showNotification('新增失敗: ' + error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleManualAdd();
    }
  };

  return (
    <Box sx={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      {notification && (
        <Alert 
          severity={notification.severity} 
          onClose={() => setNotification(null)}
          sx={{ marginBottom: '20px' }}
        >
          {notification.message}
        </Alert>
      )}

      {/* 文件上傳區域 */}
      <Card sx={{ marginBottom: '20px', border: '2px dashed #3498db' }}>
        <CardContent>
          <Typography variant="h5" component="h3" gutterBottom>
            上傳條碼清單
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            支援格式：TXT(每行一個條碼)
          </Typography>
          
          <Paper
            sx={{
              padding: '40px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              margin: '20px 0',
              textAlign: 'center'
            }}
          >
            <Button
              component="label"
              variant="contained"
              startIcon={<CloudUpload />}
              disabled={isLoading}
              sx={{
                background: 'rgb(54, 98, 139)',
                '&:hover': {
                  background: 'rgb(54, 98, 139,0.7)',
                }
              }}
            >
              選擇檔案上傳
              <VisuallyHiddenInput
                type="file"
                accept=".txt"
                onChange={handleFileUpload}
              />
            </Button>
          </Paper>
        </CardContent>
      </Card>

      {/* 手動新增區域 */}
      <Card>
        <CardContent>
          <Typography variant="h6" component="h4" gutterBottom>
            或手動輸入條碼：
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <TextField
              value={manualBarcode}
              onChange={(e) => setManualBarcode(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="輸入條碼後按 Enter"
              disabled={isLoading}
              sx={{ width: '300px' }}
            />
            <Button
              onClick={handleManualAdd}
              disabled={isLoading}
              variant="contained"
              sx={{
                background: 'rgb(54, 98, 139)',
                '&:hover': {
                  background: 'rgb(54, 98, 139,0.7)',
                }
              }}
            >
              新增條碼
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default UploadTab;