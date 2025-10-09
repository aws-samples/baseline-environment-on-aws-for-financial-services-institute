// src/components/layout/AuthenticatedLayout.js
import React from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  Tabs,
  Tab,
  Container,
  useTheme,
  Chip,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import DashboardPage from '../../pages/DashboardPage';
import TransferPage from '../../pages/TransferPage';
import AccountReviewPage from '../../pages/admin/AccountReviewPage';
import TransferEventPage from '../../pages/admin/TransferEventPage';
import { setCurrentTab, setUserMode } from '../../features/ui/uiSlice';
import { logoutUser } from '../../features/auth/authSlice';

const AuthenticatedLayout = () => {
  const { currentTab, userMode } = useSelector((state) => state.ui);
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const theme = useTheme();

  const handleTabChange = (event, newValue) => {
    dispatch(setCurrentTab(newValue));
  };

  const handleModeChange = (event) => {
    const newMode = event.target.checked ? 'admin' : 'customer';
    dispatch(setUserMode(newMode));
  };

  const handleLogout = async () => {
    try {
      await dispatch(logoutUser()).unwrap();
      // タブの状態をリセット
      dispatch(setCurrentTab(0));
      // ログイン画面に戻る
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // エラーが発生してもログイン画面に戻る
      navigate('/login');
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          {/* モード切り替えスイッチ（左端） */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: 1,
              px: 1.5,
              py: 0.5,
              mr: 2,
            }}
          >
            <FormControlLabel
              control={
                <Switch
                  checked={userMode === 'admin'}
                  onChange={handleModeChange}
                  color="secondary"
                  size="small"
                  sx={{
                    '& .MuiSwitch-track': {
                      backgroundColor: 'rgba(255, 255, 255, 0.3)',
                    },
                    '& .MuiSwitch-thumb': {
                      backgroundColor: 'white',
                    },
                  }}
                />
              }
              label={
                <Box display="flex" alignItems="center" gap={0.5}>
                  {userMode === 'admin' ? (
                    <>
                      <AdminPanelSettingsIcon sx={{ color: 'white', fontSize: '1rem' }} />
                      <Typography variant="caption" sx={{ color: 'white', fontWeight: 'medium' }}>
                        管理者
                      </Typography>
                    </>
                  ) : (
                    <>
                      <PersonIcon sx={{ color: 'white', fontSize: '1rem' }} />
                      <Typography variant="caption" sx={{ color: 'white', fontWeight: 'medium' }}>
                        顧客
                      </Typography>
                    </>
                  )}
                </Box>
              }
              sx={{
                color: 'white',
                margin: 0,
                '& .MuiFormControlLabel-label': {
                  color: 'white',
                },
              }}
            />
          </Box>

          <AccountBalanceIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            サンプル銀行
          </Typography>

          {user && userMode === 'customer' && (
            <Box sx={{ display: 'flex', gap: 1, mr: 2 }}>
              <Chip
                icon={<PersonIcon />}
                label={`口座番号: ${
                  user.primaryAccountId
                    ? `${user.primaryAccountId.substring(0, 3)}-${user.primaryAccountId.substring(3)}`
                    : '未設定'
                }`}
                variant="outlined"
                sx={{
                  color: 'white',
                  borderColor: 'white',
                  '& .MuiChip-icon': { color: 'white' },
                }}
              />
              <Chip
                label={`メールアドレス: ${user.email}`}
                variant="outlined"
                sx={{
                  color: 'white',
                  borderColor: 'white',
                }}
              />
            </Box>
          )}

          {userMode === 'customer' && (
            <Button color="inherit" onClick={handleLogout} startIcon={<LogoutIcon />}>
              ログアウト
            </Button>
          )}
        </Toolbar>

        <Tabs
          value={currentTab}
          onChange={handleTabChange}
          centered
          sx={{
            bgcolor: theme.palette.primary.dark,
            '& .MuiTab-root': {
              color: 'white',
              minWidth: 160,
              py: 1.5,
              cursor: 'pointer',
              pointerEvents: 'auto',
              '&.Mui-selected': {
                color: 'white',
              },
            },
            '& .MuiTab-root:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
            },
            '& .MuiTabs-indicator': {
              backgroundColor: 'white',
            },
          }}
        >
          {userMode === 'customer' ? (
            <>
              <Tab
                value={0}
                label="ダッシュボード"
                onClick={() => handleTabChange(null, 0)}
                sx={{
                  fontSize: '1rem',
                  fontWeight: 'medium',
                }}
              />
              <Tab
                value={1}
                label="振込・送金"
                onClick={() => handleTabChange(null, 1)}
                sx={{
                  fontSize: '1rem',
                  fontWeight: 'medium',
                }}
              />
            </>
          ) : (
            <>
              <Tab
                value={0}
                label="口座開設審査"
                onClick={() => handleTabChange(null, 0)}
                sx={{
                  fontSize: '1rem',
                  fontWeight: 'medium',
                }}
              />
              <Tab
                value={1}
                label="振込処理イベント参照"
                onClick={() => handleTabChange(null, 1)}
                sx={{
                  fontSize: '1rem',
                  fontWeight: 'medium',
                }}
              />
            </>
          )}
        </Tabs>
      </AppBar>

      <Box component="main" sx={{ flexGrow: 1, bgcolor: 'background.default' }}>
        <Container maxWidth="lg" sx={{ py: 3 }}>
          {userMode === 'customer' ? (
            <>
              {currentTab === 0 && <DashboardPage />}
              {currentTab === 1 && <TransferPage />}
            </>
          ) : (
            <>
              {currentTab === 0 && <AccountReviewPage />}
              {currentTab === 1 && <TransferEventPage />}
            </>
          )}
        </Container>
      </Box>
    </Box>
  );
};

export default AuthenticatedLayout;
