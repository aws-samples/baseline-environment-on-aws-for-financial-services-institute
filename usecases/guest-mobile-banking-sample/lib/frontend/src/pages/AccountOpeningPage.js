import React from 'react';
import { Box } from '@mui/material';
import AccountOpeningForm from '../components/forms/AccountOpeningForm';

const AccountOpeningPage = () => {
  return (
    <Box
      sx={{
        flexGrow: 1,
        py: { xs: 1, sm: 2 },
        px: { xs: 1, sm: 2 },
      }}
    >
      <AccountOpeningForm />
    </Box>
  );
};

export default AccountOpeningPage;
