import React, { useEffect, useMemo, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import api, { isNetworkError } from './api';
import { Capacitor } from '@capacitor/core';
import { jsPDF } from 'jspdf';
import './styles.css';

const peso = n => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateText = d => new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
const localDateInput = (d = new Date()) => { const x = new Date(d); const offset = x.getTimezoneOffset(); return new Date(x.getTime() - offset * 60000).toISOString().slice(0, 10); };

const AVATAR_PRESETS = [
  { id: 'initial', label: 'My Initial', value: 'preset:initial', glyph: 'A' },
  { id: 'girl', label: 'Girl', value: 'preset:girl', glyph: '👩' },
  { id: 'boy', label: 'Boy', value: 'preset:boy', glyph: '👨' },
  { id: 'woman', label: 'Woman', value: 'preset:woman', glyph: '👩‍💼' },
  { id: 'man', label: 'Man', value: 'preset:man', glyph: '👨‍💼' },
  { id: 'student-girl', label: 'Student Girl', value: 'preset:student-girl', glyph: '👧' },
  { id: 'student-boy', label: 'Student Boy', value: 'preset:student-boy', glyph: '👦' },
  { id: 'business', label: 'Business', value: 'preset:business', glyph: '💼' },
  { id: 'money', label: 'Money', value: 'preset:money', glyph: '💰' }
];

function AvatarView({ value, username = 'User', className = '' }) {
  if (value && value.startsWith?.('data:image/')) return <img className={className} src={value} alt={`${username} avatar`} />;
  const preset = AVATAR_PRESETS.find(a => a.value === value);
  if (preset) return <span className={`${className} avatar-preset avatar-preset-${preset.id}`} aria-label={preset.label}>{preset.id === 'initial' ? (username || 'U').charAt(0).toUpperCase() : preset.glyph}</span>;
  return <span className={`${className} profile-mini-fallback`}>{(username || 'U').charAt(0).toUpperCase()}</span>;
}

async function compressAvatarDataUrl(dataUrl, maxSize = 640, maxChars = 700000) {
  if (!dataUrl?.startsWith?.('data:image/')) return dataUrl || '';
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round((img.naturalWidth || maxSize) * scale));
      canvas.height = Math.max(1, Math.round((img.naturalHeight || maxSize) * scale));
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      let quality = 0.72;
      let result = canvas.toDataURL('image/jpeg', quality);
      while (result.length > maxChars && quality > 0.42) {
        quality -= 0.05;
        result = canvas.toDataURL('image/jpeg', quality);
      }
      resolve(result);
    };
    img.onerror = () => reject(new Error('Could not prepare the profile image.'));
    img.src = dataUrl;
  });
}

function PocketDepositAnimation({ name, onDone }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 2200);
    return () => clearTimeout(timer);
  }, [onDone]);
  return <div className="pocket-deposit-overlay" aria-live="polite">
    <div className="pocket-deposit-card">
      <div className="pocket-deposit-kicker">Loan saved successfully</div>
      <div className="pocket-deposit-scene">
        <div className="pocket-customer-name">{name}</div>
        <div className="pocket-name-shadow" />
        <img src="/pocket-money-icon-source.png" alt="Money pocket" className="pocket-money-image" />
      </div>
      <strong>{name}</strong> <span>has been placed in your money pocket.</span>
    </div>
  </div>;
}

function AvatarCropper({ source, onCancel, onApply }) {
  const STAGE = 280;
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(null);

  const baseScale = imageSize.width && imageSize.height
    ? Math.max(STAGE / imageSize.width, STAGE / imageSize.height)
    : 1;
  const displayScale = baseScale * zoom;

  const clampPosition = (x, y) => {
    if (!imageSize.width || !imageSize.height) return { x, y };
    const renderedWidth = imageSize.width * displayScale;
    const renderedHeight = imageSize.height * displayScale;
    const maxX = Math.max(0, (renderedWidth - STAGE) / 2);
    const maxY = Math.max(0, (renderedHeight - STAGE) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y))
    };
  };

  useEffect(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, [source]);

  useEffect(() => {
    setPosition(p => clampPosition(p.x, p.y));
  }, [zoom, imageSize.width, imageSize.height]);

  const startDrag = e => {
    e.preventDefault();
    setDragging(true);
    dragRef.current = { clientX: e.clientX, clientY: e.clientY, ...position };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const moveDrag = e => {
    if (!dragging || !dragRef.current) return;
    const next = clampPosition(
      dragRef.current.x + e.clientX - dragRef.current.clientX,
      dragRef.current.y + e.clientY - dragRef.current.clientY
    );
    setPosition(next);
  };

  const endDrag = () => {
    setDragging(false);
    dragRef.current = null;
  };

  const applyCrop = () => {
    if (!imageSize.width || !imageSize.height) return;
    const canvas = document.createElement('canvas');
    const output = 640;
    canvas.width = output;
    canvas.height = output;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, output, output);

    const sourceCropSize = Math.min(imageSize.width, imageSize.height, STAGE / displayScale);
    const sourceCenterX = imageSize.width / 2 - position.x / displayScale;
    const sourceCenterY = imageSize.height / 2 - position.y / displayScale;
    const sx = Math.max(0, Math.min(imageSize.width - sourceCropSize, sourceCenterX - sourceCropSize / 2));
    const sy = Math.max(0, Math.min(imageSize.height - sourceCropSize, sourceCenterY - sourceCropSize / 2));

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, sx, sy, sourceCropSize, sourceCropSize, 0, 0, output, output);
      let quality = 0.82;
      let result = canvas.toDataURL('image/jpeg', quality);
      while (result.length > 650000 && quality > 0.42) {
        quality -= 0.07;
        result = canvas.toDataURL('image/jpeg', quality);
      }
      onApply(result);
    };
    img.src = source;
  };

  return <div className="avatar-crop-overlay" role="dialog" aria-modal="true" aria-label="Adjust profile picture">
    <div className="avatar-crop-modal">
      <div className="avatar-crop-header">
        <div><span className="modal-kicker">Profile picture</span><h3>Adjust your photo</h3><p className="muted small">Drag the photo to position it. Use the slider to zoom.</p></div>
        <button type="button" className="avatar-crop-close" onClick={onCancel} aria-label="Close">×</button>
      </div>
      <div
        className={`avatar-crop-stage ${dragging ? 'dragging' : ''}`}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
      >
        <img
          src={source}
          alt="Crop preview"
          draggable="false"
          onLoad={e => setImageSize({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
          style={{ left: `calc(50% + ${position.x}px)`, top: `calc(50% + ${position.y}px)`, transform: `translate(-50%, -50%) scale(${displayScale})` }}
        />
        <div className="avatar-crop-circle" />
      </div>
      <label className="avatar-zoom-label">Zoom <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={e => setZoom(Number(e.target.value))} /></label>
      <div className="avatar-crop-hint">Tip: drag up, down, left, or right until your face fits inside the circle.</div>
      <div className="avatar-crop-actions">
        <button type="button" className="remove-avatar" onClick={onCancel}>Cancel</button>
        <button type="button" className="primary" onClick={applyCrop} disabled={!imageSize.width}>Use This Position</button>
      </div>
    </div>
  </div>;
}


function downloadLoanReceipt(loan) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const left = 20;
  const right = 190;
  let y = 22;
  const line = () => { doc.setDrawColor(210, 220, 214); doc.line(left, y, right, y); y += 7; };
  const money = n => `PHP ${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const borrower = loan.customer?.name || 'Borrower';
  const collected = loan.payments?.reduce((sum, p) => sum + Number(p.paidAmount || 0), 0) || 0;
  const remaining = Math.max(0, Number(loan.totalPayable || 0) - collected);
  const receiptNo = `LOAN-${String(loan._id || '').slice(-8).toUpperCase()}`;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('BUSINESS LOAN', left, y);
  y += 8;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Loan Receipt', left, y);
  doc.text(`Receipt No: ${receiptNo}`, right, y, { align: 'right' });
  y += 6;
  doc.text(`Issued: ${dateText(loan.createdAt)}`, right, y, { align: 'right' });
  y += 6;
  doc.text(`Loan Start Date: ${dateText(loan.startDate || loan.createdAt)}`, right, y, { align: 'right' });
  y += 8;
  line();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('CUSTOMER INFORMATION', left, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`Customer: ${borrower}`, left, y);
  y += 8;
  line();

  doc.setFont('helvetica', 'bold');
  doc.text('LOAN DETAILS', left, y);
  y += 8;
  doc.setFont('helvetica', 'normal');
  const rows = [
    ['Loan Amount', money(loan.principal)],
    ['Interest', money(loan.interestAmount)],
    ['Total Payable', money(loan.totalPayable)],
    ['Payment Term', `${loan.termCount} month${Number(loan.termCount) === 1 ? '' : 's'}`],
    ['Payment Frequency', 'Every 15 Days'],
    ['Total Paid', money(collected)],
    ['Remaining Balance', money(remaining)],
    ['Loan Status', loan.status || 'Active']
  ];
  rows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, left, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value, 105, y);
    y += 7;
  });
  y += 2;
  line();

  doc.setFont('helvetica', 'bold');
  doc.text('PAYMENT SCHEDULE', left, y);
  y += 8;
  doc.setFontSize(10);
  doc.text('Payment', left, y);
  doc.text('Due Date', 55, y);
  doc.text('Amount', 100, y);
  doc.text('Paid', 135, y);
  doc.text('Status', 165, y);
  y += 5;
  doc.setDrawColor(220, 225, 222);
  doc.line(left, y, right, y);
  y += 6;

  (loan.payments || []).forEach((p) => {
    if (y > 265) { doc.addPage(); y = 22; }
    doc.setFont('helvetica', 'normal');
    doc.text(`#${p.installment}`, left, y);
    doc.text(dateText(p.dueDate), 55, y);
    doc.text(money(p.amount), 100, y);
    doc.text(money(p.paidAmount), 135, y);
    doc.text(p.status || 'Pending', 165, y);
    y += 7;
  });

  if (y > 250) { doc.addPage(); y = 22; }
  y += 12;
  line();
  doc.setFontSize(10);
  doc.text('Borrower Signature', left, y);
  doc.text('Lender / Authorized Signature', 125, y);
  y += 14;
  doc.line(left, y, 85, y);
  doc.line(125, y, right, y);
  y += 9;
  doc.setFontSize(9);
  doc.setTextColor(100, 110, 105);
  doc.text('This receipt records the loan terms and payment schedule entered in the Business Loan system.', left, y);

  const safeBorrower = borrower.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'borrower';
  const fileName = `${receiptNo}-${safeBorrower}.pdf`;
  // Use a Blob + temporary download link so the receipt is downloaded directly
  // instead of being handed to the system PDF viewer (which can fail when an
  // older copy of the same receipt is still open in Acrobat).
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function MoneyRain({ variant = 'app' }) {
  const symbols = ['₱', '💵', '$', '💸', '₱', '💰', '₱', '$', '💵', '₱', '💸', '₱', '💰', '₱', '$', '💵', '₱', '💸'];
  return <div className={`money-rain ${variant}`} aria-hidden="true">
    {symbols.map((symbol, i) => {
      const left = 2 + ((i * 5.6) % 96);
      const size = 16 + ((i % 4) * 4);
      const duration = 9 + ((i % 5) * 1.4);
      const delay = -(i * 1.15);
      const rotation = (i * 17) - 25;
      return <span key={`${variant}-${i}`} style={{ left: `${left}%`, fontSize: `${size}px`, animationDuration: `${duration}s`, animationDelay: `${delay}s`, transform: `rotate(${rotation}deg)` }}>{symbol}</span>;
    })}
  </div>;
}

function PaymentFormModal({ loan, payment, amount, date, onAmountChange, onDateChange, onCancel, onSubmit, busy }) {
  if (!loan || !payment) return null;
  const remaining = Math.max(0, Number(payment.amount || 0) - Number(payment.paidAmount || 0));
  return <div className="payment-form-overlay" role="dialog" aria-modal="true" aria-label="Record payment">
    <form className="payment-form-card" onSubmit={onSubmit}>
      <div className="modal-header">
        <div><span className="modal-kicker">Payment entry</span><h3>Record Payment #{payment.installment}</h3><p className="muted small">{loan.customer?.name || 'Borrower'} · Remaining {peso(remaining)}</p></div>
        <button type="button" className="modal-close" onClick={onCancel} aria-label="Close">×</button>
      </div>
      <div className="payment-form-grid">
        <label>Payment Amount (₱)<input type="number" min="0.01" max={remaining} step="0.01" value={amount} onChange={e => onAmountChange(e.target.value)} placeholder={remaining.toFixed(2)} required autoFocus /></label>
        <label>Date Paid<input type="date" value={date} onChange={e => onDateChange(e.target.value)} required /></label>
      </div>
      <p className="muted small payment-form-note">You can change the payment date before saving. Use the actual date the borrower paid, even if you are recording it later.</p>
      <div className="actions"><button type="button" onClick={onCancel} disabled={busy}>Cancel</button><button className="primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save Payment'}</button></div>
    </form>
  </div>;
}

function Auth({ onLogin }) {
  const [register, setRegister] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);

  const submit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const r = await api.post(`/auth/${register ? 'register' : 'login'}`, form);
      localStorage.setItem('loan_token', r.data.token);
      localStorage.setItem('loan_user', JSON.stringify(r.data.user));
      if (!register) {
        setLoginSuccess(true);
        window.setTimeout(() => onLogin(r.data.user), 1250);
      } else {
        onLogin(r.data.user);
      }
    } catch (e) {
      if (e.response?.data?.message) setError(e.response.data.message);
      else if (isNetworkError(e)) setError('The server is taking too long to respond. Please check your internet connection or try again in a moment.');
      else setError('Unable to connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  return <div className={`auth-page ${loginSuccess ? 'login-success-active' : ''}`}>
    <MoneyRain variant="auth" />
    {loginSuccess && <div className="login-transition" aria-live="polite">
      <div className="login-wallet-scene">
        <div className="login-money-bill">₱</div><div className="login-wallet">💼</div>
        <span className="login-coin coin-1">₱</span><span className="login-coin coin-2">₱</span><span className="login-coin coin-3">₱</span>
      </div>
      <strong>Welcome back!</strong><small>Opening your Business Loan account…</small>
    </div>}
    <div className="auth-card">
      <div className="auth-intro">
        <div className="logo"><img src="/loan-icon.png" alt="Business Loan" /></div>
        <span className="auth-kicker">SMART LOAN MANAGEMENT</span>
        <h1>Business Loan</h1>
        <p className="muted">{register ? 'Create your account to manage borrowers, loans, and payments.' : 'A simple way to track borrowers, payment schedules, and balances.'}</p>
        <div className="how-it-works">
          <div><b>01</b><span><strong>Register / Login</strong><small>Secure access to your account</small></span></div>
          <div><b>02</b><span><strong>Create a Loan</strong><small>Set amount, interest, and terms</small></span></div>
          <div><b>03</b><span><strong>Track Payments</strong><small>See the next due payment and balance</small></span></div>
        </div>
      </div>
      <div className="auth-form-wrap">
        <div className="auth-form-title">{register ? 'Create your account' : 'Welcome back'}</div>
        <p className="auth-form-subtitle">{register ? 'Start managing your business loans today.' : 'Enter your credentials to continue.'}</p>
        <form onSubmit={submit}>
      <label>Username<input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="Enter username" required /></label>
      <label>Password<div className="password-field"><input type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Enter password" required /><button type="button" className="password-toggle" onClick={() => setShowPassword(v => !v)}>{showPassword ? 'Hide' : 'Show'}</button></div></label>
      {register && <label>Confirm Password<div className="password-field"><input type={showConfirmPassword ? 'text' : 'password'} value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} placeholder="Confirm password" required /><button type="button" className="password-toggle" onClick={() => setShowConfirmPassword(v => !v)}>{showConfirmPassword ? 'Hide' : 'Show'}</button></div></label>}
      {error && <div className="error">{error}</div>}
      <button className="primary full" disabled={loading}>{loading ? 'Please wait...' : register ? 'Create Account' : 'Login'}</button>
        </form>
        <div className="switch">{register ? <>Already have an account? <button onClick={() => { setRegister(false); setError(''); }}>Login</button></> : <>Don't have an account yet? <button onClick={() => { setRegister(true); setError(''); }}>Create an Account</button></>}</div>
      </div>
    </div>
  </div>;
}

function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('loan_user');
    try { return localStorage.getItem('loan_token') ? (saved ? JSON.parse(saved) : { username: 'User' }) : null; } catch { return { username: 'User' }; }
  });
  const [page, setPage] = useState('dashboard');
  const [profileLoading, setProfileLoading] = useState(false);
  const [loans, setLoans] = useState([]);
  const [stats, setStats] = useState({});
  const [message, setMessage] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const logout = () => { localStorage.removeItem('loan_token'); localStorage.removeItem('loan_user'); setUser(null); };

  const load = async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const [l, s] = await Promise.all([api.get('/loans'), api.get('/loans/dashboard')]);
      setLoans(l.data);
      setStats(s.data);
      setLastUpdated(new Date());
      if (!silent) setMessage('Data refreshed.');
      return l.data;
    } catch (e) {
      if (e.response?.status === 401) logout();
      else setMessage(e.response?.data?.message || (isNetworkError(e) ? 'Server connection lost. Please try again.' : 'Could not load data.'));
    } finally {
      if (!silent) setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    load(true);
    const timer = window.setInterval(() => load(true), 30000);
    return () => window.clearInterval(timer);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setProfileLoading(true);
    api.get('/auth/profile').then(r => {
      if (!active) return;
      const nextUser = r.data.user;
      localStorage.setItem('loan_user', JSON.stringify(nextUser));
      setUser(nextUser);
    }).catch(() => {}).finally(() => { if (active) setProfileLoading(false); });
    return () => { active = false; };
  }, []);

  const updateUser = nextUser => {
    localStorage.setItem('loan_user', JSON.stringify(nextUser));
    setUser(nextUser);
  };

  if (!user) return <Auth onLogin={u => setUser(u)} />;

  const nativeApp = Capacitor.isNativePlatform();

  return <div className={`app page-${page} ${nativeApp ? 'native-app' : ''}`}>
    <aside>
      <div className="brand"><img src="/loan-icon.png" alt="Business Loan" /><span>Business Loan</span></div>
      <button className={page === 'dashboard' ? 'nav active' : 'nav'} onClick={() => setPage('dashboard')}>📊 Dashboard</button>
      <button className={page === 'loans' ? 'nav active' : 'nav'} onClick={() => setPage('loans')}>💳 Loans</button>
      <button className={page === 'profile' ? 'nav active' : 'nav'} onClick={() => setPage('profile')}>👤 Profile</button>
      <div className="sidebar-bottom">
        <button className="profile-mini" onClick={() => setPage('profile')} title="Open Profile">
          <AvatarView value={user.avatar} username={user.username} />
          <span>Signed in as <b>{user.username}</b></span>
        </button>
        <button className="logout" onClick={logout}>Log out</button>
      </div>
    </aside>
    <main>
      <MoneyRain variant="page" />
      <header><div><h2>{page === 'dashboard' ? 'Dashboard' : page === 'loans' ? 'Loans' : 'Profile'}</h2><p className="muted">{page === 'profile' ? 'Manage your account, avatar, and password.' : 'Manage your customers, loans, and payments.'}</p>{lastUpdated && page !== 'profile' && <p className="live-status">● Live data · Updated {lastUpdated.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}</p>}</div><div className="header-actions">{message && <div className="toast">{message}</div>}{page !== 'profile' && <button className="refresh-btn" onClick={() => load()} disabled={refreshing}>{refreshing ? 'Refreshing…' : '↻ Refresh'}</button>}</div></header>
      {page === 'dashboard' ? <Dashboard stats={stats} loans={loans} reload={load} /> : page === 'loans' ? <Loans loans={loans} reload={load} /> : <Profile user={user} onUserUpdate={updateUser} loading={profileLoading} />}
    </main>
  </div>;
}

function getPaymentScheduleOverrides() {
  try { return JSON.parse(localStorage.getItem('loan_payment_schedule_overrides') || '{}'); }
  catch { return {}; }
}

function setPaymentScheduleOverride(loanId, paymentId, values) {
  const all = getPaymentScheduleOverrides();
  all[`${loanId}:${paymentId}`] = { ...(all[`${loanId}:${paymentId}`] || {}), ...values };
  localStorage.setItem('loan_payment_schedule_overrides', JSON.stringify(all));
}

function getLoanStartDateOverrides() {
  try { return JSON.parse(localStorage.getItem('loan_start_date_overrides') || '{}'); }
  catch { return {}; }
}

function setLoanStartDateOverride(loanId, startDate) {
  const all = getLoanStartDateOverrides();
  all[loanId] = startDate;
  localStorage.setItem('loan_start_date_overrides', JSON.stringify(all));
}

function clearLoanStartDateOverride(loanId) {
  const all = getLoanStartDateOverrides();
  delete all[loanId];
  localStorage.setItem('loan_start_date_overrides', JSON.stringify(all));
}

function effectiveLoanStartDate(loan) {
  return getLoanStartDateOverrides()[loan._id] || loan.startDate || loan.createdAt;
}

function addCalendarDays(dateInput, days) {
  if (!dateInput) return dateInput;
  const [year, month, day] = String(dateInput).slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return dateInput;
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function paymentWithLocalOverride(loan, payment) {
  const override = getPaymentScheduleOverrides()[`${loan._id}:${payment._id}`] || {};
  let dueDate = override.dueDate || payment.dueDate;
  const localStartDate = getLoanStartDateOverrides()[loan._id];
  if (localStartDate && payment.status !== 'Paid' && !override.dueDate) {
    dueDate = addCalendarDays(localStartDate, Number(payment.installment || 0) * 15);
  }
  return { ...payment, ...override, dueDate };
}

function paymentDisplayDate(loan, payment) {
  const effective = paymentWithLocalOverride(loan, payment);
  return payment.paidAt || effective.dueDate;
}

function Dashboard({ stats, loans, reload }) {
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', principal: '', termCount: '', interestValue: '', startDate: '' });
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [pocketName, setPocketName] = useState('');
  const [editingStartDate, setEditingStartDate] = useState(null);
  const [startDateValue, setStartDateValue] = useState('');
  const [paymentTarget, setPaymentTarget] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(localDateInput());

  const openLoan = loan => {
    setEditingId(null);
    setSelectedLoan(loan);
  };

  const startEdit = loan => {
    setEditingId(loan._id);
    setSelectedLoan(loan);
    setEditForm({
      name: loan.customer?.name || '',
      principal: loan.principal,
      termCount: loan.termCount,
      interestValue: loan.interestValue,
      startDate: loan.startDate ? localDateInput(loan.startDate) : localDateInput(loan.createdAt)
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ name: '', principal: '', termCount: '', interestValue: '', startDate: '' });
  };

  const update = async e => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.put(`/loans/${editingId}`, {
        borrowerName: editForm.name,
        principal: Number(editForm.principal),
        interestValue: Number(editForm.interestValue),
        termCount: Number(editForm.termCount),
        startDate: editForm.startDate
      });
      const fresh = await reload();
      const updated = fresh?.find(l => l._id === editingId);
      if (updated) setSelectedLoan(updated);
      cancelEdit();
    } catch (e) {
      alert(e.response?.data?.message || 'Could not update loan.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async loan => {
    const customerName = loan.customer?.name || 'this customer';
    const confirmed = window.confirm(
      `Delete the loan for ${customerName}?\n\nThis permanently removes the loan, its payment schedule, and its recorded payments. If this is the customer's only loan, their customer record will also be removed.\n\nContinue?`
    );
    if (!confirmed) return;

    setBusy(true);
    setDeletingId(loan._id);
    try {
      // Let the customer card visibly leave the screen before removing it from the database.
      await new Promise(resolve => setTimeout(resolve, 650));
      await api.delete(`/loans/${loan._id}`);
      setSelectedLoan(null);
      await reload();
    } catch (e) {
      alert(e.response?.data?.message || 'Could not delete loan.');
    } finally {
      setDeletingId(null);
      setBusy(false);
    }
  };

  const recordPayment = (loan, payment) => {
    const remaining = Number((payment.amount - payment.paidAmount).toFixed(2));
    setPaymentTarget({ loan, payment });
    setPaymentAmount(remaining.toFixed(2));
    setPaymentDate(localDateInput());
  };

  const submitPayment = async e => {
    e.preventDefault();
    if (!paymentTarget) return;
    const { loan, payment } = paymentTarget;
    const remaining = Number((payment.amount - payment.paidAmount).toFixed(2));
    const received = Number(paymentAmount);
    if (!received || received <= 0 || received > remaining) {
      alert(`Please enter an amount from ₱0.01 to ₱${remaining.toFixed(2)}.`);
      return;
    }
    if (!paymentDate) { alert('Please select the date the payment was made.'); return; }
    setBusy(true);
    try {
      await api.post(`/loans/${loan._id}/payments/${payment._id}`, { amount: received, paidAt: paymentDate });
      const fresh = await reload();
      const updated = fresh?.find(l => l._id === loan._id);
      if (updated) setSelectedLoan(updated);
      setPaymentTarget(null);
    } catch (e) {
      alert(e.response?.data?.message || 'Could not record payment.');
    } finally { setBusy(false); }
  };

  const openStartDateEditor = loan => {
    setEditingStartDate(loan);
    setStartDateValue(localDateInput(effectiveLoanStartDate(loan)));
  };

  const saveStartDate = async e => {
    e.preventDefault();
    if (!editingStartDate || !startDateValue) return;
    setBusy(true);
    try {
      await api.put(`/loans/${editingStartDate._id}`, {
        borrowerName: editingStartDate.customer?.name || 'Borrower',
        principal: Number(editingStartDate.principal),
        interestValue: Number(editingStartDate.interestValue),
        termCount: Number(editingStartDate.termCount),
        startDate: startDateValue
      });
      clearLoanStartDateOverride(editingStartDate._id);
      const fresh = await reload();
      const updated = fresh?.find(l => l._id === editingStartDate._id);
      if (updated) setSelectedLoan(updated);
    } catch (e) {
      // Loans with recorded payments cannot change the server schedule. Keep the requested start date as a device-local schedule date instead.
      setLoanStartDateOverride(editingStartDate._id, startDateValue);
      const fresh = await reload();
      const updated = fresh?.find(l => l._id === editingStartDate._id);
      if (updated) setSelectedLoan(updated);
      alert('Start date updated for this device. The existing recorded payments were kept unchanged.');
    } finally {
      setEditingStartDate(null);
      setStartDateValue('');
      setBusy(false);
    }
  };


  return <section>
    <div className="cards">
      <Stat title="Customers" value={stats.customers || 0} />
      <Stat title="Active Loans" value={stats.activeLoans || 0} />
      <Stat title="Total Payable" value={peso(stats.totalPayable)} />
      <Stat title="Remaining Balance" value={peso(stats.remaining)} />
    </div>

    <a className="install-app-card install-app-card-link" href="/Business-Loan.apk" download="Business-Loan.apk" aria-label="Download and install the Business Loan Android app">
      <div className="install-app-info">
        <div className="install-app-icon"><img src="/loan-icon.png" alt="Business Loan" /></div>
        <div>
          <h3>Install Business Loan App</h3>
          <p className="muted small">Tap anywhere here to download the Android app for your phone or tablet.</p>
        </div>
      </div>
      <span className="install-app-button">📲 Download &amp; Install</span>
    </a>

    <div className="panel">
      <div className="panel-title">
        <div>
          <h3>Recent Loans</h3>
          <p className="muted small">Click a customer to open their loan, view the next payment, and record a payment.</p>
        </div>
      </div>

      {loans.length === 0 ? <Empty text="No loans yet. Go to Loans to add your first borrower." /> : <div className="table-wrap">
        <table className="dashboard-loan-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Loan</th>
              <th>Interest</th>
              <th>Total</th>
              <th>Next Payment</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loans.slice(0, 8).map(l => {
              const next = l.payments?.find(p => p.status !== 'Paid');
              const nextRemaining = next ? Math.max(0, Number(next.amount || 0) - Number(next.paidAmount || 0)) : 0;
              return <tr key={l._id} className={deletingId === l._id ? 'loan-row-deleting' : ''}>
                <td>
                  <button className="customer-link" onClick={() => openLoan(l)}>
                    <span className="customer-avatar">{(l.customer?.name || 'B').trim().charAt(0).toUpperCase()}</span>
                    <span>{l.customer?.name || '—'}</span>
                  </button>
                </td>
                <td>{peso(l.principal)}</td>
                <td>{peso(l.interestAmount)}</td>
                <td>{peso(l.totalPayable)}</td>
                <td>
                  {next ? <div className="next-payment-cell">
                    <strong>{peso(nextRemaining)}</strong>
                    <small>{dateText(paymentWithLocalOverride(l, next).dueDate)}</small>
                  </div> : <span className="muted">Fully paid</span>}
                </td>
                <td><span className={'badge ' + String(l.status || '').toLowerCase()}>{l.status}</span></td>
                <td>
                  <div className="table-actions">
                    <button className="pay-btn" onClick={() => openLoan(l)}>View / Pay</button>
                    <button className="edit-btn" onClick={() => startEdit(l)}>Edit</button>
                    <button className="delete-btn" onClick={() => remove(l)} disabled={busy}>{deletingId === l._id ? '🗑️ Throwing…' : 'Delete'}</button>
                  </div>
                </td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>}
    </div>

    {selectedLoan && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setSelectedLoan(null)}>
      <div className="customer-modal" role="dialog" aria-modal="true" aria-label="Customer loan details">
        <div className="modal-header">
          <div>
            <span className="modal-kicker">Customer loan</span>
            <h3>{selectedLoan.customer?.name || 'Borrower'}</h3>
            <p className="muted small">Review the balance and record the customer's payment here.</p>
          </div>
          <button className="modal-close" onClick={() => setSelectedLoan(null)} aria-label="Close">×</button>
        </div>

        {editingId === selectedLoan._id ? <form className="loan-edit-form modal-edit-form" onSubmit={update}>
          <h4>Edit Loan</h4>
          <div className="loan-edit-grid">
            <label>Customer Name<input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required /></label>
            <label>Amount to Loan (₱)<input type="number" min="1" step="0.01" value={editForm.principal} onChange={e => setEditForm({ ...editForm, principal: e.target.value })} required /></label>
            <label>Months to Pay<input type="number" min="1" step="1" value={editForm.termCount} onChange={e => setEditForm({ ...editForm, termCount: e.target.value })} required /></label>
            <label>Interest (₱)<input type="number" min="0" step="0.01" value={editForm.interestValue} onChange={e => setEditForm({ ...editForm, interestValue: e.target.value })} required /></label>
          </div>
          <div className="actions">
            <button className="primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save Changes'}</button>
            <button type="button" onClick={cancelEdit}>Cancel</button>
          </div>
        </form> : <>
          {(() => {
            const collected = selectedLoan.payments?.reduce((sum, p) => sum + Number(p.paidAmount || 0), 0) || 0;
            const remaining = Math.max(0, Number(selectedLoan.totalPayable || 0) - collected);
            const next = selectedLoan.payments?.find(p => p.status !== 'Paid');
            const nextRemaining = next ? Math.max(0, Number(next.amount || 0) - Number(next.paidAmount || 0)) : 0;
            return <div className="customer-summary">
              <div><span>Total Payable</span><strong>{peso(selectedLoan.totalPayable)}</strong></div>
              <div><span>Total Paid</span><strong>{peso(collected)}</strong></div>
              <div><span>Remaining</span><strong className="remaining-highlight">{peso(remaining)}</strong></div>
              <div><span>Next Payment</span><strong>{next ? peso(nextRemaining) : 'None'}</strong><small>{next ? `Due ${dateText(paymentWithLocalOverride(selectedLoan, next).dueDate)}` : 'Loan completed'}</small></div>
            </div>;
          })()}

          <div className="modal-actions">
            <button className="edit-btn" onClick={() => startEdit(selectedLoan)}>✏️ Edit Loan</button>
            <button className="delete-btn" onClick={() => remove(selectedLoan)} disabled={busy}>🗑 Delete Loan</button>
          </div>

          <div className="modal-schedule">
            <div className="modal-section-heading">
              <div><h4>Payment Schedule</h4><span className="muted small">Loan started {dateText(effectiveLoanStartDate(selectedLoan))} · Every 15 days</span></div>
              <div className="schedule-heading-actions">
                <button className="edit-btn" onClick={() => openStartDateEditor(selectedLoan)} disabled={busy}>✏️ Edit Start Date</button>
                {selectedLoan.status && <span className={'badge ' + selectedLoan.status.toLowerCase()}>{selectedLoan.status}</span>}
              </div>
            </div>
            <div className="modal-payment-list">
              {(selectedLoan.payments || []).map(p => {
                const effective = paymentWithLocalOverride(selectedLoan, p);
                const due = Math.max(0, Number(effective.amount || 0) - Number(effective.paidAmount || 0));
                const isNext = selectedLoan.payments?.find(x => x.status !== 'Paid')?._id === p._id;
                return <div className={'modal-payment-row ' + String(p.status || '').toLowerCase()} key={p._id}>
                  <div><b>Payment #{p.installment}</b><small>{p.paidAt ? 'Paid ' : (p.status === 'Paid' ? 'Paid ' : 'Due ')}{dateText(paymentDisplayDate(selectedLoan, p))}</small></div>
                  <div><strong>{peso(due)}</strong><small>of {peso(effective.amount)}</small></div>
                  <span className={'badge ' + String(p.status || '').toLowerCase()}>{p.status}</span>
                  <div className="payment-row-actions">
                    {isNext && p.status !== 'Paid' && <button className="pay-btn" onClick={() => recordPayment(selectedLoan, p)} disabled={busy}>Record Payment</button>}
                  </div>
                </div>;
              })}
            </div>
          </div>
          {editingStartDate && <div className="payment-edit-overlay" role="dialog" aria-modal="true" aria-label="Edit loan start date">
            <form className="payment-edit-card" onSubmit={saveStartDate}>
              <div className="modal-header">
                <div><span className="modal-kicker">Loan schedule</span><h3>Edit Loan Start Date</h3><p className="muted small">Choose the correct date the borrower actually received the loan.</p></div>
                <button type="button" className="modal-close" onClick={() => setEditingStartDate(null)} aria-label="Close">×</button>
              </div>
              <label className="calendar-field">📅 Loan Start Date<input type="date" value={startDateValue} onChange={e => setStartDateValue(e.target.value)} required /></label>
              <p className="muted small payment-edit-note">Unpaid payment dates will follow this start date every 15 days. When a payment is fully paid, its displayed date is automatically set to the actual day it was paid.</p>
              <div className="actions"><button type="button" onClick={() => setEditingStartDate(null)}>Cancel</button><button className="primary" type="submit">Save Start Date</button></div>
            </form>
          </div>}
          {paymentTarget && <PaymentFormModal
            loan={paymentTarget.loan}
            payment={paymentTarget.payment}
            amount={paymentAmount}
            date={paymentDate}
            onAmountChange={setPaymentAmount}
            onDateChange={setPaymentDate}
            onCancel={() => setPaymentTarget(null)}
            onSubmit={submitPayment}
            busy={busy}
          />}

        </>}
      </div>
    </div>}
  </section>;
}


function Profile({ user, onUserUpdate, loading }) {
  const [username, setUsername] = useState(user.username || '');
  const [avatar, setAvatar] = useState(user.avatar || '');
  const [cropSource, setCropSource] = useState('');
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  const prepareAvatarForSave = async () => {
    if (!avatar?.startsWith?.('data:image/')) return avatar || '';
    return await compressAvatarDataUrl(avatar, 640, 700000);
  };

  useEffect(() => {
    setUsername(user.username || '');
    setAvatar(user.avatar || '');
  }, [user.username, user.avatar]);

  const chooseAvatar = e => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please choose an image file.'); return; }
    if (file.size > 25 * 1024 * 1024) { setError('Please choose an image smaller than 25 MB.'); return; }
    setError('');
    setMessage('');
    const reader = new FileReader();
    reader.onload = () => setCropSource(String(reader.result));
    reader.onerror = () => setError('Could not read the selected image.');
    reader.readAsDataURL(file);
  };

  const openCropper = () => {
    if (avatar?.startsWith('data:image/')) {
      setError('');
      setMessage('');
      setCropSource(avatar);
    }
  };

  const applyCrop = result => {
    setAvatar(result);
    setCropSource('');
    setError('');
    setMessage('Photo adjusted. Save your profile to apply it.');
  };

  const selectPreset = value => {
    setAvatar(value);
    setError('');
    setMessage('Avatar selected. Save your profile to apply it.');
  };

  const saveProfile = async e => {
    e.preventDefault();
    setSaving(true); setError(''); setMessage('');
    try {
      const preparedAvatar = await prepareAvatarForSave();
      const r = await api.put('/auth/profile', { username: username.trim(), avatar: preparedAvatar });
      onUserUpdate(r.data.user);
      setAvatar(r.data.user.avatar || preparedAvatar || '');
      setMessage('Profile updated successfully.');
    } catch (e) {
      const serverMessage = e.response?.data?.message;
      setError(serverMessage || (isNetworkError(e) ? 'Cannot reach the server. Please check your internet connection and make sure the Render backend is running.' : 'Could not update profile.'));
    } finally { setSaving(false); }
  };

  const savePassword = async e => {
    e.preventDefault();
    setPasswordSaving(true); setError(''); setMessage('');
    try {
      const r = await api.put('/auth/profile/password', passwords);
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setMessage(r.data.message || 'Password changed successfully.');
    } catch (e) {
      const serverMessage = e.response?.data?.message;
      setError(serverMessage || (isNetworkError(e)
        ? 'Cannot reach the production server. Check your internet connection and make sure the Render backend is running.'
        : `Could not change password${e.response?.status ? ` (HTTP ${e.response.status})` : ''}.`));
    } finally { setPasswordSaving(false); }
  };

  return <section className="profile-page">
    <div className="profile-hero panel">
      <div className="profile-hero-avatar">
        <AvatarView value={avatar} username={username} />
      </div>
      <div><span className="modal-kicker">Account settings</span><h3>{username || 'User'}</h3><p className="muted">Personalize your Business Loan account and keep your login secure.</p></div>
    </div>

    {(message || error) && <div className={error ? 'error profile-message' : 'profile-success profile-message'}>{error || message}</div>}

    <div className="profile-grid">
      <form className="panel profile-card" onSubmit={saveProfile}>
        <div className="profile-card-heading"><div><h3>Profile</h3><p className="muted small">Update your name and profile picture.</p></div><span className="settings-icon">⚙️</span></div>
        <div className="avatar-upload">
          <button type="button" className="avatar-large avatar-clickable" title={avatar?.startsWith('data:image/') ? 'Click to adjust your photo' : 'Click to choose a profile picture'} onClick={avatar?.startsWith('data:image/') ? openCropper : undefined}>
            <AvatarView value={avatar} username={username} />
            <span className="avatar-change-badge">{avatar?.startsWith('data:image/') ? '✎' : '+'}</span>
            {!avatar?.startsWith('data:image/') && <input type="file" accept="image/*" onChange={chooseAvatar} hidden />}
          </button>
          <div className="avatar-controls">
            <div className="avatar-actions">
              <label className="upload-button"><input type="file" accept="image/*" onChange={chooseAvatar} hidden /> 📷 Upload Image</label>
              <button type="button" className="remove-avatar" onClick={() => { setAvatar(''); setMessage(''); }} disabled={!avatar}>Remove</button>
            </div>
            <div className="avatar-presets"><span className="muted small">Choose an avatar</span><div className="avatar-preset-grid">{AVATAR_PRESETS.map(p => <button key={p.id} type="button" className={`avatar-preset-button ${avatar === p.value ? 'selected' : ''}`} title={p.label} aria-label={p.label} onClick={() => selectPreset(p.value)}><AvatarView value={p.value} username={username} /></button>)}</div></div>
            <p className="muted small">JPG, PNG, or WEBP · Up to 25 MB selected · adjust position and zoom before saving.</p>
          </div>
        </div>
        <label>Username<input value={username} onChange={e => setUsername(e.target.value)} minLength="2" required /></label>
        <button className="primary full" type="submit" disabled={saving || loading}>{saving ? 'Saving…' : 'Save Profile'}</button>
      </form>

      <form className="panel profile-card" onSubmit={savePassword}>
        <div className="profile-card-heading"><div><h3>Security</h3><p className="muted small">Change your password without creating a new account.</p></div><span className="settings-icon">🔐</span></div>
        <label>Current Password<div className="password-field"><input type={showCurrentPassword ? 'text' : 'password'} value={passwords.currentPassword} onChange={e => setPasswords({ ...passwords, currentPassword: e.target.value })} required /><button type="button" className="password-toggle eye-toggle" onClick={() => setShowCurrentPassword(v => !v)} aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}>{showCurrentPassword ? '🙈' : '👁️'}</button></div></label>
        <label>New Password<div className="password-field"><input type={showNewPassword ? 'text' : 'password'} value={passwords.newPassword} onChange={e => setPasswords({ ...passwords, newPassword: e.target.value })} minLength="6" required /><button type="button" className="password-toggle eye-toggle" onClick={() => setShowNewPassword(v => !v)} aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}>{showNewPassword ? '🙈' : '👁️'}</button></div></label>
        <label>Confirm New Password<div className="password-field"><input type={showConfirmNewPassword ? 'text' : 'password'} value={passwords.confirmPassword} onChange={e => setPasswords({ ...passwords, confirmPassword: e.target.value })} minLength="6" required /><button type="button" className="password-toggle eye-toggle" onClick={() => setShowConfirmNewPassword(v => !v)} aria-label={showConfirmNewPassword ? 'Hide confirmation password' : 'Show confirmation password'}>{showConfirmNewPassword ? '🙈' : '👁️'}</button></div></label>
        <button className="primary full" type="submit" disabled={passwordSaving}>{passwordSaving ? 'Changing…' : 'Change Password'}</button>
      </form>
    </div>
    {cropSource && <AvatarCropper source={cropSource} onCancel={() => setCropSource('')} onApply={applyCrop} />}
  </section>;
}

function Stat({ title, value }) { return <div className="stat"><span>{title}</span><strong>{value}</strong></div>; }
function Empty({ text }) { return <div className="empty">{text}</div>; }

function Loans({ loans, reload }) {
  const blank = { name: '', principal: 500, termCount: 1, interestValue: 100, startDate: localDateInput() };
  const [form, setForm] = useState(blank);
  const [showForm, setShowForm] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', principal: '', termCount: '', interestValue: '', startDate: '' });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [deletingId, setDeletingId] = useState(null);
  const [pocketName, setPocketName] = useState('');
  const [editingStartDate, setEditingStartDate] = useState(null);
  const [startDateValue, setStartDateValue] = useState('');
  const [paymentTarget, setPaymentTarget] = useState(null);
  const [paymentEntryAmount, setPaymentEntryAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(localDateInput());

  const total = useMemo(() => Number(form.principal || 0) + Number(form.interestValue || 0), [form.principal, form.interestValue]);
  const payments = Math.max(1, Number(form.termCount || 1) * 2);
  const paymentAmount = total / payments;
  const visibleLoans = useMemo(() => loans.filter(loan => {
    const name = loan.customer?.name || '';
    const matchesSearch = name.toLowerCase().includes(search.toLowerCase()) || String(loan.principal).includes(search);
    const matchesStatus = statusFilter === 'All' || loan.status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [loans, search, statusFilter]);

  const save = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/loans', {
        borrowerName: form.name,
        principal: Number(form.principal),
        interestType: 'fixed',
        interestValue: Number(form.interestValue),
        termCount: Number(form.termCount),
        termUnit: 'months',
        frequency: '15days',
        startDate: form.startDate || localDateInput()
      });
      const savedName = form.name.trim();
      setForm(blank);
      setShowForm(false);
      await reload();
      setPocketName(savedName);
    } catch (e) {
      alert(e.response?.data?.message || 'Could not create loan.');
    } finally {
      setSaving(false);
    }
  };


  const startEdit = loan => {
    setEditingId(loan._id);
    setEditForm({
      name: loan.customer?.name || '',
      principal: loan.principal,
      termCount: loan.termCount,
      interestValue: loan.interestValue,
      startDate: loan.startDate ? localDateInput(loan.startDate) : localDateInput(loan.createdAt)
    });
    setExpanded(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ name: '', principal: '', termCount: '', interestValue: '', startDate: '' });
  };

  const update = async e => {
    e.preventDefault();
    try {
      await api.put(`/loans/${editingId}`, {
        borrowerName: editForm.name,
        principal: Number(editForm.principal),
        interestValue: Number(editForm.interestValue),
        termCount: Number(editForm.termCount),
        startDate: editForm.startDate
      });
      cancelEdit();
      await reload();
    } catch (e) {
      alert(e.response?.data?.message || 'Could not update loan.');
    }
  };

  const remove = async loan => {
    const customerName = loan.customer?.name || 'this customer';
    const confirmed = window.confirm(
      `Delete the loan for ${customerName}?\n\nThis permanently removes the loan, its payment schedule, and its recorded payments. If this is the customer's only loan, their customer record will also be removed.\n\nContinue?`
    );
    if (!confirmed) return;

    setDeletingId(loan._id);
    try {
      // Give the card a short throw-away animation before deleting the record.
      await new Promise(resolve => setTimeout(resolve, 650));
      await api.delete(`/loans/${loan._id}`);
      if (expanded === loan._id) setExpanded(null);
      await reload();
    } catch (e) {
      alert(e.response?.data?.message || 'Could not delete loan.');
    } finally {
      setDeletingId(null);
    }
  };

  const pay = (loan, payment) => {
    const remaining = Number((payment.amount - payment.paidAmount).toFixed(2));
    setPaymentTarget({ loan, payment });
    setPaymentEntryAmount(remaining.toFixed(2));
    setPaymentDate(localDateInput());
  };

  const submitPayment = async e => {
    e.preventDefault();
    if (!paymentTarget) return;
    const { loan, payment } = paymentTarget;
    const remaining = Number((payment.amount - payment.paidAmount).toFixed(2));
    const received = Number(paymentEntryAmount);
    if (!received || received <= 0 || received > remaining) {
      alert(`Please enter an amount from ₱0.01 to ₱${remaining.toFixed(2)}.`);
      return;
    }
    if (!paymentDate) { alert('Please select the date the payment was made.'); return; }
    setSaving(true);
    try {
      await api.post(`/loans/${loan._id}/payments/${payment._id}`, { amount: received, paidAt: paymentDate });
      await reload();
      setPaymentTarget(null);
    } catch (e) {
      alert(e.response?.data?.message || 'Could not record payment.');
    } finally { setSaving(false); }
  };

  const openStartDateEditor = loan => {
    setEditingStartDate(loan);
    setStartDateValue(localDateInput(effectiveLoanStartDate(loan)));
  };

  const saveStartDate = async e => {
    e.preventDefault();
    if (!editingStartDate || !startDateValue) return;
    try {
      await api.put(`/loans/${editingStartDate._id}`, {
        borrowerName: editingStartDate.customer?.name || 'Borrower',
        principal: Number(editingStartDate.principal),
        interestValue: Number(editingStartDate.interestValue),
        termCount: Number(editingStartDate.termCount),
        startDate: startDateValue
      });
      clearLoanStartDateOverride(editingStartDate._id);
      await reload();
    } catch (e) {
      setLoanStartDateOverride(editingStartDate._id, startDateValue);
      await reload();
      alert('Start date updated for this device. The existing recorded payments were kept unchanged.');
    } finally {
      setEditingStartDate(null);
      setStartDateValue('');
    }
  };


  return <section>
    {pocketName && <PocketDepositAnimation name={pocketName} onDone={() => setPocketName('')} />}
    <div className="loan-intro"><div><h3>Customers & Loans</h3><p className="muted">Add someone who wants to borrow from you. You set the loan amount, months, and interest.</p></div><button className="primary" onClick={() => setShowForm(v => !v)}>{showForm ? 'Close Form' : '+ Add Loan'}</button></div>

    {showForm && <div className="panel loan-form-panel">
      <h3>Add New Loan</h3>
      <p className="muted small">The payment schedule is automatically calculated every 15 days. Interest is a fixed amount that you can set for each borrower.</p>
      <form className="loan-form" onSubmit={save}>
        <label>Customer Name<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Enter customer's name" required /></label>
        <label className="calendar-field">📅 Loan Start Date<input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} required /></label>
        <label>Amount to Loan (₱)<input type="number" min="1" step="0.01" value={form.principal} onChange={e => setForm({ ...form, principal: e.target.value })} required /></label>
        <label>How Many Months to Pay?<input type="number" min="1" step="1" value={form.termCount} onChange={e => setForm({ ...form, termCount: e.target.value })} required /></label>
        <label>Your Interest (₱)<input type="number" min="0" step="0.01" value={form.interestValue} onChange={e => setForm({ ...form, interestValue: e.target.value })} required /></label>
        <div className="loan-preview wide">
          <div><span>Total Payable</span><strong>{peso(total)}</strong></div>
          <div><span>Payments</span><strong>{payments} × {peso(paymentAmount)}</strong></div>
          <div><span>Schedule</span><strong>Every 15 Days</strong></div>
        </div>
        <div className="actions"><button className="primary" disabled={saving}>{saving ? 'Saving...' : 'Save Loan'}</button></div>
      </form>
    </div>}

    <div className="panel">
      <div className="panel-title"><div><h3>Loan List</h3><p className="muted small">Every loan keeps its own payment schedule.</p></div><div className="loan-filters"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search borrower or amount" /><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option>All</option><option>Active</option><option>Completed</option></select></div></div>
      {loans.length === 0 ? <Empty text="No loans yet. Add a borrower above." /> : visibleLoans.length === 0 ? <Empty text="No loans match your search." /> : <div className="loan-list">{visibleLoans.map(loan => {
        const collected = loan.payments?.reduce((s, p) => s + Number(p.paidAmount || 0), 0) || 0;
        const remaining = Math.max(0, Number(loan.totalPayable || 0) - collected);
        const next = loan.payments?.find(p => p.status !== 'Paid');
        return <div className={`loan-card ${deletingId === loan._id ? 'loan-card-deleting' : ''}`} key={loan._id}>
          <div className="loan-card-top">
            <div><h3>{loan.customer?.name || 'Borrower'}</h3><span className="muted">Loan date: {dateText(effectiveLoanStartDate(loan))} · Recorded {dateText(loan.createdAt)}</span></div>
            <span className={'badge ' + loan.status.toLowerCase()}>{loan.status}</span>
          </div>
          <div className="loan-details">
            <div><span>Amount</span><strong>{peso(loan.principal)}</strong></div>
            <div><span>Interest</span><strong>{peso(loan.interestAmount)}</strong></div>
            <div><span>Total</span><strong>{peso(loan.totalPayable)}</strong></div>
            <div><span>Term</span><strong>{loan.termCount} month{loan.termCount === 1 ? '' : 's'}</strong></div>
            <div><span>Remaining</span><strong>{peso(remaining)}</strong></div>
            <div><span>Loan Date</span><strong>{dateText(effectiveLoanStartDate(loan))}</strong></div>
            <div><span>Next Payment</span><strong>{next ? `${peso(next.amount - next.paidAmount)} · ${dateText(paymentWithLocalOverride(loan, next).dueDate)}` : 'None'}</strong></div>
          </div>
          <div className="loan-card-actions">
            <button onClick={() => setExpanded(expanded === loan._id ? null : loan._id)}>{expanded === loan._id ? 'Hide Schedule' : 'View Schedule'}</button>
            <button className="primary" onClick={() => downloadLoanReceipt(loan)}>Download Receipt</button>
            <button className="edit-btn" onClick={() => startEdit(loan)}>Edit</button>
            <button className="delete-btn" onClick={() => remove(loan)} disabled={deletingId !== null}>{deletingId === loan._id ? '🗑️ Throwing…' : 'Delete'}</button>
          </div>
          {editingId === loan._id && <form className="loan-edit-form" onSubmit={update}>
            <h4>Edit Loan</h4>
            <div className="loan-edit-grid">
              <label>Customer Name<input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required /></label>
              <label className="calendar-field">📅 Loan Start Date<input type="date" value={editForm.startDate} onChange={e => setEditForm({ ...editForm, startDate: e.target.value })} required /></label>
              <label>Amount to Loan (₱)<input type="number" min="1" step="0.01" value={editForm.principal} onChange={e => setEditForm({ ...editForm, principal: e.target.value })} required /></label>
              <label>Months to Pay<input type="number" min="1" step="1" value={editForm.termCount} onChange={e => setEditForm({ ...editForm, termCount: e.target.value })} required /></label>
              <label>Interest (₱)<input type="number" min="0" step="0.01" value={editForm.interestValue} onChange={e => setEditForm({ ...editForm, interestValue: e.target.value })} required /></label>
            </div>
            <div className="actions">
              <button className="primary" type="submit">Save Changes</button>
              <button type="button" onClick={cancelEdit}>Cancel</button>
            </div>
          </form>}
          {expanded === loan._id && <div className="schedule"><div className="schedule-heading"><div><h4>Payment Schedule</h4><small>Loan started {dateText(effectiveLoanStartDate(loan))} · Every 15 days</small></div><div className="schedule-heading-actions"><button className="edit-btn" onClick={() => openStartDateEditor(loan)}>✏️ Edit Start Date</button><span className="calendar-chip">📅 {dateText(effectiveLoanStartDate(loan))}</span></div></div>{loan.payments.map(p => { const effective = paymentWithLocalOverride(loan, p); const isNext = loan.payments.find(x => x.status !== 'Paid')?._id === p._id; return <div className="payment-row" key={p._id}><span><b>Payment #{p.installment}</b><small>{p.paidAt ? 'Paid ' : (p.status === 'Paid' ? 'Paid ' : 'Due ')}{dateText(paymentDisplayDate(loan, p))}</small></span><span>{peso(effective.amount)}<small>Paid: {peso(effective.paidAmount)}</small></span><span className={'badge ' + p.status.toLowerCase()}>{p.status}</span><div className="payment-row-actions">{isNext && p.status !== 'Paid' && <button onClick={() => pay(loan, p)}>Record Payment</button>}</div></div>; })}</div>}
        </div>;
      })}</div>}
    </div>
    {paymentTarget && <PaymentFormModal
      loan={paymentTarget.loan}
      payment={paymentTarget.payment}
      amount={paymentEntryAmount}
      date={paymentDate}
      onAmountChange={setPaymentEntryAmount}
      onDateChange={setPaymentDate}
      onCancel={() => setPaymentTarget(null)}
      onSubmit={submitPayment}
      busy={saving}
    />}
    {editingStartDate && <div className="payment-edit-overlay" role="dialog" aria-modal="true" aria-label="Edit loan start date">
      <form className="payment-edit-card" onSubmit={saveStartDate}>
        <div className="modal-header"><div><span className="modal-kicker">Loan schedule</span><h3>Edit Loan Start Date</h3><p className="muted small">Choose the correct date the borrower actually received the loan.</p></div><button type="button" className="modal-close" onClick={() => setEditingStartDate(null)} aria-label="Close">×</button></div>
        <label className="calendar-field">📅 Loan Start Date<input type="date" value={startDateValue} onChange={e => setStartDateValue(e.target.value)} required /></label>
        <p className="muted small payment-edit-note">Unpaid payment dates will follow this start date every 15 days. When a payment is fully paid, its displayed date is automatically set to the actual day it was paid.</p>
        <div className="actions"><button type="button" onClick={() => setEditingStartDate(null)}>Cancel</button><button className="primary" type="submit">Save Start Date</button></div>
      </form>
    </div>}
  </section>;
}

createRoot(document.getElementById('root')).render(<App />);
