import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Button,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from '@mui/material';
import { Delete, DeleteSweep } from '@mui/icons-material';

const DataTab = ({ barcodes, onDeleteBarcode, onClearAll }) => {
  const handleDelete = (barcodeId) => {
    if (window.confirm('確定要刪除此條碼嗎？')) {
      onDeleteBarcode(barcodeId);
    }
  };

  const handleClearAll = () => {
    if (window.confirm('確定要清空所有資料嗎？此操作無法復原！')) {
      onClearAll();
    }
  };

  return (
    <Box sx={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}
      >
        <Typography variant="h5" component="h3">
          條碼資料檢視
        </Typography>
        <Button
          onClick={handleClearAll}
          variant="contained"
          color="error"
          startIcon={<DeleteSweep />}
        >
          清空所有資料
        </Button>
      </Box>

      <Card>
        <CardContent>
          <TableContainer component={Paper}>
            <Table sx={{ minWidth: 650 }}>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f8f9fa' }}>
                  <TableCell><strong>#</strong></TableCell>
                  <TableCell><strong>條碼</strong></TableCell>
                  <TableCell><strong>上傳時間</strong></TableCell>
                  <TableCell><strong>掃描次數</strong></TableCell>
                  <TableCell><strong>最後掃描時間</strong></TableCell>
                  <TableCell><strong>操作</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {barcodes.map((barcode, index) => (
                  <TableRow
                    key={barcode.id}
                    sx={{
                      '&:nth-of-type(odd)': {
                        backgroundColor: '#f9f9f9',
                      },
                      '&:hover': {
                        backgroundColor: '#f5f5f5',
                      },
                    }}
                  >
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {barcode.code}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {barcode.upload_time ? new Date(barcode.upload_time).toLocaleString() : '-'}
                    </TableCell>
                    <TableCell>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          fontWeight: 'bold',
                          color: barcode.scan_count > 0 ? 'success.main' : 'text.secondary'
                        }}
                      >
                        {barcode.scan_count}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {barcode.last_scan_time ? new Date(barcode.last_scan_time).toLocaleString() : '未掃描'}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        variant="contained"
                        color="error"
                        startIcon={<Delete />}
                        onClick={() => handleDelete(barcode.id)}
                        sx={{ minWidth: '80px' }}
                      >
                        刪除
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {barcodes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ padding: '40px' }}>
                      <Typography variant="body1" color="text.secondary">
                        尚無條碼資料
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
};

export default DataTab;