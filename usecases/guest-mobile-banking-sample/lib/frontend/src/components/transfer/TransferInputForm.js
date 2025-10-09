import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { Box, TextField, Button, Grid, Paper, Typography, Autocomplete, Alert } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';

const TransferInputForm = ({ onConfirm, initialValues }) => {
  // ログインユーザー情報を取得
  const { user } = useSelector((state) => state.auth);

  const [formData, setFormData] = useState({
    bankName: '',
    branchName: '',
    branchCode: '',
    accountNumber: '',
    amount: '',
    message: '',
  });

  const [validationErrors, setValidationErrors] = useState({});
  const [isSelfTransfer, setIsSelfTransfer] = useState(false);

  // 銀行名の候補
  const bankOptions = [{ label: 'サンプル銀行', value: 'サンプル銀行' }];

  // 支店名の候補
  const getBranchOptions = (selectedBank) => {
    if (selectedBank === 'サンプル銀行') {
      return [{ label: 'リファレンスアーキ支店 (001)', value: 'リファレンスアーキ支店', code: '001' }];
    }
    return [];
  };

  // 自分の口座かどうかをチェックする関数
  const checkSelfTransfer = useCallback(
    (branchCode, accountNumber) => {
      if (!user?.primaryAccountId || !branchCode || !accountNumber) {
        return false;
      }

      // ユーザーのprimaryAccountIdから支店番号と口座番号を抽出
      // 例: "ACC001" -> 支店番号: "001", 口座番号: "001"
      // または "001123" -> 支店番号: "001", 口座番号: "123"
      const userAccountId = user.primaryAccountId;
      let userBranchCode, userAccountNumber;

      if (userAccountId.startsWith('ACC')) {
        // "ACC001" 形式の場合
        userBranchCode = '001'; // デフォルト支店
        userAccountNumber = userAccountId.substring(3);
      } else if (userAccountId.length >= 6) {
        // "001123" 形式の場合
        userBranchCode = userAccountId.substring(0, 3);
        userAccountNumber = userAccountId.substring(3);
      } else {
        return false;
      }

      const targetBranchCode = branchCode || '001';
      const targetAccountNumber = accountNumber.padStart(3, '0');

      return userBranchCode === targetBranchCode && userAccountNumber === targetAccountNumber;
    },
    [user?.primaryAccountId],
  );

  // 初期値があれば設定
  useEffect(() => {
    if (initialValues) {
      setFormData({
        ...initialValues,
        amount: typeof initialValues.amount === 'number' ? initialValues.amount.toString() : initialValues.amount,
      });
    }
  }, [initialValues]);

  // 自分の口座への振込チェック
  useEffect(() => {
    const selfTransfer = checkSelfTransfer(formData.branchCode, formData.accountNumber);
    setIsSelfTransfer(selfTransfer);
  }, [formData.branchCode, formData.accountNumber, user?.primaryAccountId, checkSelfTransfer]);

  const validateForm = () => {
    const errors = {};
    if (!formData.bankName) errors.bankName = '銀行名を入力してください';
    if (!formData.branchName) errors.branchName = '支店名を入力してください';
    if (!formData.accountNumber) {
      errors.accountNumber = '口座番号を入力してください';
    } else if (!/^\d{7}$/.test(formData.accountNumber)) {
      errors.accountNumber = '口座番号は7桁の数字で入力してください';
    } else if (isSelfTransfer) {
      errors.accountNumber = 'ご自身の口座への振込はできません';
    }
    if (!formData.amount) {
      errors.amount = '金額を入力してください';
    } else if (isNaN(formData.amount) || parseInt(formData.amount) <= 0) {
      errors.amount = '有効な金額を入力してください';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // 入力時にエラーをクリア
    if (validationErrors[name]) {
      setValidationErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  // 銀行名変更時の処理
  const handleBankChange = (event, newValue) => {
    setFormData((prev) => ({
      ...prev,
      bankName: newValue?.value || '',
      branchName: '', // 銀行変更時は支店をリセット
      branchCode: '',
    }));
    // エラーをクリア
    if (validationErrors.bankName) {
      setValidationErrors((prev) => ({
        ...prev,
        bankName: '',
      }));
    }
  };

  // 支店名変更時の処理
  const handleBranchChange = (event, newValue) => {
    setFormData((prev) => ({
      ...prev,
      branchName: newValue?.value || '',
      branchCode: newValue?.code || '',
    }));
    // エラーをクリア
    if (validationErrors.branchName) {
      setValidationErrors((prev) => ({
        ...prev,
        branchName: '',
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      onConfirm(formData);
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        振込情報の入力
      </Typography>
      <Box component="form" onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Autocomplete
              options={bankOptions}
              getOptionLabel={(option) => option.label}
              value={bankOptions.find((option) => option.value === formData.bankName) || null}
              onChange={handleBankChange}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="振込先銀行名"
                  placeholder="銀行名を選択してください"
                  error={!!validationErrors.bankName}
                  helperText={validationErrors.bankName}
                  required
                  sx={{ minWidth: '200px' }}
                />
              )}
              freeSolo
              selectOnFocus
              clearOnBlur
              handleHomeEndKeys
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <Autocomplete
              options={getBranchOptions(formData.bankName)}
              getOptionLabel={(option) => option.label}
              value={getBranchOptions(formData.bankName).find((option) => option.value === formData.branchName) || null}
              onChange={handleBranchChange}
              disabled={!formData.bankName}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="支店名"
                  placeholder="支店名を選択してください"
                  error={!!validationErrors.branchName}
                  helperText={validationErrors.branchName || (!formData.bankName ? '先に銀行名を選択してください' : '')}
                  required
                  sx={{ minWidth: '200px' }}
                />
              )}
              freeSolo
              selectOnFocus
              clearOnBlur
              handleHomeEndKeys
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="口座番号（7桁）"
              name="accountNumber"
              value={formData.accountNumber}
              onChange={handleChange}
              error={!!validationErrors.accountNumber}
              helperText={validationErrors.accountNumber || '7桁の数字を入力してください'}
              inputProps={{
                maxLength: 7,
                pattern: '[0-9]*',
              }}
              placeholder="1234567"
              required
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="振込金額"
              name="amount"
              type="number"
              value={formData.amount}
              onChange={handleChange}
              error={!!validationErrors.amount}
              helperText={validationErrors.amount}
              InputProps={{
                startAdornment: '¥',
              }}
              required
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="振込メッセージ（任意）"
              name="message"
              value={formData.message}
              onChange={handleChange}
              multiline
              rows={2}
            />
          </Grid>

          {isSelfTransfer && (
            <Grid item xs={12}>
              <Alert severity="warning">ご自身の口座への振込はできません。振込先の口座番号をご確認ください。</Alert>
            </Grid>
          )}

          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                size="large"
                startIcon={<SendIcon />}
                sx={{ minWidth: 200 }}
                disabled={isSelfTransfer}
              >
                確認画面へ
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Paper>
  );
};

TransferInputForm.propTypes = {
  onConfirm: PropTypes.func.isRequired,
  initialValues: PropTypes.shape({
    bankName: PropTypes.string,
    branchName: PropTypes.string,
    branchCode: PropTypes.string,
    accountNumber: PropTypes.string,
    amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    message: PropTypes.string,
  }),
};

export default TransferInputForm;
