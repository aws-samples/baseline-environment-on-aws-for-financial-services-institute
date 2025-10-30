import { createSlice } from '@reduxjs/toolkit';

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    currentTab: 0, // 0: ダッシュボード, 1: 振込・送金 (顧客モード) / 0: 口座開設審査, 1: 振込処理イベント (管理者モード)
    userMode: 'customer', // 'customer' | 'admin'
  },
  reducers: {
    setCurrentTab: (state, action) => {
      state.currentTab = action.payload;
    },
    setUserMode: (state, action) => {
      const previousMode = state.userMode;
      state.userMode = action.payload;
      // モード切り替え時はタブをリセット（同じモードの場合はリセットしない）
      if (previousMode !== action.payload) {
        state.currentTab = 0;
      }
    },
  },
});

export const { setCurrentTab, setUserMode } = uiSlice.actions;
export default uiSlice.reducer;
