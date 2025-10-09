import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Box } from '@mui/material';
import LoginForm from '../components/auth/LoginForm';
import { restoreAuthState } from '../features/auth/authSlice';

const LoginPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated } = useSelector((state) => state.auth);

  useEffect(() => {
    // 保存された認証状態を復元
    dispatch(restoreAuthState());
  }, [dispatch]);

  useEffect(() => {
    // 既にログイン済みの場合はバンキング画面にリダイレクト
    if (isAuthenticated) {
      navigate('/banking');
    }
  }, [isAuthenticated, navigate]);

  return (
    <Box>
      <LoginForm />
    </Box>
  );
};

export default LoginPage;
