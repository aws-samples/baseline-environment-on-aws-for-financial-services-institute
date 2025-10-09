// src/components/dashboard/TransactionChart.js
import React from 'react';
import { Card, CardContent, Typography, CircularProgress } from '@mui/material';
import { useSelector } from 'react-redux';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const TransactionChart = () => {
  const { transactionData, transactionHistoryStatus } = useSelector((state) => state.banking);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = new Intl.NumberFormat('ja-JP', {
              style: 'currency',
              currency: 'JPY',
              maximumFractionDigits: 0,
            }).format(context.parsed.y);
            return `残高: ${value}`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => {
            return new Intl.NumberFormat('ja-JP', {
              style: 'currency',
              currency: 'JPY',
              notation: 'compact',
              compactDisplay: 'short',
              maximumFractionDigits: 0,
            }).format(value);
          },
        },
      },
    },
  };

  const data = {
    labels: transactionData?.map((item) => item.date) || [],
    datasets: [
      {
        label: '残高推移',
        data: transactionData?.map((item) => item.balance) || [],
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1,
      },
    ],
  };

  if (transactionHistoryStatus === 'loading') {
    return (
      <Card elevation={2}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            残高推移（過去2年）
          </Typography>
          <div style={{ height: '400px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <CircularProgress />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card elevation={2}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          残高推移（過去2年）
        </Typography>
        <div style={{ height: '400px' }}>
          <Line options={options} data={data} />
        </div>
      </CardContent>
    </Card>
  );
};

export default TransactionChart;
