import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import api from './api';
import { jsPDF } from 'jspdf';
import './styles.css';

const peso = n => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateText = d => new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });


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

  doc.save(`${receiptNo}-${borrower.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'borrower'}.pdf`);
}

function Auth({ onLogin }) {
  const [register, setRegister] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const r = await api.post(`/auth/${register ? 'register' : 'login'}`, form);
      localStorage.setItem('loan_token', r.data.token);
      onLogin(r.data.user);
    } catch (e) {
      setError(e.response?.data?.message || 'Unable to connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  return <div className="auth-page"><div className="auth-card">
    <div className="logo">💰</div>
    <h1>Business Loan</h1>
    <p className="muted">{register ? 'Create your account to manage business loans.' : 'Enter your username and password to continue.'}</p>
    <form onSubmit={submit}>
      <label>Username<input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="Enter username" required /></label>
      <label>Password<input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Enter password" required /></label>
      {register && <label>Confirm Password<input type="password" value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} placeholder="Confirm password" required /></label>}
      {error && <div className="error">{error}</div>}
      <button className="primary full" disabled={loading}>{loading ? 'Please wait...' : register ? 'Create Account' : 'Login'}</button>
    </form>
    <div className="switch">{register ? <>Already have an account? <button onClick={() => { setRegister(false); setError(''); }}>Login</button></> : <>Don't have an account yet? <button onClick={() => { setRegister(true); setError(''); }}>Create an Account</button></>}</div>
  </div></div>;
}

function App() {
  const [user, setUser] = useState(() => localStorage.getItem('loan_token') ? { username: 'User' } : null);
  const [page, setPage] = useState('dashboard');
  const [loans, setLoans] = useState([]);
  const [stats, setStats] = useState({});
  const [message, setMessage] = useState('');

  const logout = () => { localStorage.removeItem('loan_token'); setUser(null); };

  const load = async () => {
    try {
      const [l, s] = await Promise.all([api.get('/loans'), api.get('/loans/dashboard')]);
      setLoans(l.data);
      setStats(s.data);
    } catch (e) {
      if (e.response?.status === 401) logout();
      else setMessage(e.response?.data?.message || 'Could not load data.');
    }
  };

  useEffect(() => { if (user) load(); }, [user]);

  if (!user) return <Auth onLogin={u => setUser(u)} />;

  return <div className="app">
    <aside>
      <div className="brand">💰 <span>Business Loan</span></div>
      <button className={page === 'dashboard' ? 'nav active' : 'nav'} onClick={() => setPage('dashboard')}>📊 Dashboard</button>
      <button className={page === 'loans' ? 'nav active' : 'nav'} onClick={() => setPage('loans')}>💳 Loans</button>
      <div className="sidebar-bottom"><span>Signed in as <b>{user.username}</b></span><button className="logout" onClick={logout}>Log out</button></div>
    </aside>
    <main>
      <header><div><h2>{page === 'dashboard' ? 'Dashboard' : 'Loans'}</h2><p className="muted">Manage your customers, loans, and payments.</p></div>{message && <div className="toast">{message}</div>}</header>
      {page === 'dashboard' ? <Dashboard stats={stats} loans={loans} /> : <Loans loans={loans} reload={load} />}
    </main>
  </div>;
}

function Dashboard({ stats, loans }) {
  return <section>
    <div className="cards">
      <Stat title="Customers" value={stats.customers || 0} />
      <Stat title="Active Loans" value={stats.activeLoans || 0} />
      <Stat title="Total Payable" value={peso(stats.totalPayable)} />
      <Stat title="Remaining Balance" value={peso(stats.remaining)} />
    </div>
    <div className="install-app-card">
      <div className="install-app-info">
        <div className="install-app-icon">📱</div>
        <div>
          <h3>Install Business Loan App</h3>
          <p className="muted small">Use the Android app for quick access to your loan management system.</p>
        </div>
      </div>
      <a className="install-app-button" href="/Business-Loan.apk" download="Business-Loan.apk" aria-label="Download Business Loan Android APK">
        📲 Download APK
      </a>
    </div>
    <div className="panel">
      <div className="panel-title"><div><h3>Recent Loans</h3><p className="muted small">Loans added from the Loans page.</p></div></div>
      {loans.length === 0 ? <Empty text="No loans yet. Go to Loans to add your first borrower." /> : <table><thead><tr><th>Customer</th><th>Loan</th><th>Interest</th><th>Total</th><th>Months</th><th>Status</th></tr></thead><tbody>
        {loans.slice(0, 8).map(l => <tr key={l._id}><td>{l.customer?.name || '—'}</td><td>{peso(l.principal)}</td><td>{peso(l.interestAmount)}</td><td>{peso(l.totalPayable)}</td><td>{l.termCount}</td><td><span className={'badge ' + l.status.toLowerCase()}>{l.status}</span></td></tr>)}
      </tbody></table>}
    </div>
  </section>;
}


function Stat({ title, value }) { return <div className="stat"><span>{title}</span><strong>{value}</strong></div>; }
function Empty({ text }) { return <div className="empty">{text}</div>; }

function Loans({ loans, reload }) {
  const blank = { name: '', principal: 500, termCount: 1, interestValue: 100 };
  const [form, setForm] = useState(blank);
  const [showForm, setShowForm] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', principal: '', termCount: '', interestValue: '' });

  const total = useMemo(() => Number(form.principal || 0) + Number(form.interestValue || 0), [form.principal, form.interestValue]);
  const payments = Math.max(1, Number(form.termCount || 1) * 2);
  const paymentAmount = total / payments;

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
        startDate: new Date().toISOString().slice(0, 10)
      });
      setForm(blank);
      setShowForm(false);
      await reload();
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
      interestValue: loan.interestValue
    });
    setExpanded(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ name: '', principal: '', termCount: '', interestValue: '' });
  };

  const update = async e => {
    e.preventDefault();
    try {
      await api.put(`/loans/${editingId}`, {
        borrowerName: editForm.name,
        principal: Number(editForm.principal),
        interestValue: Number(editForm.interestValue),
        termCount: Number(editForm.termCount)
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
      `Delete the loan for ${customerName}?\n\nThis cannot be undone. Loans with recorded payments cannot be deleted.`
    );
    if (!confirmed) return;

    try {
      await api.delete(`/loans/${loan._id}`);
      if (expanded === loan._id) setExpanded(null);
      await reload();
    } catch (e) {
      alert(e.response?.data?.message || 'Could not delete loan.');
    }
  };

  const pay = async (loan, payment) => {
    const remaining = Number((payment.amount - payment.paidAmount).toFixed(2));
    const amount = prompt(`Payment due: ${peso(remaining)}\nEnter payment amount:`);
    if (amount === null) return;
    try {
      await api.post(`/loans/${loan._id}/payments/${payment._id}`, { amount: Number(amount) });
      await reload();
    } catch (e) {
      alert(e.response?.data?.message || 'Could not record payment.');
    }
  };

  return <section>
    <div className="loan-intro"><div><h3>Customers & Loans</h3><p className="muted">Add someone who wants to borrow from you. You set the loan amount, months, and interest.</p></div><button className="primary" onClick={() => setShowForm(v => !v)}>{showForm ? 'Close Form' : '+ Add Loan'}</button></div>

    {showForm && <div className="panel loan-form-panel">
      <h3>Add New Loan</h3>
      <p className="muted small">The payment schedule is automatically calculated every 15 days. Interest is a fixed amount that you can set for each borrower.</p>
      <form className="loan-form" onSubmit={save}>
        <label>Customer Name<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Enter customer's name" required /></label>
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
      <div className="panel-title"><div><h3>Loan List</h3><p className="muted small">Every loan keeps its own payment schedule.</p></div></div>
      {loans.length === 0 ? <Empty text="No loans yet. Add a borrower above." /> : <div className="loan-list">{loans.map(loan => {
        const collected = loan.payments?.reduce((s, p) => s + Number(p.paidAmount || 0), 0) || 0;
        const remaining = Math.max(0, Number(loan.totalPayable || 0) - collected);
        const next = loan.payments?.find(p => p.status !== 'Paid');
        return <div className="loan-card" key={loan._id}>
          <div className="loan-card-top">
            <div><h3>{loan.customer?.name || 'Borrower'}</h3><span className="muted">Loan created {dateText(loan.createdAt)}</span></div>
            <span className={'badge ' + loan.status.toLowerCase()}>{loan.status}</span>
          </div>
          <div className="loan-details">
            <div><span>Amount</span><strong>{peso(loan.principal)}</strong></div>
            <div><span>Interest</span><strong>{peso(loan.interestAmount)}</strong></div>
            <div><span>Total</span><strong>{peso(loan.totalPayable)}</strong></div>
            <div><span>Term</span><strong>{loan.termCount} month{loan.termCount === 1 ? '' : 's'}</strong></div>
            <div><span>Remaining</span><strong>{peso(remaining)}</strong></div>
            <div><span>Next Payment</span><strong>{next ? `${peso(next.amount - next.paidAmount)} · ${dateText(next.dueDate)}` : 'None'}</strong></div>
          </div>
          <div className="loan-card-actions">
            <button onClick={() => setExpanded(expanded === loan._id ? null : loan._id)}>{expanded === loan._id ? 'Hide Schedule' : 'View Schedule'}</button>
            <button className="primary" onClick={() => downloadLoanReceipt(loan)}>Download Receipt</button>
            <button className="edit-btn" onClick={() => startEdit(loan)}>Edit</button>
            <button className="delete-btn" onClick={() => remove(loan)}>Delete</button>
          </div>
          {editingId === loan._id && <form className="loan-edit-form" onSubmit={update}>
            <h4>Edit Loan</h4>
            <div className="loan-edit-grid">
              <label>Customer Name<input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required /></label>
              <label>Amount to Loan (₱)<input type="number" min="1" step="0.01" value={editForm.principal} onChange={e => setEditForm({ ...editForm, principal: e.target.value })} required /></label>
              <label>Months to Pay<input type="number" min="1" step="1" value={editForm.termCount} onChange={e => setEditForm({ ...editForm, termCount: e.target.value })} required /></label>
              <label>Interest (₱)<input type="number" min="0" step="0.01" value={editForm.interestValue} onChange={e => setEditForm({ ...editForm, interestValue: e.target.value })} required /></label>
            </div>
            <div className="actions">
              <button className="primary" type="submit">Save Changes</button>
              <button type="button" onClick={cancelEdit}>Cancel</button>
            </div>
          </form>}
          {expanded === loan._id && <div className="schedule"><h4>Payment Schedule</h4>{loan.payments.map(p => <div className="payment-row" key={p._id}><span><b>Payment #{p.installment}</b><small>{dateText(p.dueDate)}</small></span><span>{peso(p.amount)}<small>Paid: {peso(p.paidAmount)}</small></span><span className={'badge ' + p.status.toLowerCase()}>{p.status}</span>{p.status !== 'Paid' && <button onClick={() => pay(loan, p)}>Record Payment</button>}</div>)}</div>}
        </div>;
      })}</div>}
    </div>
  </section>;
}

createRoot(document.getElementById('root')).render(<App />);
