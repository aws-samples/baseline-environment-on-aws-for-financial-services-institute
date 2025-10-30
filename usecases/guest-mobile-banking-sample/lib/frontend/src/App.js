import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import HomePage from './pages/HomePage';
import AccountOpeningPage from './pages/AccountOpeningPage';
import ConfirmationPage from './pages/ConfirmationPage';
import CompletionPage from './pages/CompletionPage';
import AuthenticatedLayout from './components/layout/AuthenticatedLayout';
import ErrorPage from './pages/ErrorPage';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/auth/ProtectedRoute';

function App() {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
      }}
    >
      <Routes>
        {/* 認証後の画面（保護されたルート） */}
        <Route
          path="/banking/*"
          element={
            <ProtectedRoute>
              <AuthenticatedLayout />
            </ProtectedRoute>
          }
        />

        {/* 管理者画面（認証不要） */}
        <Route path="/admin" element={<AuthenticatedLayout />} />

        {/* ログインページ */}
        <Route path="/login" element={<LoginPage />} />

        {/* 認証前の画面（ヘッダー・フッター付き） */}
        <Route
          path="/"
          element={
            <>
              <Header />
              <HomePage />
              <Footer />
            </>
          }
        />
        <Route
          path="/account-opening"
          element={
            <>
              <Header />
              <AccountOpeningPage />
              <Footer />
            </>
          }
        />
        <Route
          path="/confirmation"
          element={
            <>
              <Header />
              <ConfirmationPage />
              <Footer />
            </>
          }
        />
        <Route
          path="/completion"
          element={
            <>
              <Header />
              <CompletionPage />
              <Footer />
            </>
          }
        />
        <Route
          path="/error"
          element={
            <>
              <Header />
              <ErrorPage />
              <Footer />
            </>
          }
        />
        <Route path="*" element={<Navigate to="/error" replace />} />
      </Routes>
    </Box>
  );
}

export default App;
