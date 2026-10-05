import axios from 'axios';

const productionApiUrl = 'https://loan-management-backend-1.onrender.com';
const isCapacitorApp = typeof window !== 'undefined' && (
  Boolean(window.Capacitor?.isNativePlatform?.()) ||
  window.location.protocol === 'capacitor:' ||
  (window.location.protocol === 'https:' && window.location.hostname === 'localhost')
);

const configuredApiUrl = String(import.meta.env.VITE_API_URL || '').trim();
const rawApiUrl = configuredApiUrl || (isCapacitorApp ? productionApiUrl : 'http://127.0.0.1:5000');
const API_URL = rawApiUrl.replace(/\/$/, '');

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('loan_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const isNetworkError = error => !error?.response && (
  error?.code === 'ERR_NETWORK' ||
  error?.code === 'ECONNABORTED' ||
  error?.message?.toLowerCase().includes('network') ||
  error?.message?.toLowerCase().includes('timeout')
);

export default api;
