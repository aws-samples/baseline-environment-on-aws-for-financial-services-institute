import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Typography, Box, Snackbar, Alert, CircularProgress, useMediaQuery, useTheme } from '@mui/material';
import TransferInputForm from '../components/transfer/TransferInputForm';
import TransferConfirmation from '../components/transfer/TransferConfirmation';
import { executeTransfer, fetchTransactionHistory, fetchBalance } from '../features/banking/bankingSlice';

const TransferPage = () => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const transferStatus = useSelector((state) => state.banking.transferStatus);

  // 認証済みユーザー情報を取得
  const { user } = useSelector((state) => state.auth);

  const [step, setStep] = useState('input');
  const [transferData, setTransferData] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [formInitialValues, setFormInitialValues] = useState(null);

  const handleConfirmTransfer = (data) => {
    setTransferData(data);
    setStep('confirm');
  };

  const handleBack = () => {
    setFormInitialValues(transferData);
    setStep('input');
  };

  const handleExecuteTransfer = async () => {
    try {
      // 支店番号を使ってtargetAccountIdを生成
      const branchCode = transferData.branchCode || '001'; // デフォルトは001
      const targetAccountId = `${branchCode}${transferData.accountNumber.padStart(3, '0')}`;

      const apiData = {
        sourceAccountId: user?.primaryAccountId || 'ACC001', // ログインユーザーのアカウントIDを使用
        targetAccountId,
        amount: parseInt(transferData.amount),
        description: transferData.message || `${transferData.bankName} ${transferData.branchName}への振込`,
      };

      console.log('Sending transfer request:', apiData);

      const result = await dispatch(executeTransfer(apiData)).unwrap();
      console.log('Transfer result:', result);

      setSuccessMessage(`${result.message} 取引ID: ${result.transactionId}`);
      setFormInitialValues(null); // 成功時は入力内容をクリア
      setStep('input');
      setTransferData(null);

      // 振込成功後に残高と取引履歴を再取得（バックグラウンドで実行）
      const accountId = user?.primaryAccountId || 'ACC001';
      Promise.all([dispatch(fetchBalance(accountId)), dispatch(fetchTransactionHistory(accountId))]).catch(
        (refreshError) => {
          console.warn('Failed to refresh data after transfer:', refreshError);
          // データ再取得の失敗は振込成功メッセージに影響させない
        },
      );
    } catch (error) {
      console.error('Transfer failed:', error);

      // Redux側で適切に処理されたエラーメッセージを使用
      const errorMessage =
        error || error.message || '振込処理中にエラーが発生しました。コールセンターまでお問い合わせください。';
      setErrorMessage(errorMessage);
    }
  };

  const handleCloseSnackbar = () => {
    setSuccessMessage('');
    setErrorMessage('');
  };

  if (transferStatus === 'loading') {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

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
        振込・送金
      </Typography>
      {step === 'input' ? (
        <TransferInputForm onConfirm={handleConfirmTransfer} initialValues={formInitialValues} />
      ) : (
        <TransferConfirmation transferData={transferData} onBack={handleBack} onConfirm={handleExecuteTransfer} />
      )}
      <Snackbar open={!!successMessage} autoHideDuration={6000} onClose={handleCloseSnackbar}>
        <Alert onClose={handleCloseSnackbar} severity="success" sx={{ width: '100%' }}>
          {successMessage}
        </Alert>
      </Snackbar>
      <Snackbar open={!!errorMessage} autoHideDuration={6000} onClose={handleCloseSnackbar}>
        <Alert onClose={handleCloseSnackbar} severity="error" sx={{ width: '100%' }}>
          {errorMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default TransferPage;
