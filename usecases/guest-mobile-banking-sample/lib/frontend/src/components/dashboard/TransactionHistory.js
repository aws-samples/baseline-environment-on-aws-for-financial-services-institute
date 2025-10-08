// src/components/dashboard/TransactionHistory.js
import React from 'react';
import { useSelector } from 'react-redux';
import {
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

const TransactionHistory = () => {
  const { transactionHistory, transactionHistoryStatus, transactionHistoryError } = useSelector(
    (state) => state.banking,
  );

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
    }).format(Math.abs(amount));
  };

  const getTransactionStyle = (type) => {
    if (type && type.includes('DEPOSIT')) {
      return {
        color: 'success.main',
        icon: <ArrowUpwardIcon fontSize="small" />,
        label: '入金',
      };
    }
    return {
      color: 'error.main',
      icon: <ArrowDownwardIcon fontSize="small" />,
      label: '出金',
    };
  };

  if (transactionHistoryStatus === 'loading') {
    return (
      <Card elevation={2}>
        <CardContent sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
          <CircularProgress />
        </CardContent>
      </Card>
    );
  }

  if (transactionHistoryStatus === 'failed') {
    return (
      <Card elevation={2}>
        <CardContent>
          <Alert severity="error">{transactionHistoryError}</Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card elevation={2}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          最近の取引履歴
        </Typography>
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>日時</TableCell>
                <TableCell>取引内容</TableCell>
                <TableCell align="right">金額</TableCell>
                <TableCell>状態</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {transactionHistory.map((transaction) => {
                const style = getTransactionStyle(transaction.type);
                return (
                  <TableRow key={transaction.transactionId}>
                    <TableCell>{new Date(transaction.timestamp).toLocaleString('ja-JP')}</TableCell>
                    <TableCell>{transaction.description}</TableCell>
                    <TableCell align="right">
                      <Typography
                        color={style.color}
                        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}
                      >
                        {style.icon}
                        {formatAmount(transaction.amount)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={transaction.status}
                        color={transaction.status === 'completed' ? 'success' : 'default'}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
};

export default TransactionHistory;
