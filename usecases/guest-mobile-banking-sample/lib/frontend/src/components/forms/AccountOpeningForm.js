import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Grid,
  MenuItem,
  TextField,
  Typography,
  FormControlLabel,
  Checkbox,
  Alert,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import { setApplicationData } from '../../features/accountOpening/accountOpeningSlice';

// バリデーションスキーマ
const validationSchema = Yup.object({
  fullName: Yup.string().required('氏名は必須です'),
  kana: Yup.string().required('フリガナは必須です'),
  birthdate: Yup.date().required('生年月日は必須です').max(new Date(), '未来の日付は指定できません'),
  email: Yup.string().email('有効なメールアドレスを入力してください').required('メールアドレスは必須です'),
  phone: Yup.string()
    .required('電話番号は必須です')
    .matches(/^[0-9-]+$/, '数字とハイフンのみ入力可能です'),
  postalCode: Yup.string()
    .required('郵便番号は必須です')
    .matches(/^\d{3}-?\d{4}$/, '正しい郵便番号形式で入力してください'),
  address: Yup.string().required('住所は必須です'),
  idType: Yup.string().required('本人確認書類の種類を選択してください'),
  idNumber: Yup.string().required('本人確認書類番号は必須です'),
  agreeTerms: Yup.boolean().oneOf([true], '利用規約に同意する必要があります'),
});

const AccountOpeningForm = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { status, error } = useSelector((state) => state.accountOpening);
  const isLoading = status === 'loading';

  const handleSubmit = async (values) => {
    // Redux Storeに申込データを保存
    dispatch(setApplicationData(values));

    // 確認画面に遷移（API呼び出しはしない）
    navigate('/confirmation');
  };

  // ログイン画面へのリンク
  const handleLoginClick = () => {
    navigate('/login'); // ログイン画面に遷移
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Card elevation={3}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom align="center" color="primary">
              口座開設申込
            </Typography>
            <Typography variant="body1" align="center" color="text.secondary" sx={{ mb: 1 }}>
              必要事項をご入力いただき、お申し込みください。
            </Typography>
            <Typography variant="body2" align="center" sx={{ mb: 3 }}>
              既に口座をお持ちの方は
              <Button color="primary" onClick={handleLoginClick} sx={{ mx: 1 }}>
                こちら
              </Button>
              からログインしてください。
            </Typography>

            <Stepper activeStep={0} sx={{ mb: 4 }}>
              <Step>
                <StepLabel>情報入力</StepLabel>
              </Step>
              <Step>
                <StepLabel>内容確認</StepLabel>
              </Step>
              <Step>
                <StepLabel>申込完了</StepLabel>
              </Step>
            </Stepper>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Formik
            initialValues={{
              fullName: '',
              kana: '',
              birthdate: '',
              email: '',
              phone: '',
              postalCode: '',
              address: '',
              idType: '',
              idNumber: '',
              agreeTerms: false,
            }}
            validationSchema={validationSchema}
            onSubmit={handleSubmit}
          >
            {({ errors, touched, values, handleChange, handleBlur, isValid, dirty }) => (
              <Form>
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <Typography variant="h6" color="primary" gutterBottom>
                      お客様情報
                    </Typography>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      id="fullName"
                      name="fullName"
                      label="氏名"
                      value={values.fullName}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.fullName && Boolean(errors.fullName)}
                      helperText={touched.fullName && errors.fullName}
                      placeholder="山田 太郎"
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      id="kana"
                      name="kana"
                      label="フリガナ"
                      value={values.kana}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.kana && Boolean(errors.kana)}
                      helperText={touched.kana && errors.kana}
                      placeholder="ヤマダ タロウ"
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      id="birthdate"
                      name="birthdate"
                      label="生年月日"
                      type="date"
                      value={values.birthdate}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.birthdate && Boolean(errors.birthdate)}
                      helperText={touched.birthdate && errors.birthdate}
                      InputLabelProps={{
                        shrink: true,
                      }}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      id="email"
                      name="email"
                      label="メールアドレス"
                      value={values.email}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.email && Boolean(errors.email)}
                      helperText={touched.email && errors.email}
                      placeholder="example@email.com"
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      id="phone"
                      name="phone"
                      label="電話番号"
                      value={values.phone}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.phone && Boolean(errors.phone)}
                      helperText={touched.phone && errors.phone}
                      placeholder="090-1234-5678"
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Typography variant="h6" color="primary" gutterBottom sx={{ mt: 2 }}>
                      住所情報
                    </Typography>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      id="postalCode"
                      name="postalCode"
                      label="郵便番号"
                      value={values.postalCode}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.postalCode && Boolean(errors.postalCode)}
                      helperText={touched.postalCode && errors.postalCode}
                      placeholder="123-4567"
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      id="address"
                      name="address"
                      label="住所"
                      value={values.address}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.address && Boolean(errors.address)}
                      helperText={touched.address && errors.address}
                      placeholder="東京都千代田区..."
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Typography variant="h6" color="primary" gutterBottom sx={{ mt: 2 }}>
                      本人確認情報
                    </Typography>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      select
                      id="idType"
                      name="idType"
                      label="本人確認書類"
                      value={values.idType}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.idType && Boolean(errors.idType)}
                      helperText={touched.idType && errors.idType}
                      placeholder="選択してください"
                      sx={{ minWidth: '200px' }}
                    >
                      <MenuItem value="" disabled>
                        <em>選択してください</em>
                      </MenuItem>
                      <MenuItem value="drivingLicense">運転免許証</MenuItem>
                      <MenuItem value="passport">パスポート</MenuItem>
                      <MenuItem value="residentCard">マイナンバーカード</MenuItem>
                    </TextField>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      id="idNumber"
                      name="idNumber"
                      label="本人確認書類番号"
                      value={values.idNumber}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.idNumber && Boolean(errors.idNumber)}
                      helperText={touched.idNumber && errors.idNumber}
                    />
                  </Grid>

                  <Grid item xs={12} sx={{ mt: 2 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          id="agreeTerms"
                          name="agreeTerms"
                          checked={values.agreeTerms}
                          onChange={handleChange}
                          color="primary"
                        />
                      }
                      label="利用規約に同意します"
                    />
                    {touched.agreeTerms && errors.agreeTerms && (
                      <Typography color="error" variant="caption" display="block">
                        {errors.agreeTerms}
                      </Typography>
                    )}
                  </Grid>

                  <Grid item xs={12} sx={{ mt: 3, textAlign: 'center' }}>
                    <Button
                      type="submit"
                      variant="contained"
                      color="primary"
                      size="large"
                      disabled={isLoading || !isValid || !dirty}
                      sx={{ minWidth: 200 }}
                    >
                      {isLoading ? <CircularProgress size={24} color="inherit" /> : '入力内容を確認する'}
                    </Button>
                  </Grid>
                </Grid>
              </Form>
            )}
          </Formik>
        </CardContent>
      </Card>
    </Container>
  );
};

export default AccountOpeningForm;
