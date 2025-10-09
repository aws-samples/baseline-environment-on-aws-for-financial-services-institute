import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Box, Container, Typography, Grid, Button } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

const Footer = () => {
  const navigate = useNavigate();
  const { userMode } = useSelector((state) => state.ui);

  // 管理者モード時はFooterを表示しない
  if (userMode === 'admin') {
    return null;
  }

  // ログイン画面へのリンク
  const handleLoginClick = () => {
    navigate('/login'); // ログイン画面に遷移
  };

  return (
    <Box
      component="footer"
      sx={{
        py: 3,
        px: 2,
        mt: 'auto',
        backgroundColor: (theme) => theme.palette.grey[100],
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Typography variant="h6" color="text.primary" gutterBottom>
              サンプル銀行
            </Typography>
            <Typography variant="body2" color="text.secondary">
              安心と信頼の金融サービス
            </Typography>
          </Grid>

          <Grid item xs={12} md={4}>
            <Typography variant="h6" color="text.primary" gutterBottom>
              リンク
            </Typography>
            <Button
              component={RouterLink}
              to="/"
              color="inherit"
              sx={{
                p: 0,
                minWidth: 'auto',
                textAlign: 'left',
                display: 'block',
                mb: 0.5,
                '&:hover': {
                  backgroundColor: 'transparent',
                  textDecoration: 'underline',
                },
              }}
            >
              ホーム
            </Button>
            <Button
              component={RouterLink}
              to="/account-opening"
              color="inherit"
              sx={{
                p: 0,
                minWidth: 'auto',
                textAlign: 'left',
                display: 'block',
                mb: 0.5,
                '&:hover': {
                  backgroundColor: 'transparent',
                  textDecoration: 'underline',
                },
              }}
            >
              口座開設
            </Button>
            <Button
              onClick={handleLoginClick}
              color="inherit"
              sx={{
                p: 0,
                minWidth: 'auto',
                textAlign: 'left',
                display: 'block',
                mb: 0.5,
                '&:hover': {
                  backgroundColor: 'transparent',
                  textDecoration: 'underline',
                },
              }}
            >
              ログイン
            </Button>
          </Grid>

          <Grid item xs={12} md={4}>
            <Typography variant="h6" color="text.primary" gutterBottom>
              お問い合わせ
            </Typography>
            <Typography variant="body2" color="text.secondary">
              カスタマーサポート: 0120-XXX-XXX
            </Typography>
            <Typography variant="body2" color="text.secondary">
              受付時間: 平日 9:00～17:00
            </Typography>
          </Grid>
        </Grid>

        <Box
          sx={{
            mt: 3,
            pt: 2,
            borderTop: '1px solid',
            borderColor: 'divider',
            textAlign: 'center',
          }}
        >
          <Typography variant="body2" color="text.secondary">
            {'© '}
            {new Date().getFullYear()}{' '}
            <Button
              component={RouterLink}
              to="/"
              color="inherit"
              sx={{
                p: 0,
                minWidth: 'auto',
                fontWeight: 'inherit',
                '&:hover': {
                  backgroundColor: 'transparent',
                  textDecoration: 'underline',
                },
              }}
            >
              サンプル銀行
            </Button>
            {' All rights reserved.'}
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default Footer;
