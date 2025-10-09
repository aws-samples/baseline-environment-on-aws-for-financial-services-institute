import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Divider,
  Grid,
  Paper,
  Typography,
  Alert,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { submitAccountApplication } from '../features/accountOpening/accountOpeningSlice';

const ConfirmationPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { applicationData, status, error } = useSelector((state) => state.accountOpening);

  const isLoading = status === 'loading';

  // 申込データがない場合はホームにリダイレクト
  useEffect(() => {
    if (!applicationData) {
      navigate('/', { replace: true });
    }
  }, [applicationData, navigate]);

  const handleBack = () => {
    navigate(-1);
  };

  const handleConfirm = async () => {
    try {
      console.log('申込を送信します');
      // 実際に申込APIを呼び出し
      const resultAction = await dispatch(submitAccountApplication(applicationData));

      if (submitAccountApplication.fulfilled.match(resultAction)) {
        // 成功時、完了画面に遷移
        navigate('/completion', { replace: true });
      }
      // エラー時はエラー表示されるので、遷移しない
    } catch (error) {
      console.error('申込送信中にエラーが発生しました', error);
    }
  };

  // 申込データがない場合は何も表示しない
  if (!applicationData) {
    return null;
  }

  // 本人確認書類の種類を日本語表示に変換
  const getIdTypeDisplay = (idType) => {
    switch (idType) {
      case 'drivingLicense':
        return '運転免許証';
      case 'passport':
        return 'パスポート';
      case 'residentCard':
        return 'マイナンバーカード';
      default:
        return idType;
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Card elevation={3}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom align="center" color="primary">
              申込内容の確認
            </Typography>
            <Typography variant="body1" align="center" color="text.secondary" sx={{ mb: 3 }}>
              以下の内容で口座開設を申し込みます。内容をご確認ください。
            </Typography>

            <Stepper activeStep={1} sx={{ mb: 4 }}>
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

          <Paper elevation={0} sx={{ p: 3, bgcolor: '#f8f9fa', mb: 3 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="h6" color="primary" gutterBottom>
                  お客様情報
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  氏名
                </Typography>
                <Typography variant="body1">{applicationData.fullName}</Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  フリガナ
                </Typography>
                <Typography variant="body1">{applicationData.kana}</Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  生年月日
                </Typography>
                <Typography variant="body1">
                  {new Date(applicationData.birthdate).toLocaleDateString('ja-JP')}
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  メールアドレス
                </Typography>
                <Typography variant="body1">{applicationData.email}</Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  電話番号
                </Typography>
                <Typography variant="body1">{applicationData.phone}</Typography>
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="h6" color="primary" gutterBottom>
                  住所情報
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  郵便番号
                </Typography>
                <Typography variant="body1">{applicationData.postalCode}</Typography>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">
                  住所
                </Typography>
                <Typography variant="body1">{applicationData.address}</Typography>
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="h6" color="primary" gutterBottom>
                  本人確認情報
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  本人確認書類
                </Typography>
                <Typography variant="body1">{getIdTypeDisplay(applicationData.idType)}</Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  本人確認書類番号
                </Typography>
                <Typography variant="body1">{applicationData.idNumber}</Typography>
              </Grid>
            </Grid>
          </Paper>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
            <Button startIcon={<ArrowBackIcon />} onClick={handleBack} disabled={isLoading}>
              戻る
            </Button>

            <Button
              variant="contained"
              color="primary"
              size="large"
              onClick={handleConfirm}
              disabled={isLoading}
              sx={{ minWidth: 200 }}
            >
              {isLoading ? <CircularProgress size={24} color="inherit" /> : '申し込みを確定する'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
};

export default ConfirmationPage;
