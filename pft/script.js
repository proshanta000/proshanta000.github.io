/**
 * Personal Finance Tracker - corrected/reliable frontend
 * Compatible with the existing profiles/accounts/categories/transactions/
 * transfers/budgets schema used by this project.
 */

const state = {
  user: null,
  accounts: [],
  categories: [],
  transactions: [],
  transfers: [],
  budgets: [],
  pagination: { page: 1, limit: 10 },
  charts: {}
};

const DEFAULT_CATEGORIES = [
  { name: 'Salary', type: 'Income' },
  { name: 'Freelance', type: 'Income' },
  { name: 'Business', type: 'Income' },
  { name: 'Investment', type: 'Income' },
  { name: 'Gift', type: 'Income' },
  { name: 'Other Income', type: 'Income' },
  { name: 'Food', type: 'Expense' },
  { name: 'Transport', type: 'Expense' },
  { name: 'Rent', type: 'Expense' },
  { name: 'Shopping', type: 'Expense' },
  { name: 'Bills', type: 'Expense' },
  { name: 'Mobile / Internet', type: 'Expense' },
  { name: 'Medical', type: 'Expense' },
  { name: 'Education', type: 'Expense' },
  { name: 'Entertainment', type: 'Expense' },
  { name: 'Family', type: 'Expense' },
  { name: 'Other Expense', type: 'Expense' },
  { name: 'Bank Fee', type: 'Other Cost' },
  { name: 'Tax', type: 'Other Cost' }
];

function requireDb() {
  if (!window.db) throw new Error('Supabase is not initialized. Check config.js and the Supabase CDN.');
  return window.db;
}

function localDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function localMonthString(date = new Date()) {
  return localDateString(date).slice(0, 7);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function numberValue(value) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function currency() {
  return state.user?.currency || CONFIG.DEFAULT_CURRENCY || '৳';
}

function userId() {
  return state.user?.id || null;
}

function assertLoggedIn() {
  if (!state.user?.id) throw new Error('Your session has expired. Please log in again.');
}

function getErrorMessage(error) {
  if (!error) return 'Unknown database error';
  return error.message || error.details || error.hint || JSON.stringify(error);
}

async function ensureDefaultData() {
  assertLoggedIn();
  const db = requireDb();

  if (state.categories.length === 0) {
    const rows = DEFAULT_CATEGORIES.map(c => ({
      ...c,
      profile_id: state.user.id,
      is_default: true
    }));
    const { error } = await db.from('categories').insert(rows);
    if (error) throw error;
  }

  if (state.accounts.length === 0) {
    const { error } = await db.from('accounts').insert([{
      profile_id: state.user.id,
      account_name: 'Cash',
      account_type: 'Cash',
      opening_balance: 0,
      currency: currency(),
      is_active: true
    }]);
    if (error) throw error;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  applySystemTheme();
  setDefaultMonths();
  checkSession();
});

function setupEventListeners() {
  const ids = [
    'show-register', 'show-login', 'login-form', 'register-form', 'logout-btn',
    'menu-toggle', 'tx-form', 'acc-form', 'transfer-form', 'budget-form',
    'settings-form', 'tx-type', 'prev-page', 'next-page', 'summary-month-select',
    'budget-month-select', 'summary-prev-month', 'summary-next-month'
  ];
  ids.forEach(id => {
    if (!document.getElementById(id)) console.warn(`Missing HTML element: #${id}`);
  });

  document.getElementById('show-register').addEventListener('click', e => {
    e.preventDefault();
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.remove('hidden');
  });

  document.getElementById('show-login').addEventListener('click', e => {
    e.preventDefault();
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('login-form').classList.remove('hidden');
  });

  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('register-form').addEventListener('submit', handleRegister);
  document.getElementById('logout-btn').addEventListener('click', handleLogout);

  document.getElementById('menu-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  document.querySelectorAll('.sidebar .nav-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.sidebar .nav-item').forEach(i => i.classList.remove('active'));
      document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
      item.classList.add('active');
      const view = item.dataset.view;
      const panel = document.getElementById(`view-${view}`);
      if (panel) panel.classList.add('active');
      document.getElementById('sidebar').classList.remove('open');
      renderView(view);
    });
  });

  document.getElementById('tx-form').addEventListener('submit', handleSaveTransaction);
  document.getElementById('acc-form').addEventListener('submit', handleSaveAccount);
  document.getElementById('transfer-form').addEventListener('submit', handleSaveTransfer);
  document.getElementById('budget-form').addEventListener('submit', handleSaveBudget);
  document.getElementById('settings-form').addEventListener('submit', handleSaveSettings);

  document.querySelectorAll('.filter-grid input, .filter-grid select').forEach(el => {
    el.addEventListener('input', () => {
      state.pagination.page = 1;
      renderTransactions();
    });
    el.addEventListener('change', () => {
      state.pagination.page = 1;
      renderTransactions();
    });
  });

  document.getElementById('tx-type').addEventListener('change', populateCategorySelect);
  document.getElementById('prev-page').addEventListener('click', () => {
    if (state.pagination.page > 1) {
      state.pagination.page--;
      renderTransactions();
    }
  });
  document.getElementById('next-page').addEventListener('click', () => {
    state.pagination.page++;
    renderTransactions();
  });

  document.getElementById('summary-month-select').addEventListener('change', renderMonthlySummary);
  document.getElementById('budget-month-select').addEventListener('change', renderBudgets);
  document.getElementById('summary-prev-month').addEventListener('click', () => shiftSummaryMonth(-1));
  document.getElementById('summary-next-month').addEventListener('click', () => shiftSummaryMonth(1));
}

function setDefaultMonths() {
  const month = localMonthString();
  document.getElementById('summary-month-select').value = month;
  document.getElementById('budget-month-select').value = month;
}

async function checkSession() {
  const saved = localStorage.getItem('pft_user');
  if (!saved) {
    showAuth();
    return;
  }

  try {
    state.user = JSON.parse(saved);
    if (!state.user?.id) throw new Error('Invalid saved session');

    // Refresh the profile so changed settings are not stuck in localStorage.
    const { data, error } = await requireDb()
      .from('profiles')
      .select('*')
      .eq('id', state.user.id)
      .maybeSingle();

    if (error) throw error;
    if (!data || data.is_active === false) throw new Error('Profile not found or inactive');

    state.user = data;
    localStorage.setItem('pft_user', JSON.stringify(data));
    await initializeUserApp();
  } catch (err) {
    console.warn('Saved session could not be restored:', err);
    localStorage.removeItem('pft_user');
    state.user = null;
    showAuth();
    showToast('Please log in again.', 'error');
  }
}

function showAuth() {
  document.getElementById('auth-container').classList.remove('hidden');
  document.getElementById('app-container').classList.add('hidden');
}

async function handleLogin(e) {
  e.preventDefault();
  const userIdInput = document.getElementById('login-userid').value.trim();
  const password = document.getElementById('login-password').value;

  if (!userIdInput || !password) {
    showToast('Please enter User ID and Password.', 'error');
    return;
  }

  try {
    showSyncStatus('Connecting...', 'syncing');
    const { data, error } = await requireDb()
      .from('profiles')
      .select('*')
      .eq('user_id', userIdInput)
      .maybeSingle();

    if (error) throw error;
    if (!data || data.is_active === false || data.password_hash !== btoa(unescape(encodeURIComponent(password)))) {
      showSyncStatus('Login Failed', 'error');
      showToast('Invalid User ID or Password', 'error');
      return;
    }

    state.user = data;
    localStorage.setItem('pft_user', JSON.stringify(data));
    document.getElementById('login-password').value = '';
    showToast('Login successful', 'success');
    await initializeUserApp();
  } catch (err) {
    console.error('Login error:', err);
    showSyncStatus('Connection Error', 'error');
    showToast('Login error: ' + getErrorMessage(err), 'error');
  }
}

function encodePassword(password) {
  // Kept compatible with the existing database records while handling Unicode safely.
  return btoa(unescape(encodeURIComponent(password)));
}

async function handleRegister(e) {
  e.preventDefault();
  const fullName = document.getElementById('reg-fullname').value.trim();
  const newUserId = document.getElementById('reg-userid').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirmPassword = document.getElementById('reg-confirm-password').value;

  if (!fullName || !newUserId || !password) {
    showToast('Please complete all required fields.', 'error');
    return;
  }
  if (password.length < 4) {
    showToast('Password must be at least 4 characters.', 'error');
    return;
  }
  if (password !== confirmPassword) {
    showToast('Passwords do not match', 'error');
    return;
  }

  try {
    showSyncStatus('Creating account...', 'syncing');
    const db = requireDb();

    const { data: existing, error: existingError } = await db
      .from('profiles')
      .select('id')
      .eq('user_id', newUserId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) {
      showToast('User ID already exists', 'error');
      showSyncStatus('Ready', 'synced');
      return;
    }

    const { data: newUser, error } = await db.from('profiles').insert([{
      user_id: newUserId,
      full_name: fullName,
      password_hash: encodePassword(password),
      currency: CONFIG.DEFAULT_CURRENCY,
      theme: 'system',
      is_active: true
    }]).select().single();

    if (error) throw error;

    try {
      const categoryRows = DEFAULT_CATEGORIES.map(c => ({
        ...c,
        profile_id: newUser.id,
        is_default: true
      }));
      const { error: categoryError } = await db.from('categories').insert(categoryRows);
      if (categoryError) throw categoryError;

      const { error: accountError } = await db.from('accounts').insert([{
        profile_id: newUser.id,
        account_name: 'Cash',
        account_type: 'Cash',
        opening_balance: 0,
        currency: CONFIG.DEFAULT_CURRENCY,
        is_active: true
      }]);
      if (accountError) throw accountError;
    } catch (seedError) {
      // Avoid leaving a half-created profile if default data cannot be created.
      await db.from('profiles').delete().eq('id', newUser.id);
      throw seedError;
    }

    state.user = newUser;
    localStorage.setItem('pft_user', JSON.stringify(newUser));
    document.getElementById('register-form').reset();
    showToast('Account registered successfully', 'success');
    await initializeUserApp();
  } catch (err) {
    console.error('Registration error:', err);
    showSyncStatus('Registration Failed', 'error');
    showToast('Registration failed: ' + getErrorMessage(err), 'error');
  }
}

function handleLogout() {
  Object.keys(state.charts).forEach(key => state.charts[key]?.destroy());
  state.charts = {};
  state.user = null;
  state.accounts = [];
  state.categories = [];
  state.transactions = [];
  state.transfers = [];
  state.budgets = [];
  localStorage.removeItem('pft_user');
  showAuth();
  showSyncStatus('Ready', 'synced');
  showToast('Logged out', 'success');
}

async function initializeUserApp() {
  assertLoggedIn();
  document.getElementById('auth-container').classList.add('hidden');
  document.getElementById('app-container').classList.remove('hidden');
  document.getElementById('user-display-name').textContent = state.user.full_name || state.user.user_id;
  applyTheme(state.user.theme || 'system');

  try {
    await loadAllUserData();
    if (state.categories.length === 0 || state.accounts.length === 0) {
      await ensureDefaultData();
      await loadAllUserData();
    }
    populateFilterDropdowns(true);
    renderDashboard();
  } catch (err) {
    console.error('Initialization failed:', err);
    showToast('Failed to load cloud data: ' + getErrorMessage(err), 'error');
  }
}

async function loadAllUserData() {
  assertLoggedIn();
  const db = requireDb();
  const pid = state.user.id;
  showSyncStatus('Loading...', 'syncing');

  try {
    const results = await Promise.all([
      db.from('accounts').select('*').eq('profile_id', pid).eq('is_active', true).order('created_at', { ascending: true }),
      db.from('categories').select('*').eq('profile_id', pid).order('type', { ascending: true }).order('name', { ascending: true }),
      db.from('transactions').select('*').eq('profile_id', pid).order('transaction_date', { ascending: false }).order('created_at', { ascending: false }),
      db.from('transfers').select('*').eq('profile_id', pid).order('transfer_date', { ascending: false }).order('created_at', { ascending: false }),
      db.from('budgets').select('*').eq('profile_id', pid).order('month', { ascending: false })
    ]);

    const labels = ['accounts', 'categories', 'transactions', 'transfers', 'budgets'];
    results.forEach((result, index) => {
      if (result.error) throw new Error(`${labels[index]}: ${getErrorMessage(result.error)}`);
    });

    state.accounts = results[0].data || [];
    state.categories = results[1].data || [];
    state.transactions = results[2].data || [];
    state.transfers = results[3].data || [];
    state.budgets = results[4].data || [];

    showSyncStatus('Synced', 'synced');
  } catch (err) {
    showSyncStatus('Sync Error', 'error');
    throw err;
  }
}

function calculateAccountBalances() {
  const balances = {};
  state.accounts.forEach(a => { balances[a.id] = numberValue(a.opening_balance); });

  state.transactions.forEach(t => {
    const amount = numberValue(t.amount);
    if (balances[t.account_id] === undefined) return;
    if (t.transaction_type === 'Income') balances[t.account_id] += amount;
    else if (t.transaction_type === 'Expense' || t.transaction_type === 'Other Cost') balances[t.account_id] -= amount;
  });

  state.transfers.forEach(tr => {
    const amount = numberValue(tr.amount);
    if (balances[tr.from_account_id] !== undefined) balances[tr.from_account_id] -= amount;
    if (balances[tr.to_account_id] !== undefined) balances[tr.to_account_id] += amount;
  });

  return balances;
}

function renderView(viewName) {
  switch (viewName) {
    case 'dashboard': renderDashboard(); break;
    case 'transactions': renderTransactions(); break;
    case 'accounts': renderAccounts(); break;
    case 'transfers': renderTransfers(); break;
    case 'summary': renderMonthlySummary(); break;
    case 'reports': renderReports(); break;
    case 'budgets': renderBudgets(); break;
    case 'backup': break;
    case 'settings': renderSettings(); break;
  }
}

function renderDashboard() {
  if (!state.user) return;
  const curr = currency();
  const balances = calculateAccountBalances();
  let totalIncome = 0, totalExpense = 0, totalOther = 0;

  state.transactions.forEach(t => {
    const amount = numberValue(t.amount);
    if (t.transaction_type === 'Income') totalIncome += amount;
    else if (t.transaction_type === 'Expense') totalExpense += amount;
    else if (t.transaction_type === 'Other Cost') totalOther += amount;
  });

  const totalOpening = state.accounts.reduce((sum, a) => sum + numberValue(a.opening_balance), 0);
  const availableBalance = totalOpening + totalIncome - totalExpense - totalOther;

  document.getElementById('dash-total-income').textContent = `${curr}${totalIncome.toFixed(2)}`;
  document.getElementById('dash-total-expense').textContent = `${curr}${totalExpense.toFixed(2)}`;
  document.getElementById('dash-total-other').textContent = `${curr}${totalOther.toFixed(2)}`;
  document.getElementById('dash-available-balance').textContent = `${curr}${availableBalance.toFixed(2)}`;

  let cash = 0, bank = 0, wallet = 0, other = 0;
  state.accounts.forEach(a => {
    const bal = balances[a.id] || 0;
    if (a.account_type === 'Cash') cash += bal;
    else if (a.account_type === 'Bank Account') bank += bal;
    else if (a.account_type === 'Mobile Wallet') wallet += bal;
    else other += bal;
  });
  document.getElementById('dash-cash-balance').textContent = `${curr}${cash.toFixed(2)}`;
  document.getElementById('dash-bank-balance').textContent = `${curr}${bank.toFixed(2)}`;
  document.getElementById('dash-wallet-balance').textContent = `${curr}${wallet.toFixed(2)}`;
  document.getElementById('dash-other-balance').textContent = `${curr}${other.toFixed(2)}`;

  const month = localMonthString();
  const today = localDateString();
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const weekStartDate = new Date(now);
  weekStartDate.setDate(now.getDate() + mondayOffset);
  const weekStart = localDateString(weekStartDate);

  let monthIncome = 0, monthExpense = 0, monthOther = 0;
  let todayIncome = 0, todayExpense = 0;
  let weekIncome = 0, weekExpense = 0;
  let monthCount = 0;

  state.transactions.forEach(t => {
    const amount = numberValue(t.amount);
    const date = t.transaction_date;
    if (date.startsWith(month)) {
      monthCount++;
      if (t.transaction_type === 'Income') monthIncome += amount;
      else if (t.transaction_type === 'Expense') monthExpense += amount;
      else if (t.transaction_type === 'Other Cost') monthOther += amount;
    }
    if (date === today) {
      if (t.transaction_type === 'Income') todayIncome += amount;
      else if (t.transaction_type === 'Expense') todayExpense += amount;
    }
    if (date >= weekStart && date <= today) {
      if (t.transaction_type === 'Income') weekIncome += amount;
      else if (t.transaction_type === 'Expense') weekExpense += amount;
    }
  });

  document.getElementById('dash-month-income').textContent = `${curr}${monthIncome.toFixed(2)}`;
  document.getElementById('dash-month-expense').textContent = `${curr}${monthExpense.toFixed(2)}`;
  document.getElementById('dash-month-other').textContent = `${curr}${monthOther.toFixed(2)}`;
  document.getElementById('dash-month-net').textContent = `${curr}${(monthIncome - monthExpense - monthOther).toFixed(2)}`;
  document.getElementById('dash-month-count').textContent = monthCount;
  document.getElementById('dash-today-income').textContent = `${curr}${todayIncome.toFixed(2)}`;
  document.getElementById('dash-today-expense').textContent = `${curr}${todayExpense.toFixed(2)}`;
  document.getElementById('dash-week-income').textContent = `${curr}${weekIncome.toFixed(2)}`;
  document.getElementById('dash-week-expense').textContent = `${curr}${weekExpense.toFixed(2)}`;
  document.getElementById('dash-total-tx-count').textContent = state.transactions.length;
}

function renderTransactions() {
  if (!state.user) return;
  populateFilterDropdowns();
  const curr = currency();
  const startDate = document.getElementById('filter-start-date').value;
  const endDate = document.getElementById('filter-end-date').value;
  const type = document.getElementById('filter-type').value;
  const accountId = document.getElementById('filter-account').value;
  const categoryId = document.getElementById('filter-category').value;
  const search = document.getElementById('filter-search').value.trim().toLowerCase();

  const filtered = state.transactions.filter(t => {
    if (startDate && t.transaction_date < startDate) return false;
    if (endDate && t.transaction_date > endDate) return false;
    if (type && t.transaction_type !== type) return false;
    if (accountId && t.account_id !== accountId) return false;
    if (categoryId && t.category_id !== categoryId) return false;
    if (search && !(t.description || '').toLowerCase().includes(search)) return false;
    return true;
  });

  let income = 0, expense = 0, other = 0;
  filtered.forEach(t => {
    const amount = numberValue(t.amount);
    if (t.transaction_type === 'Income') income += amount;
    else if (t.transaction_type === 'Expense') expense += amount;
    else other += amount;
  });
  document.getElementById('ft-income').textContent = `${curr}${income.toFixed(2)}`;
  document.getElementById('ft-expense').textContent = `${curr}${expense.toFixed(2)}`;
  document.getElementById('ft-other').textContent = `${curr}${other.toFixed(2)}`;
  document.getElementById('ft-net').textContent = `${curr}${(income - expense - other).toFixed(2)}`;

  const totalPages = Math.max(1, Math.ceil(filtered.length / state.pagination.limit));
  state.pagination.page = Math.min(state.pagination.page, totalPages);
  const start = (state.pagination.page - 1) * state.pagination.limit;
  const rows = filtered.slice(start, start + state.pagination.limit);
  document.getElementById('page-info').textContent = `Page ${state.pagination.page} of ${totalPages}`;

  const tbody = document.getElementById('tx-table-body');
  tbody.innerHTML = '';
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center">No transactions match the selected filters.</td></tr>`;
    return;
  }

  rows.forEach(t => {
    const acc = state.accounts.find(a => a.id === t.account_id);
    const cat = state.categories.find(c => c.id === t.category_id);
    const typeClass = t.transaction_type === 'Income' ? 'text-success' : (t.transaction_type === 'Expense' ? 'text-danger' : 'text-warning');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(t.transaction_date)}</td>
      <td><span class="${typeClass}">${escapeHtml(t.transaction_type)}</span></td>
      <td>${escapeHtml(acc?.account_name || 'Unknown')}</td>
      <td>${escapeHtml(cat?.name || 'Unknown')}</td>
      <td>${escapeHtml(t.description || '-')}</td>
      <td class="${typeClass}"><strong>${curr}${numberValue(t.amount).toFixed(2)}</strong></td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="editTransaction('${t.id}')">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteTransaction('${t.id}')">Delete</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

function renderAccounts() {
  const container = document.getElementById('accounts-grid-container');
  container.innerHTML = '';
  const balances = calculateAccountBalances();
  if (!state.accounts.length) {
    container.innerHTML = `<div class="card" style="grid-column:1/-1;">No financial accounts created yet.</div>`;
    return;
  }

  state.accounts.forEach(acc => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h3>${escapeHtml(acc.account_name)}</h3>
      <p class="card-subtitle">${escapeHtml(acc.account_type)}${acc.provider_name ? ' • ' + escapeHtml(acc.provider_name) : ''}</p>
      <div class="card-amount" style="margin:12px 0;">${currency()}${(balances[acc.id] || 0).toFixed(2)}</div>
      <p class="card-subtitle">Opening: ${currency()}${numberValue(acc.opening_balance).toFixed(2)}</p>
      ${acc.last_four_digits ? `<p class="card-subtitle">Card/Acc ending: **** ${escapeHtml(acc.last_four_digits)}</p>` : ''}
      <div class="btn-group" style="margin-top:15px;">
        <button class="btn btn-sm btn-outline" onclick="editAccount('${acc.id}')">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deactivateAccount('${acc.id}')">Deactivate</button>
      </div>`;
    container.appendChild(card);
  });
}

function renderTransfers() {
  const tbody = document.getElementById('transfer-table-body');
  tbody.innerHTML = '';
  if (!state.transfers.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center">No transfers recorded.</td></tr>`;
    return;
  }
  state.transfers.forEach(tr => {
    const from = state.accounts.find(a => a.id === tr.from_account_id);
    const to = state.accounts.find(a => a.id === tr.to_account_id);
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHtml(tr.transfer_date)}</td>
      <td>${escapeHtml(from?.account_name || 'Unknown')}</td>
      <td>${escapeHtml(to?.account_name || 'Unknown')}</td>
      <td>${escapeHtml(tr.note || '-')}</td>
      <td><strong>${currency()}${numberValue(tr.amount).toFixed(2)}</strong></td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="editTransfer('${tr.id}')">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteTransfer('${tr.id}')">Delete</button>
      </td>`;
    tbody.appendChild(row);
  });
}

function renderMonthlySummary() {
  const selectedMonth = document.getElementById('summary-month-select').value;
  if (!selectedMonth) return;
  const year = selectedMonth.slice(0, 4);
  document.getElementById('summary-year-label').textContent = year;
  let inc = 0, exp = 0, oth = 0;
  state.transactions.forEach(t => {
    if (!t.transaction_date.startsWith(selectedMonth)) return;
    const amount = numberValue(t.amount);
    if (t.transaction_type === 'Income') inc += amount;
    else if (t.transaction_type === 'Expense') exp += amount;
    else oth += amount;
  });
  document.getElementById('sm-income').textContent = `${currency()}${inc.toFixed(2)}`;
  document.getElementById('sm-expense').textContent = `${currency()}${exp.toFixed(2)}`;
  document.getElementById('sm-other').textContent = `${currency()}${oth.toFixed(2)}`;
  document.getElementById('sm-net').textContent = `${currency()}${(inc - exp - oth).toFixed(2)}`;

  const tbody = document.getElementById('yearly-summary-table');
  tbody.innerHTML = '';
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  for (let i = 1; i <= 12; i++) {
    const key = `${year}-${String(i).padStart(2, '0')}`;
    let a = 0, b = 0, c = 0;
    state.transactions.forEach(t => {
      if (!t.transaction_date.startsWith(key)) return;
      const amount = numberValue(t.amount);
      if (t.transaction_type === 'Income') a += amount;
      else if (t.transaction_type === 'Expense') b += amount;
      else c += amount;
    });
    const row = document.createElement('tr');
    row.innerHTML = `<td><strong>${names[i - 1]} ${year}</strong></td>
      <td class="text-success">${currency()}${a.toFixed(2)}</td>
      <td class="text-danger">${currency()}${b.toFixed(2)}</td>
      <td class="text-warning">${currency()}${c.toFixed(2)}</td>
      <td><strong>${currency()}${(a - b - c).toFixed(2)}</strong></td>`;
    tbody.appendChild(row);
  }
}

function shiftSummaryMonth(delta) {
  const el = document.getElementById('summary-month-select');
  if (!el.value) return;
  const [y, m] = el.value.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  el.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  renderMonthlySummary();
}

function renderReports() {
  if (typeof Chart === 'undefined') return;
  const balances = calculateAccountBalances();
  const catTotals = {};
  state.transactions.filter(t => t.transaction_type === 'Expense').forEach(t => {
    const cat = state.categories.find(c => c.id === t.category_id);
    const name = cat?.name || 'Other';
    catTotals[name] = (catTotals[name] || 0) + numberValue(t.amount);
  });

  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const incomes = [], expenses = [], balancesTrend = [];
  months.forEach(m => {
    let income = 0, expense = 0, other = 0;
    state.transactions.forEach(t => {
      if (!t.transaction_date.startsWith(m)) return;
      const amount = numberValue(t.amount);
      if (t.transaction_type === 'Income') income += amount;
      else if (t.transaction_type === 'Expense') expense += amount;
      else other += amount;
    });
    incomes.push(income);
    expenses.push(expense);
    balancesTrend.push(income - expense - other);
  });

  renderChart('chart-inc-exp', 'bar', {
    labels: months,
    datasets: [
      { label: 'Income', data: incomes },
      { label: 'Expense', data: expenses }
    ]
  });
  renderChart('chart-cat-exp', 'doughnut', {
    labels: Object.keys(catTotals),
    datasets: [{ label: 'Expenses', data: Object.values(catTotals) }]
  });
  renderChart('chart-balance-trend', 'line', {
    labels: months,
    datasets: [{ label: 'Net Monthly Balance', data: balancesTrend, tension: 0.25 }]
  });
  renderChart('chart-acc-dist', 'pie', {
    labels: state.accounts.map(a => a.account_name),
    datasets: [{ label: 'Account Balance', data: state.accounts.map(a => balances[a.id] || 0) }]
  });
}

function renderChart(canvasId, type, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (state.charts[canvasId]) state.charts[canvasId].destroy();
  state.charts[canvasId] = new Chart(canvas.getContext('2d'), {
    type,
    data,
    options: { responsive: true, maintainAspectRatio: false }
  });
}

function renderBudgets() {
  const selectedMonth = document.getElementById('budget-month-select').value || localMonthString();
  const container = document.getElementById('budgets-container');
  container.innerHTML = '';
  const monthBudgets = state.budgets.filter(b => b.month === selectedMonth);
  if (!monthBudgets.length) {
    container.innerHTML = `<div class="card" style="grid-column:1/-1;">No budgets set for ${escapeHtml(selectedMonth)}. Click "+ Set Category Budget" to create one.</div>`;
    return;
  }
  monthBudgets.forEach(b => {
    const cat = state.categories.find(c => c.id === b.category_id);
    const actual = state.transactions
      .filter(t => t.category_id === b.category_id && t.transaction_date.startsWith(selectedMonth) && t.transaction_type === 'Expense')
      .reduce((sum, t) => sum + numberValue(t.amount), 0);
    const budgetAmount = numberValue(b.amount);
    const remaining = budgetAmount - actual;
    const percentage = budgetAmount > 0 ? Math.min(Math.round((actual / budgetAmount) * 100), 100) : 0;
    const fillClass = percentage >= 100 ? 'danger' : (percentage >= 80 ? 'warning' : '');
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <h4>${escapeHtml(cat?.name || 'Unknown Category')}</h4>
        <span class="badge ${remaining < 0 ? 'badge-error' : 'badge-synced'}">${percentage}% Used</span>
      </div>
      <div class="progress-bar-bg"><div class="progress-bar-fill ${fillClass}" style="width:${percentage}%;"></div></div>
      <p class="card-subtitle">Budget: ${currency()}${budgetAmount.toFixed(2)} | Actual: ${currency()}${actual.toFixed(2)}</p>
      <p class="card-subtitle" style="margin-top:4px;"><strong>Remaining: ${currency()}${remaining.toFixed(2)}</strong></p>`;
    container.appendChild(card);
  });
}

function openTransactionModal(editId = null) {
  populateAccountSelect('tx-account');
  populateCategorySelect();
  const form = document.getElementById('tx-form');
  form.reset();
  document.getElementById('tx-id').value = '';
  document.getElementById('tx-date').value = localDateString();
  document.getElementById('tx-modal-title').textContent = 'Add Transaction';

  if (editId) {
    const tx = state.transactions.find(t => t.id === editId);
    if (tx) {
      document.getElementById('tx-id').value = tx.id;
      document.getElementById('tx-date').value = tx.transaction_date;
      document.getElementById('tx-type').value = tx.transaction_type;
      populateCategorySelect();
      document.getElementById('tx-account').value = tx.account_id;
      document.getElementById('tx-category').value = tx.category_id;
      document.getElementById('tx-amount').value = tx.amount;
      document.getElementById('tx-desc').value = tx.description || '';
      document.getElementById('tx-modal-title').textContent = 'Edit Transaction';
    }
  }
  document.getElementById('modal-tx').classList.add('active');
}

function openAccountModal(editId = null) {
  const form = document.getElementById('acc-form');
  form.reset();
  document.getElementById('acc-id').value = '';
  document.getElementById('acc-opening').value = '0';
  document.getElementById('acc-modal-title').textContent = 'Add Financial Account';
  if (editId) {
    const acc = state.accounts.find(a => a.id === editId);
    if (acc) {
      document.getElementById('acc-id').value = acc.id;
      document.getElementById('acc-name').value = acc.account_name;
      document.getElementById('acc-type').value = acc.account_type;
      document.getElementById('acc-provider').value = acc.provider_name || '';
      document.getElementById('acc-digits').value = acc.last_four_digits || '';
      document.getElementById('acc-opening').value = acc.opening_balance;
      document.getElementById('acc-notes').value = acc.notes || '';
      document.getElementById('acc-modal-title').textContent = 'Edit Account';
    }
  }
  document.getElementById('modal-account').classList.add('active');
}

function openTransferModal(editId = null) {
  populateAccountSelect('tr-from');
  populateAccountSelect('tr-to');
  const form = document.getElementById('transfer-form');
  form.reset();
  document.getElementById('transfer-id').value = '';
  document.getElementById('tr-date').value = localDateString();
  document.getElementById('transfer-modal-title').textContent = 'New Account Transfer';

  if (editId) {
    const tr = state.transfers.find(t => t.id === editId);
    if (tr) {
      document.getElementById('transfer-id').value = tr.id;
      document.getElementById('tr-date').value = tr.transfer_date;
      document.getElementById('tr-from').value = tr.from_account_id;
      document.getElementById('tr-to').value = tr.to_account_id;
      document.getElementById('tr-amount').value = tr.amount;
      document.getElementById('tr-note').value = tr.note || '';
      document.getElementById('transfer-modal-title').textContent = 'Edit Transfer';
    }
  }
  document.getElementById('modal-transfer').classList.add('active');
}

function openBudgetModal() {
  const select = document.getElementById('budget-form-category');
  select.innerHTML = '';
  state.categories.filter(c => c.type === 'Expense').forEach(c => {
    select.innerHTML += `<option value="${c.id}">${escapeHtml(c.name)}</option>`;
  });
  document.getElementById('budget-form-month').value = document.getElementById('budget-month-select').value || localMonthString();
  document.getElementById('budget-form-amount').value = '';
  document.getElementById('modal-budget').classList.add('active');
}

function closeModal(modalId) {
  document.getElementById(modalId)?.classList.remove('active');
}

async function handleSaveTransaction(e) {
  e.preventDefault();
  assertLoggedIn();
  const db = requireDb();
  const id = document.getElementById('tx-id').value;
  const amount = numberValue(document.getElementById('tx-amount').value);
  const payload = {
    profile_id: state.user.id,
    transaction_date: document.getElementById('tx-date').value,
    transaction_type: document.getElementById('tx-type').value,
    account_id: document.getElementById('tx-account').value,
    category_id: document.getElementById('tx-category').value,
    amount,
    description: document.getElementById('tx-desc').value.trim()
  };

  if (!payload.account_id || !payload.category_id || amount <= 0 || !payload.transaction_date) {
    showToast('Please complete all transaction fields.', 'error');
    return;
  }

  try {
    showSyncStatus('Saving...', 'syncing');
    const result = id
      ? await db.from('transactions').update(payload).eq('id', id).eq('profile_id', state.user.id)
      : await db.from('transactions').insert([payload]);
    if (result.error) throw result.error;
    closeModal('modal-tx');
    await loadAllUserData();
    renderTransactions();
    renderDashboard();
    showToast('Transaction saved', 'success');
  } catch (err) {
    console.error(err);
    showSyncStatus('Save Error', 'error');
    showToast('Save failed: ' + getErrorMessage(err), 'error');
  }
}

async function handleSaveAccount(e) {
  e.preventDefault();
  assertLoggedIn();
  const db = requireDb();
  const id = document.getElementById('acc-id').value;
  const payload = {
    profile_id: state.user.id,
    account_name: document.getElementById('acc-name').value.trim(),
    account_type: document.getElementById('acc-type').value,
    provider_name: document.getElementById('acc-provider').value.trim() || null,
    last_four_digits: document.getElementById('acc-digits').value.trim() || null,
    opening_balance: numberValue(document.getElementById('acc-opening').value),
    notes: document.getElementById('acc-notes').value.trim() || null
  };
  if (!payload.account_name) {
    showToast('Account name is required.', 'error');
    return;
  }
  try {
    showSyncStatus('Saving...', 'syncing');
    const result = id
      ? await db.from('accounts').update(payload).eq('id', id).eq('profile_id', state.user.id)
      : await db.from('accounts').insert([payload]);
    if (result.error) throw result.error;
    closeModal('modal-account');
    await loadAllUserData();
    renderAccounts();
    renderDashboard();
    populateFilterDropdowns(true);
    showToast('Account saved', 'success');
  } catch (err) {
    console.error(err);
    showToast('Save failed: ' + getErrorMessage(err), 'error');
  }
}

async function handleSaveTransfer(e) {
  e.preventDefault();
  assertLoggedIn();
  const db = requireDb();
  const id = document.getElementById('transfer-id').value;
  const fromId = document.getElementById('tr-from').value;
  const toId = document.getElementById('tr-to').value;
  const amount = numberValue(document.getElementById('tr-amount').value);
  if (!fromId || !toId || fromId === toId) {
    showToast('Source and destination accounts must be different.', 'error');
    return;
  }
  if (amount <= 0) {
    showToast('Transfer amount must be greater than zero.', 'error');
    return;
  }

  const balances = calculateAccountBalances();
  let available = balances[fromId] || 0;
  // When editing an existing transfer, temporarily add its old amount back to the source.
  if (id) {
    const old = state.transfers.find(t => t.id === id);
    if (old && old.from_account_id === fromId) available += numberValue(old.amount);
  }
  if (available < amount && !confirm('Warning: Transfer amount exceeds available balance in source account. Proceed anyway?')) return;

  const payload = {
    profile_id: state.user.id,
    from_account_id: fromId,
    to_account_id: toId,
    transfer_date: document.getElementById('tr-date').value,
    amount,
    note: document.getElementById('tr-note').value.trim() || null
  };
  try {
    showSyncStatus('Saving...', 'syncing');
    const result = id
      ? await db.from('transfers').update(payload).eq('id', id).eq('profile_id', state.user.id)
      : await db.from('transfers').insert([payload]);
    if (result.error) throw result.error;
    closeModal('modal-transfer');
    await loadAllUserData();
    renderTransfers();
    renderDashboard();
    showToast('Transfer saved', 'success');
  } catch (err) {
    console.error(err);
    showToast('Transfer failed: ' + getErrorMessage(err), 'error');
  }
}

async function handleSaveBudget(e) {
  e.preventDefault();
  assertLoggedIn();
  const db = requireDb();
  const month = document.getElementById('budget-form-month').value;
  const categoryId = document.getElementById('budget-form-category').value;
  const amount = numberValue(document.getElementById('budget-form-amount').value);
  if (!/^\d{4}-\d{2}$/.test(month) || !categoryId || amount < 0) {
    showToast('Please enter a valid month, category, and amount.', 'error');
    return;
  }
  try {
    showSyncStatus('Saving...', 'syncing');
    const { error } = await db.from('budgets').upsert({
      profile_id: state.user.id,
      month,
      category_id: categoryId,
      amount
    }, { onConflict: 'profile_id,month,category_id' });
    if (error) throw error;
    closeModal('modal-budget');
    document.getElementById('budget-month-select').value = month;
    await loadAllUserData();
    renderBudgets();
    showToast('Budget saved', 'success');
  } catch (err) {
    console.error(err);
    showToast('Budget save failed: ' + getErrorMessage(err), 'error');
  }
}

function editTransaction(id) { openTransactionModal(id); }

async function deleteTransaction(id) {
  if (!confirm('Are you sure you want to delete this transaction?')) return;
  try {
    showSyncStatus('Deleting...', 'syncing');
    const { error } = await requireDb().from('transactions').delete().eq('id', id).eq('profile_id', state.user.id);
    if (error) throw error;
    await loadAllUserData();
    renderTransactions();
    renderDashboard();
    showToast('Transaction deleted', 'success');
  } catch (err) {
    showToast('Delete failed: ' + getErrorMessage(err), 'error');
  }
}

function editAccount(id) { openAccountModal(id); }

async function deactivateAccount(id) {
  if (!confirm('Are you sure you want to deactivate this account?')) return;
  try {
    showSyncStatus('Updating...', 'syncing');
    const { error } = await requireDb().from('accounts').update({ is_active: false }).eq('id', id).eq('profile_id', state.user.id);
    if (error) throw error;
    await loadAllUserData();
    populateFilterDropdowns(true);
    renderAccounts();
    renderDashboard();
    showToast('Account deactivated', 'success');
  } catch (err) {
    showToast('Deactivation failed: ' + getErrorMessage(err), 'error');
  }
}

function editTransfer(id) { openTransferModal(id); }

async function deleteTransfer(id) {
  if (!confirm('Are you sure you want to delete this transfer?')) return;
  try {
    showSyncStatus('Deleting...', 'syncing');
    const { error } = await requireDb().from('transfers').delete().eq('id', id).eq('profile_id', state.user.id);
    if (error) throw error;
    await loadAllUserData();
    renderTransfers();
    renderDashboard();
    showToast('Transfer deleted', 'success');
  } catch (err) {
    showToast('Delete failed: ' + getErrorMessage(err), 'error');
  }
}

function exportData(type) {
  if (!state.user) return;
  if (type === 'json') {
    const backup = {
      version: 2,
      profile: { ...state.user, password_hash: undefined },
      accounts: state.accounts,
      categories: state.categories,
      transactions: state.transactions,
      transfers: state.transfers,
      budgets: state.budgets,
      exported_at: new Date().toISOString()
    };
    downloadFile(`finance_backup_${state.user.user_id}.json`, JSON.stringify(backup, null, 2), 'application/json');
  } else if (type === 'csv') {
    const rows = [['date','type','account','category','description','amount']];
    state.transactions.forEach(t => {
      const acc = state.accounts.find(a => a.id === t.account_id);
      const cat = state.categories.find(c => c.id === t.category_id);
      rows.push([t.transaction_date, t.transaction_type, acc?.account_name || '', cat?.name || '', t.description || '', t.amount]);
    });
    const csv = rows.map(row => row.map(csvEscape).join(',')).join('\n');
    downloadFile(`transactions_${state.user.user_id}.csv`, csv, 'text/csv');
  }
}

function csvEscape(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadFile(filename, text, mimeType) {
  const blob = new Blob([text], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const element = document.createElement('a');
  element.href = url;
  element.download = filename;
  document.body.appendChild(element);
  element.click();
  element.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importData() {
  const input = document.getElementById('import-file-input');
  if (!input.files.length) {
    showToast('Please select a file to import', 'error');
    return;
  }
  if (!confirm('Importing data will merge records into your account. Continue?')) return;

  const file = input.files[0];
  try {
    showSyncStatus('Importing...', 'syncing');
    const text = await file.text();
    if (file.name.toLowerCase().endsWith('.json')) await importJson(text);
    else if (file.name.toLowerCase().endsWith('.csv')) await importCsv(text);
    else throw new Error('Unsupported file type. Use JSON or CSV.');
    input.value = '';
    await loadAllUserData();
    renderDashboard();
    showToast('Import completed successfully', 'success');
  } catch (err) {
    console.error(err);
    showToast('Import error: ' + getErrorMessage(err), 'error');
  }
}

async function importJson(text) {
  const data = JSON.parse(text);
  const db = requireDb();
  const accounts = Array.isArray(data.accounts) ? data.accounts : [];
  const categories = Array.isArray(data.categories) ? data.categories : [];
  const transactions = Array.isArray(data.transactions) ? data.transactions : [];
  const transfers = Array.isArray(data.transfers) ? data.transfers : [];
  const budgets = Array.isArray(data.budgets) ? data.budgets : [];

  // Import categories/accounts first and map old IDs to new IDs.
  const categoryMap = {};
  for (const old of categories) {
    if (!old.name || !old.type) continue;
    const existing = state.categories.find(c => c.name === old.name && c.type === old.type);
    if (existing) {
      categoryMap[old.id] = existing.id;
      continue;
    }
    const { data: inserted, error } = await db.from('categories').insert([{
      profile_id: state.user.id,
      name: old.name,
      type: old.type,
      is_default: Boolean(old.is_default)
    }]).select().single();
    if (error) throw error;
    categoryMap[old.id] = inserted.id;
  }

  const accountMap = {};
  for (const old of accounts) {
    if (!old.account_name || !old.account_type) continue;
    const existing = state.accounts.find(a => a.account_name === old.account_name && a.account_type === old.account_type);
    if (existing) {
      accountMap[old.id] = existing.id;
      continue;
    }
    const { data: inserted, error } = await db.from('accounts').insert([{
      profile_id: state.user.id,
      account_name: old.account_name,
      account_type: old.account_type,
      provider_name: old.provider_name || null,
      last_four_digits: old.last_four_digits || null,
      opening_balance: numberValue(old.opening_balance),
      currency: old.currency || currency(),
      notes: old.notes || null,
      is_active: true
    }]).select().single();
    if (error) throw error;
    accountMap[old.id] = inserted.id;
  }

  if (Object.keys(accountMap).length === 0 && state.accounts.length === 0) {
    await ensureDefaultData();
    await loadAllUserData();
  }

  const fallbackAccount = state.accounts[0]?.id;
  const fallbackCategory = state.categories.find(c => c.type === 'Expense')?.id || state.categories[0]?.id;

  if (transactions.length) {
    const rows = transactions.map(t => ({
      profile_id: state.user.id,
      account_id: accountMap[t.account_id] || fallbackAccount,
      category_id: categoryMap[t.category_id] || fallbackCategory,
      transaction_date: t.transaction_date || localDateString(),
      transaction_type: ['Income','Expense','Other Cost'].includes(t.transaction_type) ? t.transaction_type : 'Expense',
      description: t.description || null,
      amount: numberValue(t.amount)
    })).filter(t => t.account_id && t.category_id && t.amount > 0);
    if (rows.length) {
      const { error } = await db.from('transactions').insert(rows);
      if (error) throw error;
    }
  }

  if (transfers.length) {
    const rows = transfers.map(t => ({
      profile_id: state.user.id,
      from_account_id: accountMap[t.from_account_id] || fallbackAccount,
      to_account_id: accountMap[t.to_account_id] || fallbackAccount,
      transfer_date: t.transfer_date || localDateString(),
      amount: numberValue(t.amount),
      note: t.note || null
    })).filter(t => t.from_account_id && t.to_account_id && t.from_account_id !== t.to_account_id && t.amount > 0);
    if (rows.length) {
      const { error } = await db.from('transfers').insert(rows);
      if (error) throw error;
    }
  }

  if (budgets.length) {
    const rows = budgets.map(b => ({
      profile_id: state.user.id,
      month: b.month,
      category_id: categoryMap[b.category_id] || fallbackCategory,
      amount: numberValue(b.amount)
    })).filter(b => /^\d{4}-\d{2}$/.test(b.month) && b.category_id && b.amount >= 0);
    if (rows.length) {
      const { error } = await db.from('budgets').upsert(rows, { onConflict: 'profile_id,month,category_id' });
      if (error) throw error;
    }
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  row.push(field);
  if (row.some(v => v !== '')) rows.push(row);
  return rows;
}

async function importCsv(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('CSV contains no data rows.');
  const headers = rows[0].map(h => h.trim().toLowerCase());
  const index = name => headers.indexOf(name);
  const db = requireDb();
  const accountId = state.accounts[0]?.id;
  if (!accountId) throw new Error('Create an account before importing CSV transactions.');

  const imported = [];
  for (const row of rows.slice(1)) {
    const date = row[index('date')] || localDateString();
    const type = row[index('type')] || 'Expense';
    const accountName = row[index('account')] || '';
    const categoryName = row[index('category')] || '';
    const description = row[index('description')] || null;
    const amount = numberValue(row[index('amount')]);
    if (!amount || !['Income','Expense','Other Cost'].includes(type)) continue;

    let account = state.accounts.find(a => a.account_name.toLowerCase() === accountName.toLowerCase());
    if (!account) account = state.accounts[0];
    let category = state.categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase() && c.type === type);
    if (!category) category = state.categories.find(c => c.type === type);
    if (!category) continue;
    imported.push({
      profile_id: state.user.id,
      account_id: account.id,
      category_id: category.id,
      transaction_date: date,
      transaction_type: type,
      description,
      amount
    });
  }
  if (imported.length) {
    const { error } = await db.from('transactions').insert(imported);
    if (error) throw error;
  }
}

async function clearAllUserData() {
  if (!confirm('DANGER: Are you sure you want to permanently clear ALL your financial data?')) return;
  if (prompt("Type 'DELETE' to confirm:") !== 'DELETE') return;

  try {
    showSyncStatus('Clearing...', 'syncing');
    const db = requireDb();
    const pid = state.user.id;
    // Delete dependents first because of foreign-key constraints.
    for (const table of ['transactions', 'transfers', 'budgets', 'accounts']) {
      const { error } = await db.from(table).delete().eq('profile_id', pid);
      if (error) throw error;
    }
    const { error: categoryError } = await db.from('categories').delete().eq('profile_id', pid);
    if (categoryError) throw categoryError;
    await ensureDefaultData();
    await loadAllUserData();
    renderDashboard();
    showToast('All financial data erased', 'success');
  } catch (err) {
    showToast('Clear failed: ' + getErrorMessage(err), 'error');
  }
}

function renderSettings() {
  document.getElementById('set-fullname').value = state.user?.full_name || '';
  document.getElementById('set-userid').value = state.user?.user_id || '';
  document.getElementById('set-currency').value = state.user?.currency || CONFIG.DEFAULT_CURRENCY;
  document.getElementById('set-theme').value = state.user?.theme || 'system';
}

async function handleSaveSettings(e) {
  e.preventDefault();
  assertLoggedIn();
  const currencyValue = document.getElementById('set-currency').value.trim() || CONFIG.DEFAULT_CURRENCY;
  const theme = document.getElementById('set-theme').value;
  try {
    showSyncStatus('Saving...', 'syncing');
    const { data, error } = await requireDb().from('profiles')
      .update({ currency: currencyValue, theme, updated_at: new Date().toISOString() })
      .eq('id', state.user.id)
      .select()
      .single();
    if (error) throw error;
    state.user = data;
    localStorage.setItem('pft_user', JSON.stringify(data));
    applyTheme(theme);
    showToast('Settings saved', 'success');
    showSyncStatus('Synced', 'synced');
    renderDashboard();
  } catch (err) {
    showToast('Settings save failed: ' + getErrorMessage(err), 'error');
  }
}

function applyTheme(theme) {
  if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  else if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
  else applySystemTheme();
}

function applySystemTheme() {
  const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}

function populateAccountSelect(elementId) {
  const select = document.getElementById(elementId);
  if (!select) return;
  select.innerHTML = '';
  state.accounts.forEach(a => {
    const option = document.createElement('option');
    option.value = a.id;
    option.textContent = `${a.account_name} (${a.account_type})`;
    select.appendChild(option);
  });
}

function populateCategorySelect() {
  const type = document.getElementById('tx-type').value;
  const select = document.getElementById('tx-category');
  select.innerHTML = '';
  state.categories.filter(c => c.type === type).forEach(c => {
    const option = document.createElement('option');
    option.value = c.id;
    option.textContent = c.name;
    select.appendChild(option);
  });
}

function populateFilterDropdowns(force = false) {
  const accSel = document.getElementById('filter-account');
  const catSel = document.getElementById('filter-category');
  if (force) {
    accSel.innerHTML = '<option value="">All Accounts</option>';
    catSel.innerHTML = '<option value="">All Categories</option>';
  }
  const existingAccounts = new Set([...accSel.options].map(o => o.value));
  state.accounts.forEach(a => {
    if (!existingAccounts.has(a.id)) {
      accSel.insertAdjacentHTML('beforeend', `<option value="${a.id}">${escapeHtml(a.account_name)}</option>`);
    }
  });
  const existingCategories = new Set([...catSel.options].map(o => o.value));
  state.categories.forEach(c => {
    if (!existingCategories.has(c.id)) {
      catSel.insertAdjacentHTML('beforeend', `<option value="${c.id}">${escapeHtml(c.name)} (${escapeHtml(c.type)})</option>`);
    }
  });
}

function showSyncStatus(message, stateClass) {
  const el = document.getElementById('sync-status');
  if (!el) return;
  el.textContent = message;
  el.className = `badge badge-${stateClass}`;
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4500);
}
