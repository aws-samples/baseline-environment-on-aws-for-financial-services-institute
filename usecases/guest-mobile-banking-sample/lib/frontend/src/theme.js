import { createTheme } from '@mui/material/styles';

// AWS銀行のテーマカラー
const theme = createTheme({
  palette: {
    primary: {
      main: '#1a237e', // ダークネイビー
      light: '#534bae',
      dark: '#000051',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#4caf50', // グリーン
      light: '#80e27e',
      dark: '#087f23',
      contrastText: '#000000',
    },
    error: {
      main: '#d32f2f',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1200,
      xl: 1536,
    },
  },
  typography: {
    fontFamily: ['"Hiragino Sans"', '"Hiragino Kaku Gothic ProN"', '"Noto Sans JP"', 'Meiryo', 'sans-serif'].join(','),
    h1: {
      fontSize: '2.2rem',
      fontWeight: 700,
      '@media (max-width:600px)': {
        fontSize: '1.8rem',
      },
    },
    h2: {
      fontSize: '1.8rem',
      fontWeight: 600,
      '@media (max-width:600px)': {
        fontSize: '1.5rem',
      },
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 600,
      '@media (max-width:600px)': {
        fontSize: '1.3rem',
      },
    },
    h4: {
      fontSize: '1.3rem',
      fontWeight: 600,
      '@media (max-width:600px)': {
        fontSize: '1.1rem',
      },
    },
    button: {
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          padding: '12px 24px',
          minHeight: '44px', // タッチフレンドリーなサイズ
          '@media (max-width:600px)': {
            padding: '14px 20px',
            minHeight: '48px', // モバイルでより大きく
            fontSize: '1rem',
          },
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.2)',
          },
        },
        small: {
          padding: '8px 16px',
          minHeight: '36px',
          '@media (max-width:600px)': {
            padding: '10px 16px',
            minHeight: '40px',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.05)',
          borderRadius: 12,
          '@media (max-width:600px)': {
            borderRadius: 8,
            margin: '0 8px',
          },
        },
      },
    },
    MuiContainer: {
      styleOverrides: {
        root: {
          '@media (max-width:600px)': {
            paddingLeft: '16px',
            paddingRight: '16px',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiInputBase-root': {
            minHeight: '44px',
            '@media (max-width:600px)': {
              minHeight: '48px',
            },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          '@media (max-width:600px)': {
            fontSize: '0.75rem',
            height: '28px',
          },
        },
      },
    },
  },
});

export default theme;
