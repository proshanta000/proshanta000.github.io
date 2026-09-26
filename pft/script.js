/**
 * Personal Finance Tracker - Single Page Application Core Logic
 */

// STATE MANAGEMENT
const state = {
  user: null, // Logged in user profile
  accounts: [],
  categories: [],
  transactions: [],
  transfers: [],
  budgets: [],
  pagination: { page: 1, limit: 10 },
  charts: {}
};

// DEFAULT CATEGORIES
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

// INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  checkSession();
  applySystemTheme();
});

function setupEventListeners() {
  // Auth Form Toggles
  document.getElementById('show-register').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.remove('hidden');
  });

  document.getElementById('show-login').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('login-form').classList.remove('hidden');
  });

  // Auth Submissions
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('register-form').addEventListener('submit', handleRegister);
  document.getElementById('logout-btn').addEventListener('click', handleLogout);

  // Mobile Navigation Toggle
  document.getElementById('menu-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  // Sidebar Views Switching
  document.querySelectorAll('.sidebar .nav-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.sidebar .nav-item').forEach(i => i.classList.remove('active'));
      document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
      
      item.classList.add('active');
      const view = item.dataset.view;
      document.getElementById(`view-${view}`).classList.add('active');
      document.getElementById('sidebar').classList.remove('open');

      renderView(view);
    });
  });

  // Form Submissions
  document.getElementById('tx-form').addEventListener('submit', handleSaveTransaction);
  document.getElementById('acc-form').addEventListener('submit', handleSaveAccount);
  document.getElementById('transfer-form').addEventListener('submit', handleSaveTransfer);
  document.getElementById('budget-form').addEventListener('submit', handleSaveBudget);
  document.getElementById('settings-form').addEventListener('submit', handleSaveSettings);

  // Filters & Event Dynamic Listeners
  document.querySelectorAll('.filter-grid input, .filter-grid select').forEach(el => {
    el.addEventListener('input', () => { state.pagination.page = 1; renderTransactions(); });
  });

  document.getElementById('tx-type').addEventListener('change', populateCategorySelect);
  document.getElementById('prev-page').addEventListener('click', () => { if (state.pagination.page > 1) { state.pagination.page--; renderTransactions(); } });
  document.getElementById('next-page').addEventListener('click', () => { state.pagination.page++; renderTransactions(); });

  // Monthly Summary & Budget Months Setup
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  document.getElementById('summary-month-select').value = currentMonthStr;
  document.getElementById('budget-month-select').value = currentMonthStr;
  
  document.getElementById('summary-month-select').addEventListener('change', renderMonthlySummary);
  document.getElementById('budget-month-select').addEventListener('change', renderBudgets);
  
  document.getElementById('summary-prev-month').addEventListener('click', () => shiftSummaryMonth(-1));
  document.getElementById('summary-next-month').addEventListener('click', () => shiftSummaryMonth(1));
}

// USER SESSION AND AUTHENTICATION
function checkSession() {
  const sessionUser = localStorage.getItem('pft_user');
  if (sessionUser) {
    state.user = JSON.parse(sessionUser);
    initializeUserApp();
  } else {
    document.getElementById('auth-container').classList.remove('hidden');
    document.getElementById('app-container').classList.add('hidden');
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const userId = document.getElementById('login-userid').value.trim();
  const password = document.getElementById('login-password').value.trim();

  try {
    showSyncStatus('Syncing...', 'syncing');
    const { data, error } = await db.from('profiles').select('*').eq('user_id', userId).single();

    if (error || !data || data.password_hash !== btoa(password)) {
      showToast('Invalid User ID or Password', 'error');
      showSyncStatus('Sync Failed', 'error');
      return;
    }

    state.user = data;
    localStorage.setItem('pft_user', JSON.stringify(data));
    showToast('Login successful', 'success');
    initializeUserApp();
  } catch (err) {
    showToast('Login error: ' + err.message, 'error');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const fullName = document.getElementById('reg-fullname').value.trim();
  const userId = document.getElementById('reg-userid').value.trim();
  const password = document.getElementById('reg-password').value.trim();
  const confirmPassword = document.getElementById('reg-confirm-password').value.trim();

  if (password !== confirmPassword) {
    showToast('Passwords do not match', 'error');
    return;
  }

  try {
    showSyncStatus('Syncing...', 'syncing');
    // Check existing
    const { data: existing } = await db.from('profiles').select('id').eq('user_id', userId).maybeSingle();
    if (existing) {
      showToast('User ID already exists', 'error');
      return;
    }

    // Insert user
    const { data: newUser, error } = await db.from('profiles').insert([{
      user_id: userId,
      full_name: fullName,
      password_hash: btoa(password) // Basic client-side hash representation
    }]).select().single();

    if (error) throw error;

    // Seed default categories
    const categoriesToSeed = DEFAULT_CATEGORIES.map(c => ({ ...c, profile_id: newUser.id, is_default: true }));
    await db.from('categories').insert(categoriesToSeed);

    // Seed default primary cash account
    await db.from('accounts').insert([{
      profile_id: newUser.id,
      account_name: 'Cash',
      account_type: 'Cash',
      opening_balance: 0
    }]);

    state.user = newUser;
    localStorage.setItem('pft_user', JSON.stringify(newUser));
    showToast('Account registered successfully', 'success');
    initializeUserApp();
  } catch (err) {
    showToast('Registration failed: ' + err.message, 'error');
  }
}

function handleLogout() {
  localStorage.removeItem('pft_user');
  state.user = null;
  document.getElementById('app-container').classList.add('hidden');
  document.getElementById('auth-container').classList.remove('hidden');
  showToast('Logged out', 'success');
}

// INITIALIZE DASHBOARD & DATA SYNC
async function initializeUserApp() {
  document.getElementById('auth-container').classList.add('hidden');
  document.getElementById('app-container').classList.remove('hidden');
  document.getElementById('user-display-name').textContent = state.user.full_name;

  applyTheme(state.user.theme || 'system');
  await loadAllUserData();
  renderDashboard();
}

async function loadAllUserData() {
  showSyncStatus('Loading...', 'syncing');
  try {
    const pid = state.user.id;

    const [accRes, catRes, txRes, trRes, bgRes] = await Promise.all([
      db.from('accounts').select('*').eq('profile_id', pid).eq('is_active', true),
      db.from('categories').select('*').eq('profile_id', pid),
      db.from('transactions').select('*').eq('profile_id', pid).order('transaction_date', { ascending: false }),
      db.from('transfers').select('*').eq('profile_id', pid).order('transfer_date', { ascending: false }),
      db.from('budgets').select('*').eq('profile_id', pid)
    ]);

    state.accounts = accRes.data || [];
    state.categories = catRes.data || [];
    state.transactions = txRes.data || [];
    state.transfers = trRes.data || [];
    state.budgets = bgRes.data || [];

    showSyncStatus('Synced', 'synced');
  } catch (err) {
    showToast('Failed to load cloud data: ' + err.message, 'error');
    showSyncStatus('Sync Error', 'error');
  }
}

// CALCULATION LOGIC & BALANCES
function calculateAccountBalances() {
  const balances = {};
  state.accounts.forEach(a => {
    balances[a.id] = parseFloat(a.opening_balance) || 0;
  });

  // Apply Transactions
  state.transactions.forEach(t => {
    const amt = parseFloat(t.amount) || 0;
    if (balances[t.account_id] !== undefined) {
      if (t.transaction_type === 'Income') balances[t.account_id] += amt;
      else if (t.transaction_type === 'Expense' || t.transaction_type === 'Other Cost') balances[t.account_id] -= amt;
    }
  });

  // Apply Transfers (Moves money without affecting totals)
  state.transfers.forEach(tr => {
    const amt = parseFloat(tr.amount) || 0;
    if (balances[tr.from_account_id] !== undefined) balances[tr.from_account_id] -= amt;
    if (balances[tr.to_account_id] !== undefined) balances[tr.to_account_id] += amt;
  });

  return balances;
}

// VIEWS RENDERERS
function renderView(viewName) {
  if (viewName === 'dashboard') renderDashboard();
  else if (viewName === 'transactions') renderTransactions();
  else if (viewName === 'accounts') renderAccounts();
  else if (viewName === 'transfers') renderTransfers();
  else if (viewName === 'summary') renderMonthlySummary();
  else if (viewName === 'reports') renderReports();
  else if (viewName === 'budgets') renderBudgets();
  else if (viewName === 'settings') renderSettings();
}

function renderDashboard() {
  const curr = state.user.currency || CONFIG.DEFAULT_CURRENCY;
  const balances = calculateAccountBalances();

  let totalIncome = 0, totalExpense = 0, totalOther = 0;
  state.transactions.forEach(t => {
    const amt = parseFloat(t.amount) || 0;
    if (t.transaction_type === 'Income') totalIncome += amt;
    else if (t.transaction_type === 'Expense') totalExpense += amt;
    else if (t.transaction_type === 'Other Cost') totalOther += amt;
  });

  const totalOpening = state.accounts.reduce((sum, a) => sum + (parseFloat(a.opening_balance) || 0), 0);
  const availableBalance = totalOpening + totalIncome - totalExpense - totalOther;

  document.getElementById('dash-total-income').textContent = `${curr}${totalIncome.toFixed(2)}`;
  document.getElementById('dash-total-expense').textContent = `${curr}${totalExpense.toFixed(2)}`;
  document.getElementById('dash-total-other').textContent = `${curr}${totalOther.toFixed(2)}`;
  document.getElementById('dash-available-balance').textContent = `${curr}${availableBalance.toFixed(2)}`;

  // Account Type Breakdown
  let cashBal = 0, bankBal = 0, walletBal = 0, otherBal = 0;
  state.accounts.forEach(a => {
    const bal = balances[a.id] || 0;
    if (a.account_type === 'Cash') cashBal += bal;
    else if (a.account_type === 'Bank Account') bankBal += bal;
    else if (a.account_type === 'Mobile Wallet') walletBal += bal;
    else otherBal += bal;
  });

  document.getElementById('dash-cash-balance').textContent = `${curr}${cashBal.toFixed(2)}`;
  document.getElementById('dash-bank-balance').textContent = `${curr}${bankBal.toFixed(2)}`;
  document.getElementById('dash-wallet-balance').textContent = `${curr}${walletBal.toFixed(2)}`;
  document.getElementById('dash-other-balance').textContent = `${curr}${otherBal.toFixed(2)}`;

  // Period Analysis
  const now = new Date();
  const currentMonthStr = now.toISOString().slice(0, 7);
  const todayStr = now.toISOString().slice(0, 10);
  
  // Start of Week (Sunday)
  const firstDayOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
  const weekStartStr = firstDayOfWeek.toISOString().slice(0, 10);

  let mInc = 0, mExp = 0, mOth = 0, mCount = 0;
  let dInc = 0, dExp = 0, wInc = 0, wExp = 0;

  state.transactions.forEach(t => {
    const amt = parseFloat(t.amount) || 0;
    const d = t.transaction_date;

    if (d.startsWith(currentMonthStr)) {
      mCount++;
      if (t.transaction_type === 'Income') mInc += amt;
      else if (t.transaction_type === 'Expense') mExp += amt;
      else if (t.transaction_type === 'Other Cost') mOth += amt;
    }

    if (d === todayStr) {
      if (t.transaction_type === 'Income') dInc += amt;
      else if (t.transaction_type === 'Expense') dExp += amt;
    }

    if (d >= weekStartStr) {
      if (t.transaction_type === 'Income') wInc += amt;
      else if (t.transaction_type === 'Expense') wExp += amt;
    }
  });

  document.getElementById('dash-month-income').textContent = `${curr}${mInc.toFixed(2)}`;
  document.getElementById('dash-month-expense').textContent = `${curr}${mExp.toFixed(2)}`;
  document.getElementById('dash-month-other').textContent = `${curr}${mOth.toFixed(2)}`;
  document.getElementById('dash-month-net').textContent = `${curr}${(mInc - mExp - mOth).toFixed(2)}`;
  document.getElementById('dash-month-count').textContent = mCount;

  document.getElementById('dash-today-income').textContent = `${curr}${dInc.toFixed(2)}`;
  document.getElementById('dash-today-expense').textContent = `${curr}${dExp.toFixed(2)}`;
  document.getElementById('dash-week-income').textContent = `${curr}${wInc.toFixed(2)}`;
  document.getElementById('dash-week-expense').textContent = `${curr}${wExp.toFixed(2)}`;
  document.getElementById('dash-total-tx-count').textContent = state.transactions.length;
}

function renderTransactions() {
  populateFilterDropdowns();
  const curr = state.user.currency || CONFIG.DEFAULT_CURRENCY;

  const startDate = document.getElementById('filter-start-date').value;
  const endDate = document.getElementById('filter-end-date').value;
  const type = document.getElementById('filter-type').value;
  const accountId = document.getElementById('filter-account').value;
  const categoryId = document.getElementById('filter-category').value;
  const search = document.getElementById('filter-search').value.toLowerCase().trim();

  let filtered = state.transactions.filter(t => {
    if (startDate && t.transaction_date < startDate) return false;
    if (endDate && t.transaction_date > endDate) return false;
    if (type && t.transaction_type !== type) return false;
    if (accountId && t.account_id !== accountId) return false;
    if (categoryId && t.category_id !== categoryId) return false;
    if (search && !(t.description || '').toLowerCase().includes(search)) return false;
    return true;
  });

  // Calculate Filtered Totals
  let fInc = 0, fExp = 0, fOth = 0;
  filtered.forEach(t => {
    const amt = parseFloat(t.amount) || 0;
    if (t.transaction_type === 'Income') fInc += amt;
    else if (t.transaction_type === 'Expense') fExp += amt;
    else if (t.transaction_type === 'Other Cost') fOth += amt;
  });

  document.getElementById('ft-income').textContent = `${curr}${fInc.toFixed(2)}`;
  document.getElementById('ft-expense').textContent = `${curr}${fExp.toFixed(2)}`;
  document.getElementById('ft-other').textContent = `${curr}${fOth.toFixed(2)}`;
  document.getElementById('ft-net').textContent = `${curr}${(fInc - fExp - fOth).toFixed(2)}`;

  // Pagination
  const totalPages = Math.ceil(filtered.length / state.pagination.limit) || 1;
  if (state.pagination.page > totalPages) state.pagination.page = totalPages;

  const startIdx = (state.pagination.page - 1) * state.pagination.limit;
  const paginated = filtered.slice(startIdx, startIdx + state.pagination.limit);

  document.getElementById('page-info').textContent = `Page ${state.pagination.page} of ${totalPages}`;

  const tbody = document.getElementById('tx-table-body');
  tbody.innerHTML = '';

  if (paginated.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center">No transactions match the selected filters.</td></tr>`;
    return;
  }

  paginated.forEach(t => {
    const acc = state.accounts.find(a => a.id === t.account_id);
    const cat = state.categories.find(c => c.id === t.category_id);
    const tr = document.createElement('tr');
    
    let typeClass = t.transaction_type === 'Income' ? 'text-success' : (t.transaction_type === 'Expense' ? 'text-danger' : 'text-warning');

    tr.innerHTML = `
      <td>${t.transaction_date}</td>
      <td><span class="${typeClass}">${t.transaction_type}</span></td>
      <td>${acc ? acc.account_name : 'Unknown'}</td>
      <td>${cat ? cat.name : 'Unknown'}</td>
      <td>${t.description || '-'}</td>
      <td class="${typeClass}"><strong>${curr}${parseFloat(t.amount).toFixed(2)}</strong></td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="editTransaction('${t.id}')">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteTransaction('${t.id}')">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderAccounts() {
  const container = document.getElementById('accounts-grid-container');
  container.innerHTML = '';
  const curr = state.user.currency || CONFIG.DEFAULT_CURRENCY;
  const balances = calculateAccountBalances();

  if (state.accounts.length === 0) {
    container.innerHTML = `<div class="card" style="grid-column: 1/-1;">No financial accounts created yet.</div>`;
    return;
  }

  state.accounts.forEach(acc => {
    const bal = balances[acc.id] || 0;
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h3>${acc.account_name}</h3>
      <p class="card-subtitle">${acc.account_type} ${acc.provider_name ? '• ' + acc.provider_name : ''}</p>
      <div class="card-amount" style="margin: 12px 0;">${curr}${bal.toFixed(2)}</div>
      <p class="card-subtitle">Opening: ${curr}${parseFloat(acc.opening_balance).toFixed(2)}</p>
      ${acc.last_four_digits ? `<p class="card-subtitle">Card/Acc ending: **** ${acc.last_four_digits}</p>` : ''}
      <div class="btn-group" style="margin-top: 15px;">
        <button class="btn btn-sm btn-outline" onclick="editAccount('${acc.id}')">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deactivateAccount('${acc.id}')">Deactivate</button>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderTransfers() {
  const tbody = document.getElementById('transfer-table-body');
  tbody.innerHTML = '';
  const curr = state.user.currency || CONFIG.DEFAULT_CURRENCY;

  if (state.transfers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center">No transfers recorded.</td></tr>`;
    return;
  }

  state.transfers.forEach(tr => {
    const fromAcc = state.accounts.find(a => a.id === tr.from_account_id);
    const toAcc = state.accounts.find(a => a.id === tr.to_account_id);
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${tr.transfer_date}</td>
      <td>${fromAcc ? fromAcc.account_name : 'Unknown'}</td>
      <td>${toAcc ? toAcc.account_name : 'Unknown'}</td>
      <td>${tr.note || '-'}</td>
      <td><strong>${curr}${parseFloat(tr.amount).toFixed(2)}</strong></td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="editTransfer('${tr.id}')">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteTransfer('${tr.id}')">Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function renderMonthlySummary() {
  const selectedMonth = document.getElementById('summary-month-select').value;
  if (!selectedMonth) return;

  const year = selectedMonth.split('-')[0];
  document.getElementById('summary-year-label').textContent = year;
  const curr = state.user.currency || CONFIG.DEFAULT_CURRENCY;

  let mInc = 0, mExp = 0, mOth = 0;
  state.transactions.forEach(t => {
    if (t.transaction_date.startsWith(selectedMonth)) {
      const amt = parseFloat(t.amount) || 0;
      if (t.transaction_type === 'Income') mInc += amt;
      else if (t.transaction_type === 'Expense') mExp += amt;
      else if (t.transaction_type === 'Other Cost') mOth += amt;
    }
  });

  document.getElementById('sm-income').textContent = `${curr}${mInc.toFixed(2)}`;
  document.getElementById('sm-expense').textContent = `${curr}${mExp.toFixed(2)}`;
  document.getElementById('sm-other').textContent = `${curr}${mOth.toFixed(2)}`;
  document.getElementById('sm-net').textContent = `${curr}${(mInc - mExp - mOth).toFixed(2)}`;

  // Render Yearly Breakdown Matrix
  const tbody = document.getElementById('yearly-summary-table');
  tbody.innerHTML = '';

  const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  months.forEach((m, idx) => {
    const key = `${year}-${m}`;
    let inc = 0, exp = 0, oth = 0;

    state.transactions.forEach(t => {
      if (t.transaction_date.startsWith(key)) {
        const amt = parseFloat(t.amount) || 0;
        if (t.transaction_type === 'Income') inc += amt;
        else if (t.transaction_type === 'Expense') exp += amt;
        else if (t.transaction_type === 'Other Cost') oth += amt;
      }
    });

    const net = inc - exp - oth;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${monthNames[idx]} ${year}</strong></td>
      <td class="text-success">${curr}${inc.toFixed(2)}</td>
      <td class="text-danger">${curr}${exp.toFixed(2)}</td>
      <td class="text-warning">${curr}${oth.toFixed(2)}</td>
      <td><strong>${curr}${net.toFixed(2)}</strong></td>
    `;
    tbody.appendChild(tr);
  });
}

function shiftSummaryMonth(delta) {
  const el = document.getElementById('summary-month-select');
  if (!el.value) return;
  const [y, m] = el.value.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  el.value = d.toISOString().slice(0, 7);
  renderMonthlySummary();
}

// CHARTS & REPORTS INTEGRATION
function renderReports() {
  if (typeof Chart === 'undefined') {
    console.warn("Chart.js failed to load. Reports charts bypassed safely.");
    return;
  }

  const curr = state.user.currency || CONFIG.DEFAULT_CURRENCY;

  // 1. Expense by Category
  const catTotals = {};
  state.transactions.filter(t => t.transaction_type === 'Expense').forEach(t => {
    const cat = state.categories.find(c => c.id === t.category_id);
    const catName = cat ? cat.name : 'Other';
    catTotals[catName] = (catTotals[catName] || 0) + parseFloat(t.amount);
  });

  renderChart('chart-cat-exp', 'doughnut', {
    labels: Object.keys(catTotals),
    datasets: [{
      data: Object.values(catTotals),
      backgroundColor: ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#06b6d4', '#6366f1', '#a855f7']
    }]
  });

  // 2. Account Balance Distribution
  const balances = calculateAccountBalances();
  const accLabels = [];
  const accData = [];
  state.accounts.forEach(a => {
    accLabels.push(a.account_name);
    accData.push(balances[a.id] || 0);
  });

  renderChart('chart-acc-dist', 'pie', {
    labels: accLabels,
    datasets: [{
      data: accData,
      backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']
    }]
  });

  // 3. Monthly Income vs Expense (Last 6 months)
  const last6Months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    last6Months.push(d.toISOString().slice(0, 7));
  }

  const incData = [], expData = [];
  last6Months.forEach(m => {
    let inc = 0, exp = 0;
    state.transactions.forEach(t => {
      if (t.transaction_date.startsWith(m)) {
        if (t.transaction_type === 'Income') inc += parseFloat(t.amount);
        else if (t.transaction_type === 'Expense') exp += parseFloat(t.amount);
      }
    });
    incData.push(inc);
    expData.push(exp);
  });

  renderChart('chart-inc-exp', 'bar', {
    labels: last6Months,
    datasets: [
      { label: 'Income', data: incData, backgroundColor: '#16a34a' },
      { label: 'Expense', data: expData, backgroundColor: '#dc2626' }
    ]
  });
}

function renderChart(canvasId, type, data) {
  if (state.charts[canvasId]) state.charts[canvasId].destroy();
  const ctx = document.getElementById(canvasId).getContext('2d');
  state.charts[canvasId] = new Chart(ctx, {
    type: type,
    data: data,
    options: { responsive: true, maintainAspectRatio: false }
  });
}

function renderBudgets() {
  const selectedMonth = document.getElementById('budget-month-select').value;
  const container = document.getElementById('budgets-container');
  container.innerHTML = '';
  const curr = state.user.currency || CONFIG.DEFAULT_CURRENCY;

  const monthBudgets = state.budgets.filter(b => b.month === selectedMonth);

  if (monthBudgets.length === 0) {
    container.innerHTML = `<div class="card" style="grid-column:1/-1;">No budgets set for ${selectedMonth}. Click "+ Set Category Budget" to create one.</div>`;
    return;
  }

  monthBudgets.forEach(b => {
    const cat = state.categories.find(c => c.id === b.category_id);
    const catName = cat ? cat.name : 'Unknown Category';

    // Calculate actual spending for this category in this month
    let actual = 0;
    state.transactions.forEach(t => {
      if (t.category_id === b.category_id && t.transaction_date.startsWith(selectedMonth) && t.transaction_type === 'Expense') {
        actual += parseFloat(t.amount);
      }
    });

    const budgetAmount = parseFloat(b.amount);
    const remaining = budgetAmount - actual;
    const percentage = budgetAmount > 0 ? Math.min(Math.round((actual / budgetAmount) * 100), 100) : 0;

    let fillClass = '';
    if (percentage >= 100) fillClass = 'danger';
    else if (percentage >= 80) fillClass = 'warning';

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div style="display:flex; justify-between; align-items:center;">
        <h4>${catName}</h4>
        <span class="badge ${remaining < 0 ? 'badge-error' : 'badge-synced'}">${percentage}% Used</span>
      </div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill ${fillClass}" style="width: ${percentage}%;"></div>
      </div>
      <p class="card-subtitle">Budget: ${curr}${budgetAmount.toFixed(2)} | Actual: ${curr}${actual.toFixed(2)}</p>
      <p class="card-subtitle" style="margin-top:4px;"><strong>Remaining: ${curr}${remaining.toFixed(2)}</strong></p>
    `;
    container.appendChild(card);
  });
}

// MODAL OPENERS & HANDLERS
function openTransactionModal(editId = null) {
  populateAccountSelect('tx-account');
  populateCategorySelect();
  document.getElementById('tx-date').value = new Date().toISOString().slice(0, 10);

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
  } else {
    document.getElementById('tx-id').value = '';
    document.getElementById('tx-form').reset();
    document.getElementById('tx-modal-title').textContent = 'Add Transaction';
    document.getElementById('tx-date').value = new Date().toISOString().slice(0, 10);
  }

  document.getElementById('modal-tx').classList.add('active');
}

function openAccountModal(editId = null) {
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
  } else {
    document.getElementById('acc-id').value = '';
    document.getElementById('acc-form').reset();
    document.getElementById('acc-modal-title').textContent = 'Add Financial Account';
  }
  document.getElementById('modal-account').classList.add('active');
}

function openTransferModal(editId = null) {
  populateAccountSelect('tr-from');
  populateAccountSelect('tr-to');
  document.getElementById('tr-date').value = new Date().toISOString().slice(0, 10);

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
  } else {
    document.getElementById('transfer-id').value = '';
    document.getElementById('transfer-form').reset();
    document.getElementById('transfer-modal-title').textContent = 'New Account Transfer';
    document.getElementById('tr-date').value = new Date().toISOString().slice(0, 10);
  }

  document.getElementById('modal-transfer').classList.add('active');
}

function openBudgetModal() {
  const select = document.getElementById('budget-form-category');
  select.innerHTML = '';
  state.categories.filter(c => c.type === 'Expense').forEach(c => {
    select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
  });
  document.getElementById('budget-form-month').value = new Date().toISOString().slice(0, 7);
  document.getElementById('modal-budget').classList.add('active');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

// PERSISTENCE ACTIONS (AUTO-SAVE TO SUPABASE)
async function handleSaveTransaction(e) {
  e.preventDefault();
  const id = document.getElementById('tx-id').value;
  const payload = {
    profile_id: state.user.id,
    transaction_date: document.getElementById('tx-date').value,
    transaction_type: document.getElementById('tx-type').value,
    account_id: document.getElementById('tx-account').value,
    category_id: document.getElementById('tx-category').value,
    amount: parseFloat(document.getElementById('tx-amount').value),
    description: document.getElementById('tx-desc').value.trim()
  };

  try {
    showSyncStatus('Saving...', 'syncing');
    if (id) {
      const { error } = await db.from('transactions').update(payload).eq('id', id);
      if (error) throw error;
    } else {
      const { error } = await db.from('transactions').insert([payload]);
      if (error) throw error;
    }
    closeModal('modal-tx');
    await loadAllUserData();
    renderTransactions();
    renderDashboard();
    showToast('Transaction saved', 'success');
  } catch (err) {
    showToast('Save failed: ' + err.message, 'error');
  }
}

async function handleSaveAccount(e) {
  e.preventDefault();
  const id = document.getElementById('acc-id').value;
  const payload = {
    profile_id: state.user.id,
    account_name: document.getElementById('acc-name').value.trim(),
    account_type: document.getElementById('acc-type').value,
    provider_name: document.getElementById('acc-provider').value.trim(),
    last_four_digits: document.getElementById('acc-digits').value.trim() || null,
    opening_balance: parseFloat(document.getElementById('acc-opening').value) || 0,
    notes: document.getElementById('acc-notes').value.trim()
  };

  try {
    showSyncStatus('Saving...', 'syncing');
    if (id) {
      const { error } = await db.from('accounts').update(payload).eq('id', id);
      if (error) throw error;
    } else {
      const { error } = await db.from('accounts').insert([payload]);
      if (error) throw error;
    }
    closeModal('modal-account');
    await loadAllUserData();
    renderAccounts();
    renderDashboard();
    showToast('Account saved', 'success');
  } catch (err) {
    showToast('Save failed: ' + err.message, 'error');
  }
}

async function handleSaveTransfer(e) {
  e.preventDefault();
  const id = document.getElementById('transfer-id').value;
  const fromId = document.getElementById('tr-from').value;
  const toId = document.getElementById('tr-to').value;
  const amount = parseFloat(document.getElementById('tr-amount').value);

  if (fromId === toId) {
    showToast('Source and destination accounts must be different', 'error');
    return;
  }

  // Prevent Transfer above available balance
  const balances = calculateAccountBalances();
  if (balances[fromId] < amount) {
    if (!confirm('Warning: Transfer amount exceeds available balance in source account. Proceed anyway?')) {
      return;
    }
  }

  const payload = {
    profile_id: state.user.id,
    from_account_id: fromId,
    to_account_id: toId,
    transfer_date: document.getElementById('tr-date').value,
    amount: amount,
    note: document.getElementById('tr-note').value.trim()
  };

  try {
    showSyncStatus('Saving...', 'syncing');
    if (id) {
      const { error } = await db.from('transfers').update(payload).eq('id', id);
      if (error) throw error;
    } else {
      const { error } = await db.from('transfers').insert([payload]);
      if (error) throw error;
    }
    closeModal('modal-transfer');
    await loadAllUserData();
    renderTransfers();
    renderDashboard();
    showToast('Transfer completed', 'success');
  } catch (err) {
    showToast('Transfer failed: ' + err.message, 'error');
  }
}

async function handleSaveBudget(e) {
  e.preventDefault();
  const payload = {
    profile_id: state.user.id,
    month: document.getElementById('budget-form-month').value,
    category_id: document.getElementById('budget-form-category').value,
    amount: parseFloat(document.getElementById('budget-form-amount').value)
  };

  try {
    showSyncStatus('Saving...', 'syncing');
    const { error } = await db.from('budgets').upsert(payload, { onConflict: 'profile_id,month,category_id' });
    if (error) throw error;
    closeModal('modal-budget');
    await loadAllUserData();
    renderBudgets();
    showToast('Budget saved', 'success');
  } catch (err) {
    showToast('Budget save failed: ' + err.message, 'error');
  }
}

// EDIT / DELETE HELPERS
function editTransaction(id) { openTransactionModal(id); }
async function deleteTransaction(id) {
  if (!confirm('Are you sure you want to delete this transaction?')) return;
  try {
    showSyncStatus('Deleting...', 'syncing');
    await db.from('transactions').delete().eq('id', id);
    await loadAllUserData();
    renderTransactions();
    renderDashboard();
    showToast('Transaction deleted', 'success');
  } catch (err) {
    showToast('Delete failed: ' + err.message, 'error');
  }
}

function editAccount(id) { openAccountModal(id); }
async function deactivateAccount(id) {
  if (!confirm('Are you sure you want to deactivate this account?')) return;
  try {
    showSyncStatus('Updating...', 'syncing');
    await db.from('accounts').update({ is_active: false }).eq('id', id);
    await loadAllUserData();
    renderAccounts();
    renderDashboard();
    showToast('Account deactivated', 'success');
  } catch (err) {
    showToast('Deactivation failed: ' + err.message, 'error');
  }
}

function editTransfer(id) { openTransferModal(id); }
async function deleteTransfer(id) {
  if (!confirm('Are you sure you want to delete this transfer?')) return;
  try {
    showSyncStatus('Deleting...', 'syncing');
    await db.from('transfers').delete().eq('id', id);
    await loadAllUserData();
    renderTransfers();
    renderDashboard();
    showToast('Transfer deleted', 'success');
  } catch (err) {
    showToast('Delete failed: ' + err.message, 'error');
  }
}

// BACKUP & EXPORT
function exportData(type) {
  if (type === 'json') {
    const fullBackup = {
      profile: state.user,
      accounts: state.accounts,
      categories: state.categories,
      transactions: state.transactions,
      transfers: state.transfers,
      budgets: state.budgets,
      exported_at: new Date().toISOString()
    };
    downloadFile(`finance_backup_${state.user.user_id}.json`, JSON.stringify(fullBackup, null, 2), 'application/json');
  } else if (type === 'csv') {
    let csv = 'date,type,account,category,description,amount\n';
    state.transactions.forEach(t => {
      const acc = state.accounts.find(a => a.id === t.account_id);
      const cat = state.categories.find(c => c.id === t.category_id);
      csv += `"${t.transaction_date}","${t.transaction_type}","${acc ? acc.account_name : ''}","${cat ? cat.name : ''}","${t.description || ''}",${t.amount}\n`;
    });
    downloadFile(`transactions_${state.user.user_id}.csv`, csv, 'text/csv');
  }
}

function downloadFile(filename, text, mimeType) {
  const element = document.createElement('a');
  element.setAttribute('href', `data:${mimeType};charset=utf-8,` + encodeURIComponent(text));
  element.setAttribute('download', filename);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

async function importData() {
  const fileInput = document.getElementById('import-file-input');
  if (!fileInput.files.length) {
    showToast('Please select a file to import', 'error');
    return;
  }

  if (!confirm('Importing data will merge records into your account. Continue?')) return;

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = async (e) => {
    try {
      showSyncStatus('Importing...', 'syncing');
      if (file.name.endsWith('.json')) {
        const data = JSON.parse(e.target.result);
        if (data.transactions && Array.isArray(data.transactions)) {
          const txsToInsert = data.transactions.map(t => ({
            profile_id: state.user.id,
            account_id: state.accounts[0].id, // Safely fallback to primary account
            category_id: state.categories[0].id,
            transaction_date: t.transaction_date || new Date().toISOString().slice(0,10),
            transaction_type: t.transaction_type || 'Expense',
            description: t.description || 'Imported Transaction',
            amount: parseFloat(t.amount) || 0
          }));
          await db.from('transactions').insert(txsToInsert);
        }
      }
      showToast('Import completed successfully', 'success');
      await loadAllUserData();
      renderDashboard();
    } catch (err) {
      showToast('Import error: ' + err.message, 'error');
    }
  };

  reader.readAsText(file);
}

async function clearAllUserData() {
  if (confirm("DANGER: Are you sure you want to permanently clear ALL your data? This action CANNOT be undone.")) {
    const doubleCheck = prompt("Type 'DELETE' to confirm:");
    if (doubleCheck === 'DELETE') {
      try {
        showSyncStatus('Clearing...', 'syncing');
        const pid = state.user.id;
        await db.from('transactions').delete().eq('profile_id', pid);
        await db.from('transfers').delete().eq('profile_id', pid);
        await db.from('budgets').delete().eq('profile_id', pid);
        await db.from('accounts').delete().eq('profile_id', pid);
        showToast('All data erased', 'success');
        await loadAllUserData();
        renderDashboard();
      } catch (err) {
        showToast('Clear failed: ' + err.message, 'error');
      }
    }
  }
}

// SETTINGS & THEME
function renderSettings() {
  document.getElementById('set-fullname').value = state.user.full_name;
  document.getElementById('set-userid').value = state.user.user_id;
  document.getElementById('set-currency').value = state.user.currency || CONFIG.DEFAULT_CURRENCY;
  document.getElementById('set-theme').value = state.user.theme || 'system';
}

async function handleSaveSettings(e) {
  e.preventDefault();
  const currency = document.getElementById('set-currency').value.trim();
  const theme = document.getElementById('set-theme').value;

  try {
    showSyncStatus('Saving...', 'syncing');
    const { error } = await db.from('profiles').update({ currency, theme }).eq('id', state.user.id);
    if (error) throw error;

    state.user.currency = currency;
    state.user.theme = theme;
    localStorage.setItem('pft_user', JSON.stringify(state.user));

    applyTheme(theme);
    showToast('Settings saved', 'success');
    showSyncStatus('Synced', 'synced');
  } catch (err) {
    showToast('Settings save failed: ' + err.message, 'error');
  }
}

function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    applySystemTheme();
  }
}

function applySystemTheme() {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
  }
}

// DROPDOWN POPULATORS & HELPERS
function populateAccountSelect(elementId) {
  const select = document.getElementById(elementId);
  select.innerHTML = '';
  state.accounts.forEach(a => {
    select.innerHTML += `<option value="${a.id}">${a.account_name} (${a.account_type})</option>`;
  });
}

function populateCategorySelect() {
  const type = document.getElementById('tx-type').value;
  const select = document.getElementById('tx-category');
  select.innerHTML = '';
  state.categories.filter(c => c.type === type).forEach(c => {
    select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
  });
}

function populateFilterDropdowns() {
  const accSel = document.getElementById('filter-account');
  const catSel = document.getElementById('filter-category');

  if (accSel.options.length <= 1) {
    state.accounts.forEach(a => { accSel.innerHTML += `<option value="${a.id}">${a.account_name}</option>`; });
  }
  if (catSel.options.length <= 1) {
    state.categories.forEach(c => { catSel.innerHTML += `<option value="${c.id}">${c.name} (${c.type})</option>`; });
  }
}

function showSyncStatus(msg, stateClass) {
  const el = document.getElementById('sync-status');
  el.textContent = msg;
  el.className = `badge badge-${stateClass}`;
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}