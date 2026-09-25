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
        <button class="btn btn-sm btn-danger" onclick="deleteTransfer('${tr.id}')
