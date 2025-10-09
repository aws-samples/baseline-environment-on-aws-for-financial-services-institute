import React, { useEffect } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Box, Button, Card, CardContent, Container, Typography, Stepper, Step, StepLabel, Alert } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { resetAccountOpening } from '../features/accountOpening/accountOpeningSlice';

const CompletionPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { tempAccountId, transactionId, error } = useSelector((state) => state.accountOpening);

  // 申込IDがない場合はホームにリダイレクト
  useEffect(() => {
    if (!tempAccountId && !transactionId) {
      navigate('/', { replace: true });
    }
  }, [tempAccountId, transactionId, navigate]);

  // 申込IDがない場合は何も表示しない
  if (!tempAccountId && !transactionId) {
    return null;
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Card elevation={3}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom align="center" color="primary">
              口座開設申込受付完了
            </Typography>

            <Stepper activeStep={2} sx={{ mb: 4 }}>
              <Step>
                <StepLabel>情報入力</StepLabel>
              </Step>
              <Step>
                <StepLabel>内容確認</StepLabel>
              </Step>
              <Step>
                <StepLabel>申込完了</StepLabel>
              </Step>
            </Stepper>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ textAlign: 'center', py: 3 }}>
            <CheckCircleOutlineIcon color="success" sx={{ fontSize: 80, mb: 3 }} />
            <Typography variant="h5" gutterBottom>
              口座開設のお申込みを受け付けました
            </Typography>

            {/* 受付番号を目立つように表示 */}
            <Box
              sx={{
                bgcolor: 'success.light',
                color: 'success.dark',
                p: 3,
                borderRadius: 2,
                mb: 3,
                border: '2px solid',
                borderColor: 'success.main',
              }}
            >
              <Typography variant="h6" gutterBottom>
                受付番号
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 'bold', letterSpacing: 1 }}>
                {transactionId || tempAccountId}
              </Typography>
            </Box>

            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
              お申込み内容の確認メールをお送りしました。
              <br />
              口座開設の処理を開始いたします。
              <br />
              処理完了時にメールでご連絡いたしますので、しばらくお待ちください。
              <br />
              <br />
              ※受付番号はお問い合わせの際に必要となりますので、大切に保管してください。
            </Typography>

            <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
              <Button
                component={RouterLink}
                to="/"
                variant="contained"
                color="primary"
                size="large"
                onClick={() => dispatch(resetAccountOpening())}
              >
                ホームに戻る
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
};

export default CompletionPage;
