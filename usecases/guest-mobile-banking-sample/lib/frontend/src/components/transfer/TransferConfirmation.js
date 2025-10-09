// src/components/transfer/TransferConfirmation.js
import React from 'react';
import { Box, Button, Paper, Typography, List, ListItem, ListItemText, Divider } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SendIcon from '@mui/icons-material/Send';

const TransferConfirmation = ({ transferData, onBack, onConfirm }) => {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount);
  };

  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        振込内容の確認
      </Typography>
      <List>
        <ListItem>
          <ListItemText primary="振込先銀行" secondary={transferData.bankName} />
        </ListItem>
        <Divider component="li" />
        <ListItem>
          <ListItemText
            primary="支店名"
            secondary={`${transferData.branchName}${transferData.branchCode ? ` (${transferData.branchCode})` : ''}`}
          />
        </ListItem>
        <Divider component="li" />
        <ListItem>
          <ListItemText primary="口座番号" secondary={transferData.accountNumber} />
        </ListItem>
        <Divider component="li" />
        <ListItem>
          <ListItemText primary="振込金額" secondary={formatCurrency(parseInt(transferData.amount))} />
        </ListItem>
        <Divider component="li" />
        <ListItem>
          <ListItemText primary="振込メッセージ" secondary={transferData.message || '(なし)'} />
        </ListItem>
      </List>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
        <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={onBack}>
          修正する
        </Button>
        <Button variant="contained" color="primary" startIcon={<SendIcon />} onClick={onConfirm}>
          振込を実行
        </Button>
      </Box>
    </Paper>
  );
};

export default TransferConfirmation;
