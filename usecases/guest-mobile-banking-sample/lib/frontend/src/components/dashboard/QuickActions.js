// src/components/dashboard/QuickActions.js
import React from 'react';
import { useDispatch } from 'react-redux';
import { Card, CardContent, Typography, Grid, Button } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { setCurrentTab } from '../../features/ui/uiSlice';

const QuickActions = () => {
  const dispatch = useDispatch();

  const handleTransferClick = () => {
    dispatch(setCurrentTab(1)); // 振込・送金タブに切り替え
  };

  return (
    <Card elevation={2}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          クイックアクション
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Button
              variant="contained"
              startIcon={<SendIcon />}
              onClick={handleTransferClick}
              fullWidth
              size="large"
              sx={{
                justifyContent: 'flex-start',
                height: '60px',
                padding: '16px',
                fontSize: '1.1rem',
              }}
            >
              振込・送金
            </Button>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                display: 'flex',
                alignItems: 'center',
                height: '60px',
                padding: '16px',
                fontStyle: 'italic',
              }}
            >
              その他の機能は今後追加予定です
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default QuickActions;
