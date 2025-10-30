// src/components/dashboard/BalanceCard.js
import React from 'react';
import { Card, CardContent, Typography, Skeleton, Alert } from '@mui/material';

const BalanceCard = ({ balance, lastUpdated, isLoading, error }) => {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('ja-JP');
  };

  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">{error}</Alert>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Skeleton variant="text" height={40} />
          <Skeleton variant="text" height={20} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          現在の残高
        </Typography>
        <Typography variant="h4" component="div">
          {formatCurrency(balance)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          最終更新: {formatDate(lastUpdated)}
        </Typography>
      </CardContent>
    </Card>
  );
};

export default BalanceCard;
