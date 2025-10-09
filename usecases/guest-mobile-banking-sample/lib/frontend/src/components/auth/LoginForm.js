import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
  Divider,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Visibility, VisibilityOff, Email, Lock, ArrowBack, AccountBalance } from '@mui/icons-material';
import { loginUser, clearError } from '../../features/auth/authSlice';

const LoginForm = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { isLoading, error } = useSelector((state) => state.auth);

  const [formData, setFormData] = useState({
    loginId: '', // メールアドレスからloginIdに変更
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // フォーム入力の処理
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // エラーをクリア
    if (formErrors[name]) {
      setFormErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }

    if (error) {
      dispatch(clearError());
    }
  };

  // バリデーション
  const validateForm = () => {
    const errors = {};

    if (!formData.loginId) {
      errors.loginId = 'ログインIDを入力してください';
    } else if (formData.loginId.length < 3) {
      errors.loginId = 'ログインIDは3文字以上で入力してください';
    }

    if (!formData.password) {
      errors.password = 'パスワードを入力してください';
    } else if (formData.password.length < 6) {
      errors.password = 'パスワードは6文字以上で入力してください';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ログイン処理
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await dispatch(
        loginUser({
          loginId: formData.loginId,
          password: formData.password,
        }),
      ).unwrap();

      console.log('Login successful, redirecting to banking...');
      navigate('/banking');
    } catch (error) {
      console.error('Login failed:', error);
      // エラーはReduxで管理されるので、ここでは何もしない
    }
  };

  // パスワード表示切り替え
  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  // デモユーザーでのログイン
  const handleDemoLogin = (userType) => {
    const demoUsers = {
      user1: { loginId: 'user001', password: 'password123' },
      user2: { loginId: 'user002', password: 'password123' },
    };

    const demoUser = demoUsers[userType];
    setFormData(demoUser);
  };

  // トップ画面に戻る
  const handleBackToHome = () => {
    navigate('/');
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: 'background.default',
        padding: { xs: 1, sm: 2 },
      }}
    >
      <Card
        sx={{
          maxWidth: { xs: '100%', sm: 400 },
          width: '100%',
          boxShadow: { xs: 0, sm: 3 },
          borderRadius: { xs: 0, sm: 2 },
        }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 4 } }}>
          {/* トップに戻るボタン */}
          <Box sx={{ mb: 2 }}>
            <Button
              variant="text"
              startIcon={<ArrowBack />}
              onClick={handleBackToHome}
              sx={{
                color: 'text.secondary',
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
              }}
            >
              トップページに戻る
            </Button>
          </Box>

          <Box sx={{ textAlign: 'center', mb: { xs: 2, sm: 3 } }}>
            <AccountBalance
              sx={{
                fontSize: { xs: 40, sm: 48 },
                color: 'primary.main',
                mb: { xs: 1, sm: 2 },
              }}
            />
            <Typography
              variant={isMobile ? 'h5' : 'h4'}
              component="h1"
              gutterBottom
              color="primary"
              sx={{ fontWeight: 600 }}
            >
              ログイン
            </Typography>
            <Typography variant="body2" color="text.secondary">
              サンプル銀行オンラインバンキング
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              name="loginId"
              label="ログインID"
              type="text"
              value={formData.loginId}
              onChange={handleInputChange}
              error={!!formErrors.loginId}
              helperText={formErrors.loginId}
              margin="normal"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Email color="action" />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              name="password"
              label="パスワード"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={handleInputChange}
              error={!!formErrors.password}
              helperText={formErrors.password}
              margin="normal"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={handleTogglePasswordVisibility} edge="end">
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={isLoading}
              sx={{
                mt: { xs: 2, sm: 3 },
                mb: 2,
                minHeight: { xs: '48px', sm: '44px' },
                fontSize: { xs: '1rem', sm: '0.875rem' },
              }}
            >
              {isLoading ? <CircularProgress size={24} color="inherit" /> : 'ログイン'}
            </Button>
          </form>

          <Divider sx={{ my: 3 }}>
            <Typography variant="body2" color="text.secondary">
              デモユーザー
            </Typography>
          </Divider>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              fullWidth
              onClick={() => handleDemoLogin('user1')}
              disabled={isLoading}
            >
              ユーザー1
            </Button>
            <Button
              variant="outlined"
              size="small"
              fullWidth
              onClick={() => handleDemoLogin('user2')}
              disabled={isLoading}
            >
              ユーザー2
            </Button>
          </Box>

          <Typography variant="caption" display="block" sx={{ mt: 2, textAlign: 'center' }}>
            デモユーザー: user001 / user002
            <br />
            パスワード: password123
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default LoginForm;
