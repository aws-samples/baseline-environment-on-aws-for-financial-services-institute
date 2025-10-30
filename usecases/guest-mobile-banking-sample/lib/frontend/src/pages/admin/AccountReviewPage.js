import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import KeyIcon from '@mui/icons-material/Key';
import RefreshIcon from '@mui/icons-material/Refresh';
import axios from 'axios';
import { getApiConfig } from '../../config/api';

const AccountReviewPage = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [reviewDialog, setReviewDialog] = useState(false);
  const [credentialsDialog, setCredentialsDialog] = useState(false);
  const [reviewAction, setReviewAction] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [credentials, setCredentials] = useState(null);
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

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    try {
      const api = await createAdminAPI();
      const response = await api.get('admin/account-applications');
      setApplications(response.data.applications || []);
    } catch (err) {
      console.error('API Error:', err);
      setError(err.response?.data?.message || err.message || '申請データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const getStatusLabel = (status) => {
    switch (status) {
      case 'PENDING':
        return '審査中';
      case 'CONFIRMED':
        return '処理中';
      case 'COMPLETED':
        return '完了';
      case 'REJECTED':
        return '却下';
      default:
        return status;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'PENDING':
        return 'warning';
      case 'CONFIRMED':
        return 'info';
      case 'COMPLETED':
        return 'success';
      case 'REJECTED':
        return 'error';
      default:
        return 'default';
    }
  };

  const getIdTypeLabel = (idType) => {
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

  const formatDateTime = (dateString, fallback = '-') => {
    if (!dateString) return fallback;
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return fallback;
      return date.toLocaleString('ja-JP');
    } catch (error) {
      console.error('Date formatting error:', error);
      return fallback;
    }
  };

  const handleReview = (application, action) => {
    setSelectedApplication(application);
    setReviewAction(action);
    setReviewDialog(true);
  };

  const handleReviewSubmit = async () => {
    try {
      const api = await createAdminAPI();
      const endpoint =
        reviewAction === 'approve'
          ? `api/accounts/confirm/${selectedApplication.transactionId}`
          : `api/accounts/confirm/${selectedApplication.transactionId}/reject`;

      await api.post(endpoint, {
        comment: reviewComment,
      });

      // 申請一覧を再取得
      await fetchApplications();

      setReviewDialog(false);
      setReviewComment('');
      setSelectedApplication(null);
    } catch (err) {
      console.error('Review API Error:', err);
      setError(err.response?.data?.message || err.message || '審査処理に失敗しました');
    }
  };

  const handleShowCredentials = async (application) => {
    try {
      const api = await createAdminAPI();
      const response = await api.get(`admin/account-applications/${application.id}/credentials`);
      setCredentials(response.data);
      setCredentialsDialog(true);
    } catch (err) {
      console.error('Credentials API Error:', err);
      setError(err.response?.data?.message || err.message || '認証情報の取得に失敗しました');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4">口座開設審査</Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<RefreshIcon />}
          onClick={fetchApplications}
          disabled={loading}
        >
          更新
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>申請ID</TableCell>
              <TableCell>申請者名</TableCell>
              <TableCell>メールアドレス</TableCell>
              <TableCell>本人確認書類</TableCell>
              <TableCell>書類番号</TableCell>
              <TableCell>状態</TableCell>
              <TableCell>更新日時</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {applications.map((application) => (
              <TableRow key={application.id}>
                <TableCell>{application.id}</TableCell>
                <TableCell>{application.applicantName}</TableCell>
                <TableCell>{application.email}</TableCell>
                <TableCell>{getIdTypeLabel(application.idType)}</TableCell>
                <TableCell>{application.idNumber || '-'}</TableCell>
                <TableCell>
                  <Chip
                    label={getStatusLabel(application.status)}
                    color={getStatusColor(application.status)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {application.status === 'COMPLETED'
                    ? formatDateTime(application.completedAt, '完了日時不明')
                    : formatDateTime(application.submittedAt, '申請日時不明')}
                </TableCell>
                <TableCell>
                  <Box display="flex" gap={1}>
                    {application.status === 'PENDING' && (
                      <>
                        <Button
                          size="small"
                          color="success"
                          startIcon={<CheckCircleIcon />}
                          onClick={() => handleReview(application, 'approve')}
                        >
                          承認
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          startIcon={<CancelIcon />}
                          onClick={() => handleReview(application, 'reject')}
                        >
                          却下
                        </Button>
                      </>
                    )}
                    {application.status === 'CONFIRMED' && <Chip label="処理中..." color="info" size="small" />}
                    {application.status === 'COMPLETED' && (
                      <Button
                        size="small"
                        color="primary"
                        startIcon={<KeyIcon />}
                        onClick={() => handleShowCredentials(application)}
                      >
                        ID/パスワード
                      </Button>
                    )}
                    {application.status === 'REJECTED' && <Chip label="却下済み" color="error" size="small" />}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 審査ダイアログ */}
      <Dialog open={reviewDialog} onClose={() => setReviewDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{reviewAction === 'approve' ? '申請を承認' : '申請を却下'}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            申請者: {selectedApplication?.applicantName}
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="コメント（任意）"
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReviewDialog(false)}>キャンセル</Button>
          <Button
            onClick={handleReviewSubmit}
            color={reviewAction === 'approve' ? 'success' : 'error'}
            variant="contained"
          >
            {reviewAction === 'approve' ? '承認する' : '却下する'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 認証情報表示ダイアログ */}
      <Dialog open={credentialsDialog} onClose={() => setCredentialsDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>初期ログイン情報</DialogTitle>
        <DialogContent>
          {credentials && (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                この情報をお客様にお伝えください。初回ログイン時にパスワード変更が必要です。
                ※本サンプルではパスワード変更は実装していません
              </Alert>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                申請ID: {credentials.applicationId}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                取引ID: {credentials.transactionId}
              </Typography>
              <Box mt={2}>
                <Typography variant="h6" gutterBottom>
                  初期ログイン情報
                </Typography>
                <TextField
                  fullWidth
                  label="ログインID"
                  value={credentials.loginId || ''}
                  InputProps={{ readOnly: true }}
                  sx={{ mb: 2 }}
                />
                <TextField
                  fullWidth
                  label="初期パスワード"
                  value={credentials.temporaryPassword || ''}
                  InputProps={{ readOnly: true }}
                  helperText="※ユーザーの初回ログイン時に変更が必要です"
                  sx={{ mb: 2 }}
                />
                <TextField
                  fullWidth
                  label="口座番号"
                  value={credentials.accountNumber || ''}
                  InputProps={{ readOnly: true }}
                  sx={{ mb: 2 }}
                />
                <Typography variant="caption" color="text.secondary">
                  完了日時: {credentials.completedAt ? new Date(credentials.completedAt).toLocaleString('ja-JP') : ''}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCredentialsDialog(false)}>閉じる</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AccountReviewPage;
