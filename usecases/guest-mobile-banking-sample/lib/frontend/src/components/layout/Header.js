import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Button,
  useMediaQuery,
  useTheme,
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
} from '@mui/material';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import BankIcon from '@mui/icons-material/AccountBalance';
import PersonIcon from '@mui/icons-material/Person';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { setUserMode, setCurrentTab } from '../../features/ui/uiSlice';

const Header = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { userMode, currentTab } = useSelector((state) => state.ui);

  // ログイン画面への遷移
  const handleLoginClick = () => {
    navigate('/login');
  };

  // モード切り替え
  const handleModeChange = (event) => {
    const newMode = event.target.checked ? 'admin' : 'customer';
    dispatch(setUserMode(newMode));
  };

  // タブ切り替え
  const handleTabChange = (event, newValue) => {
    dispatch(setCurrentTab(newValue));
  };

  return (
    <AppBar position="static" color="primary" elevation={0}>
      <Toolbar sx={{ px: { xs: 2, sm: 3, md: 4 } }}>
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

        {/* サンプル銀行ロゴ */}
        <Box
          component={Link}
          to="/"
          sx={{
            display: 'flex',
            alignItems: 'center',
            textDecoration: 'none',
            color: 'inherit',
            flexGrow: 1,
          }}
        >
          <BankIcon sx={{ mr: 1, fontSize: isMobile ? 24 : 32 }} />
          <Typography variant={isMobile ? 'h6' : 'h5'} component="div" sx={{ fontWeight: 700 }}>
            サンプル銀行
          </Typography>
        </Box>

        {/* 右側のコンテンツ */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" color="inherit" sx={{ mr: 1, display: { xs: 'none', md: 'block' } }}>
            安心と信頼の金融サービス
          </Typography>
          <Button variant="outlined" color="inherit" size={isMobile ? 'small' : 'medium'} onClick={handleLoginClick}>
            ログイン
          </Button>
        </Box>
      </Toolbar>

      {/* 管理者モード用のタブ */}
      {userMode === 'admin' && (
        <Tabs
          value={currentTab}
          onChange={handleTabChange}
          centered={!isMobile}
          variant={isMobile ? 'scrollable' : 'standard'}
          scrollButtons={isMobile ? 'auto' : false}
          sx={{
            bgcolor: theme.palette.primary.dark,
            '& .MuiTab-root': {
              color: 'rgba(255, 255, 255, 0.8)',
              minWidth: { xs: 120, sm: 160 },
              py: { xs: 1, sm: 1.5 },
              fontSize: { xs: '0.875rem', sm: '1rem' },
              '&.Mui-selected': {
                color: 'rgba(255, 255, 255, 0.8)',
              },
            },
            '& .MuiTabs-indicator': {
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
            },
          }}
        >
          <Tab
            label={isMobile ? '審査' : '口座開設審査'}
            sx={{
              fontWeight: 'medium',
            }}
          />
          <Tab
            label={isMobile ? 'イベント参照' : '振込処理イベント参照'}
            sx={{
              fontWeight: 'medium',
            }}
          />
        </Tabs>
      )}
    </AppBar>
  );
};

export default Header;
