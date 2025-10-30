import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Container, Typography, Paper } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

const ErrorPage = () => {
  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
        <ErrorOutlineIcon color="error" sx={{ fontSize: 80, mb: 3 }} />
        <Typography variant="h4" component="h1" gutterBottom>
          エラーが発生しました
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          申し訳ありませんが、問題が発生しました。
          <br />
          しばらく経ってから再度お試しいただくか、カスタマーサポートにお問い合わせください。
        </Typography>
        <Box sx={{ mt: 4 }}>
          <Button component={RouterLink} to="/" variant="contained" color="primary" size="large">
            ホームに戻る
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default ErrorPage;
