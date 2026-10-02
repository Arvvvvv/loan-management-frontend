import axios from 'axios';

// Use the same loopback address as Vite to avoid localhost/127.0.0.1 CORS mismatches.
const api = axios.create({ baseURL: 'http://127.0.0.1:5000/api' });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('loan_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
