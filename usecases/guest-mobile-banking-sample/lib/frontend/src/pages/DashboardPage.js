import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Grid, Typography, Box, useMediaQuery, useTheme } from '@mui/material';
import BalanceCard from '../components/dashboard/BalanceCard';
import TransactionChart from '../components/dashboard/TransactionChart';
import TransactionHistory from '../components/dashboard/TransactionHistory';
import QuickActions from '../components/dashboard/QuickActions';
import { fetchBalance, fetchTransactionHistory } from '../features/banking/bankingSlice';

const DashboardPage = () => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { balance, lastUpdated, balanceStatus, balanceError } = useSelector((state) => state.banking);

  // 認証済みユーザー情報を取得
  const { user } = useSelector((state) => state.auth);

  useEffect(() => {
    // ログインユーザーのprimaryAccountIdを使用
    if (user?.primaryAccountId) {
      const accountId = user.primaryAccountId;
      console.log('User info:', user);
      console.log('Using primaryAccountId as accountId:', accountId);

      // 残高と取引履歴を並行して取得
      Promise.all([dispatch(fetchBalance(accountId)), dispatch(fetchTransactionHistory(accountId))]).catch((error) => {
        console.error('Failed to fetch dashboard data:', error);
        console.error('Error details:', error);
      });
    } else {
      console.warn('User primaryAccountId not available, user:', user);
    }
  }, [dispatch, user?.primaryAccountId, user]);

  return (
    <Box sx={{ p: { xs: 1, sm: 2 } }}>
      <Typography
        variant={isMobile ? 'h5' : 'h4'}
        gutterBottom
        sx={{
          mb: { xs: 2, md: 3 },
          fontWeight: 600,
          px: { xs: 1, sm: 0 },
        }}
      >
        ダッシュボード
      </Typography>
      <Grid container spacing={{ xs: 2, md: 3 }}>
        <Grid item xs={12} md={4}>
          <BalanceCard
            balance={balance}
            lastUpdated={lastUpdated}
            isLoading={balanceStatus === 'loading'}
            error={balanceError}
          />
        </Grid>
        <Grid item xs={12} md={8}>
          <QuickActions />
        </Grid>
        {!isMobile && (
          <Grid item xs={12}>
            <TransactionChart />
          </Grid>
        )}
        <Grid item xs={12}>
          <TransactionHistory />
        </Grid>
        {isMobile && (
          <Grid item xs={12}>
            <TransactionChart />
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default DashboardPage;
