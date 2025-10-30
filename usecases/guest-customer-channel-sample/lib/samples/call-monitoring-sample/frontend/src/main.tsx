import ReactDOM from 'react-dom/client';
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from 'react-router-dom';
import App from './App.tsx';
import MainPage from '@/pages/MainPage.tsx';
import SettingsPage from './pages/SettingsPage.tsx';
import './index.css';

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/" element={<App />}>
      <Route path="/" element={<MainPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Route>,
  ),
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  // <React.StrictMode>
  <RouterProvider router={router} />,
  // </React.StrictMode>
);
