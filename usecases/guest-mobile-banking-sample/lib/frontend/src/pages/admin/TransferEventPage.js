import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Paper,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Avatar,
  Stack,
} from '@mui/material';
import { CheckCircle, Error, Schedule, Inbox, Settings } from '@mui/icons-material';
import axios from 'axios';
import { getApiConfig } from '../../config/api';

const TransferEventPage = () => {
  const [transactionId, setTransactionId] = useState('');
  const [events, setEvents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 管理者用APIクライアントを動的に作成
  const createAdminAPI = async () => {
    const config = await getApiConfig();
    return axios.create({
      baseURL: config.BANKING_API,
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': config.API_KEYS.ADMIN,
      },
    });
  };

  const fetchTransaction = async () => {
    if (!transactionId) return;

    setLoading(true);
    setError(null);
    setEvents([]);
    setSummary(null);

    try {
      const api = await createAdminAPI();
      // 管理者用の振込処理イベント取得API（相対パスを使用）
      const response = await api.get(`admin/transfer-events/${transactionId}`);

      setEvents(response.data.events);
      setSummary(response.data.summary);
    } catch (err) {
      console.error('API Error:', err);
      setError(err.response?.data?.message || err.message || 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'received':
        return <Inbox color="info" />;
      case 'processing':
        return <Settings color="warning" />;
      case 'completed':
        return <CheckCircle color="success" />;
      case 'failed':
        return <Error color="error" />;
      default:
        return <Schedule color="disabled" />;
    }
  };

  const getStatusLabel = (status) => {
    switch (status?.toLowerCase()) {
      case 'received':
        return '受付済み';
      case 'processing':
        return '処理中';
      case 'completed':
        return '完了';
      case 'failed':
        return '失敗';
      default:
        return status;
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'received':
        return 'info';
      case 'processing':
        return 'warning';
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'withdraw':
        return '出金処理';
      case 'deposit':
        return '入金処理';
      case 'TransferRequested':
        return '振込依頼';
      default:
        return type;
    }
  };

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
    }).format(amount);
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        振込処理イベント参照
      </Typography>

      {/* 検索フォーム */}
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Box display="flex" gap={2} alignItems="center">
          <TextField
            fullWidth
            label="取引IDを入力"
            value={transactionId}
            onChange={(e) => setTransactionId(e.target.value)}
            placeholder="例: TXN123456789"
          />
          <Button
            variant="contained"
            onClick={fetchTransaction}
            disabled={loading || !transactionId}
            sx={{ minWidth: '120px' }}
          >
            {loading ? <CircularProgress size={24} /> : '検索'}
          </Button>
        </Box>
      </Paper>

      {/* エラー表示 */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* 処理概要 */}
      {summary && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              処理概要
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={2}>
              <Chip label={`総イベント数: ${summary.totalEvents}`} variant="outlined" />
              <Chip label={`状態: ${getStatusLabel(summary.status)}`} color={getStatusColor(summary.status)} />
              <Chip label={`開始: ${new Date(summary.startTime).toLocaleString('ja-JP')}`} variant="outlined" />
              <Chip label={`完了: ${new Date(summary.endTime).toLocaleString('ja-JP')}`} variant="outlined" />
            </Box>
          </CardContent>
        </Card>
      )}

      {/* イベントタイムライン */}
      {events.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              処理履歴
            </Typography>
            <Stack spacing={2}>
              {events.map((event, index) => (
                <Paper key={index} elevation={1} sx={{ p: 2, position: 'relative' }}>
                  {/* タイムライン線 */}
                  {index < events.length - 1 && (
                    <Box
                      sx={{
                        position: 'absolute',
                        left: 20,
                        top: 60,
                        bottom: -16,
                        width: 2,
                        bgcolor: 'divider',
                        zIndex: 0,
                      }}
                    />
                  )}

                  <Box display="flex" gap={2}>
                    {/* ステータスアイコン */}
                    <Avatar
                      sx={{
                        bgcolor:
                          getStatusColor(event.status) === 'success'
                            ? 'success.main'
                            : getStatusColor(event.status) === 'error'
                            ? 'error.main'
                            : getStatusColor(event.status) === 'warning'
                            ? 'warning.main'
                            : 'info.main',
                        width: 40,
                        height: 40,
                        zIndex: 1,
                      }}
                    >
                      {getStatusIcon(event.status)}
                    </Avatar>

                    {/* イベント内容 */}
                    <Box flex={1}>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                        <Typography variant="h6">{getTypeLabel(event.type)}</Typography>
                        <Chip label={getStatusLabel(event.status)} color={getStatusColor(event.status)} size="small" />
                      </Box>

                      {/* イベント詳細 */}
                      {event.payload && (
                        <Box mb={2}>
                          {event.payload.amount && (
                            <Typography variant="body2">
                              <strong>金額:</strong> {formatAmount(event.payload.amount)}
                            </Typography>
                          )}
                          {event.payload.sourceAccountId && (
                            <Typography variant="body2">
                              <strong>出金口座:</strong> {event.payload.sourceAccountId}
                            </Typography>
                          )}
                          {event.payload.targetAccountId && (
                            <Typography variant="body2">
                              <strong>入金口座:</strong> {event.payload.targetAccountId}
                            </Typography>
                          )}
                          {event.payload.description && (
                            <Typography variant="body2">
                              <strong>説明:</strong> {event.payload.description}
                            </Typography>
                          )}
                        </Box>
                      )}

                      <Typography variant="caption" color="text.secondary">
                        {event.formattedTimestamp}
                      </Typography>

                      {/* 処理履歴 */}
                      {event.processHistory && event.processHistory.length > 0 && (
                        <Box mt={2}>
                          <Divider sx={{ mb: 1 }} />
                          <Typography variant="subtitle2" gutterBottom>
                            詳細履歴
                          </Typography>
                          <List dense>
                            {event.processHistory.map((history, historyIndex) => (
                              <ListItem key={historyIndex} sx={{ py: 0.5, pl: 0 }}>
                                <ListItemIcon sx={{ minWidth: 36 }}>
                                  <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
                                    {getStatusIcon(history.status)}
                                  </Avatar>
                                </ListItemIcon>
                                <ListItemText
                                  primary={
                                    <Box display="flex" gap={1} alignItems="center">
                                      <Chip
                                        label={getStatusLabel(history.status)}
                                        color={getStatusColor(history.status)}
                                        size="small"
                                      />
                                      <Typography variant="body2">{getTypeLabel(history.type)}</Typography>
                                    </Box>
                                  }
                                  secondary={
                                    <Box>
                                      <Typography variant="caption">
                                        {new Date(history.timestamp).toLocaleString('ja-JP')}
                                      </Typography>
                                      {history.error && (
                                        <Typography variant="caption" color="error" display="block">
                                          エラー: {history.error.message}
                                        </Typography>
                                      )}
                                    </Box>
                                  }
                                />
                              </ListItem>
                            ))}
                          </List>
                        </Box>
                      )}
                    </Box>
                  </Box>
                </Paper>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default TransferEventPage;
