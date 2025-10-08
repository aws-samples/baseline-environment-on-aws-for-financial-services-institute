import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Navigate } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { restoreAuthState, verifyUserToken } from '../../features/auth/authSlice';

const ProtectedRoute = ({ children }) => {
  const dispatch = useDispatch();
  const { isAuthenticated, isLoading, user } = useSelector((state) => state.auth);
  const { userMode } = useSelector((state) => state.ui);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // 保存された認証状態を復元
        dispatch(restoreAuthState());

        // トークンが存在する場合は検証
        const token = localStorage.getItem('authToken');
        if (token) {
          await dispatch(verifyUserToken()).unwrap();
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        // エラーの場合はローカルストレージをクリア
        localStorage.removeItem('authToken');
        localStorage.removeItem('userInfo');
        localStorage.removeItem('tokenExpiresAt');
      } finally {
        setIsInitializing(false);
      }
    };

    initializeAuth();
  }, [dispatch]);

  // 初期化中の表示
  if (isInitializing || isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          backgroundColor: 'background.default',
        }}
      >
        <CircularProgress size={48} sx={{ mb: 2 }} />
        <Typography variant="body1" color="text.secondary">
          認証情報を確認しています...
        </Typography>
      </Box>
    );
  }

  // 管理者モードの場合は認証をスキップ
  if (userMode === 'admin') {
    return children;
  }

  // 顧客モードで認証されていない場合はログインページにリダイレクト
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // 認証済みの場合は子コンポーネントを表示
  return children;
};

export default ProtectedRoute;
