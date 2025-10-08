// src/pages/HomePage.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Grid,
  Typography,
  Paper,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import SecurityIcon from '@mui/icons-material/Security';
import SpeedIcon from '@mui/icons-material/Speed';
import LoginIcon from '@mui/icons-material/Login';
import AccountReviewPage from './admin/AccountReviewPage';
import TransferEventPage from './admin/TransferEventPage';

const HomePage = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { userMode, currentTab } = useSelector((state) => state.ui);

  const handleLoginClick = () => {
    navigate('/login');
  };

  // 管理者モードの場合は管理者画面を表示
  if (userMode === 'admin') {
    return (
      <Box sx={{ flexGrow: 1, py: 4 }}>
        <Container maxWidth="lg">{currentTab === 0 ? <AccountReviewPage /> : <TransferEventPage />}</Container>
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1, py: { xs: 2, md: 4 } }}>
      <Container maxWidth="lg">
        {/* ヒーローセクション */}
        <Paper
          elevation={0}
          sx={{
            position: 'relative',
            backgroundColor: 'primary.main',
            color: '#fff',
            mb: { xs: 3, md: 4 },
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            borderRadius: { xs: 1, md: 2 },
            p: { xs: 2, sm: 3, md: 6 },
          }}
        >
          <Box sx={{ maxWidth: { md: '50%' } }}>
            <Typography
              component="h1"
              variant={isMobile ? 'h4' : 'h3'}
              color="inherit"
              gutterBottom
              sx={{ fontWeight: 700 }}
            >
              サンプル銀行で新しい口座を開設
            </Typography>
            <Typography variant={isMobile ? 'body1' : 'h5'} color="inherit" paragraph sx={{ mb: { xs: 2, md: 3 } }}>
              簡単なステップで、あなたの新しい銀行口座を今すぐ開設できます。
            </Typography>
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                gap: { xs: 2, sm: 2 },
                mt: { xs: 2, md: 2 },
              }}
            >
              <Button
                component={RouterLink}
                to="/account-opening"
                variant="contained"
                color="secondary"
                size="large"
                fullWidth={isMobile}
                sx={{
                  minHeight: { xs: '48px', sm: '44px' },
                  fontSize: { xs: '1rem', sm: '0.875rem' },
                }}
              >
                口座開設を始める
              </Button>
              <Button
                variant="outlined"
                color="inherit"
                size="large"
                fullWidth={isMobile}
                onClick={handleLoginClick}
                startIcon={<LoginIcon />}
                sx={{
                  minHeight: { xs: '48px', sm: '44px' },
                  fontSize: { xs: '1rem', sm: '0.875rem' },
                }}
              >
                既存の口座にログイン
              </Button>
            </Box>
          </Box>
        </Paper>

        {/* 特徴セクション */}
        <Typography
          variant={isMobile ? 'h5' : 'h4'}
          component="h2"
          gutterBottom
          align="center"
          sx={{ mb: { xs: 3, md: 4 }, fontWeight: 600 }}
        >
          サンプル銀行の特徴
        </Typography>

        <Grid container spacing={{ xs: 2, md: 4 }} sx={{ mb: { xs: 4, md: 6 } }}>
          <Grid item xs={12} md={4}>
            <Card
              sx={{
                height: '100%',
                transition: 'transform 0.2s',
                '&:hover': { transform: isMobile ? 'none' : 'translateY(-4px)' },
                mx: { xs: 0, sm: 'auto' },
              }}
            >
              <CardContent
                sx={{
                  textAlign: 'center',
                  p: { xs: 2, md: 3 },
                }}
              >
                <AccountBalanceIcon color="primary" sx={{ fontSize: { xs: 48, md: 60 }, mb: { xs: 1, md: 2 } }} />
                <Typography variant={isMobile ? 'h6' : 'h5'} component="h3" gutterBottom sx={{ fontWeight: 600 }}>
                  安心の金融サービス
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  100年以上の歴史を持つサンプル銀行は、安定した金融サービスを提供しています。
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card
              sx={{
                height: '100%',
                transition: 'transform 0.2s',
                '&:hover': { transform: isMobile ? 'none' : 'translateY(-4px)' },
                mx: { xs: 0, sm: 'auto' },
              }}
            >
              <CardContent
                sx={{
                  textAlign: 'center',
                  p: { xs: 2, md: 3 },
                }}
              >
                <SecurityIcon color="primary" sx={{ fontSize: { xs: 48, md: 60 }, mb: { xs: 1, md: 2 } }} />
                <Typography variant={isMobile ? 'h6' : 'h5'} component="h3" gutterBottom sx={{ fontWeight: 600 }}>
                  セキュリティ対策
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  最新のセキュリティ技術を導入し、お客様の資産と情報を守ります。
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card
              sx={{
                height: '100%',
                transition: 'transform 0.2s',
                '&:hover': { transform: isMobile ? 'none' : 'translateY(-4px)' },
                mx: { xs: 0, sm: 'auto' },
              }}
            >
              <CardContent
                sx={{
                  textAlign: 'center',
                  p: { xs: 2, md: 3 },
                }}
              >
                <SpeedIcon color="primary" sx={{ fontSize: { xs: 48, md: 60 }, mb: { xs: 1, md: 2 } }} />
                <Typography variant={isMobile ? 'h6' : 'h5'} component="h3" gutterBottom sx={{ fontWeight: 600 }}>
                  迅速な手続き
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  オンラインでの口座開設はわずか10分で完了。審査結果もスピーディにお知らせします。
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* アクションセクション */}
        <Paper
          elevation={1}
          sx={{
            bgcolor: 'background.paper',
            p: { xs: 2, sm: 3, md: 4 },
            borderRadius: { xs: 1, md: 2 },
          }}
        >
          <Grid container spacing={{ xs: 3, md: 4 }} alignItems="center">
            <Grid item xs={12} md={6}>
              <Typography variant={isMobile ? 'h6' : 'h5'} component="h3" gutterBottom sx={{ fontWeight: 600 }}>
                新規口座開設
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph sx={{ mb: { xs: 2, md: 3 } }}>
                必要なのは本人確認書類だけ。簡単なステップで口座開設が完了します。
              </Typography>
              <Button
                component={RouterLink}
                to="/account-opening"
                variant="contained"
                color="primary"
                size="large"
                fullWidth={isMobile}
                sx={{
                  minHeight: { xs: '48px', sm: '44px' },
                  mb: { xs: 2, md: 0 },
                }}
              >
                口座開設を始める
              </Button>
            </Grid>

            <Grid item xs={12} md={6} sx={{ textAlign: { xs: 'left', md: 'right' } }}>
              <Typography variant={isMobile ? 'h6' : 'h5'} component="h3" gutterBottom sx={{ fontWeight: 600 }}>
                既存の口座をお持ちの方
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph sx={{ mb: { xs: 2, md: 3 } }}>
                インターネットバンキングで残高照会や振込などのサービスをご利用いただけます。
              </Typography>
              <Button
                variant="outlined"
                color="primary"
                size="large"
                fullWidth={isMobile}
                onClick={handleLoginClick}
                startIcon={<LoginIcon />}
                sx={{
                  minHeight: { xs: '48px', sm: '44px' },
                }}
              >
                ログイン
              </Button>
            </Grid>
          </Grid>
        </Paper>
      </Container>
    </Box>
  );
};

export default HomePage;
