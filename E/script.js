/**
 * Personal Finance Tracker Engine
 * Vanilla JavaScript (ES6+) with localStorage persistence.
 */

// Global Configuration
const CONFIG = {
    currencySymbol: '৳',
    storageKeys: {
        transactions: 'pft_transactions',
        categories: 'pft_categories',
        openingBalance: 'pft_opening_balance',
        theme: 'pft_theme'
    }
};

// Application State
let state = {
    transactions: [],
    categories: {
        income: ['Salary', 'Freelance', 'Business', 'Other Income'],
        expense: ['Food', 'Transport', 'Rent', 'Shopping', 'Bills', 'Mobile/Internet', 'Medical', 'Education', 'Other'],
        other: ['Investments', 'Loans/Debts', 'Savings', 'Emergency', 'Miscellaneous']
    },
    openingBalance: 0,
    editingId: null,
    charts: {}
};

// --- DOM elements initialization & Bootstrap ---
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    loadDataFromStorage();
    setupTheme();
    setupNavigation();
    setupEventListeners();
    
    // Set default date picker to today
    document.getElementById('transDate').valueToDate = new Date();
    document.getElementById('transDate').value = new Date().toISOString().split('T')[0];
    
    // Set default month pickers
    const today = new Date();
    const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('monthlyMonthPicker').value = currentMonthStr;

    populateCategoryDropdowns();
    populateYearDropdown();
    
    refreshAllViews();
}

// --- LocalStorage Layer ---
function loadDataFromStorage() {
    try {
        const storedTrans = localStorage.getItem(CONFIG.storageKeys.transactions);
        if (storedTrans) state.transactions = JSON.parse(storedTrans);

        const storedCats = localStorage.getItem(CONFIG.storageKeys.categories);
        if (storedCats) state.categories = JSON.parse(storedCats);

        const storedBalance = localStorage.getItem(CONFIG.storageKeys.openingBalance);
        if (storedBalance) state.openingBalance = parseFloat(storedBalance) || 0;

        document.getElementById('openingBalanceInput').value = state.openingBalance.toFixed(2);
    } catch (e) {
        console.error('Failed to load data from localStorage', e);
    }
}

function saveDataToStorage() {
    try {
        localStorage.setItem(CONFIG.storageKeys.transactions, JSON.stringify(state.transactions));
        localStorage.setItem(CONFIG.storageKeys.categories, JSON.stringify(state.categories));
        localStorage.setItem(CONFIG.storageKeys.openingBalance, state.openingBalance.toString());
        showStatusToast('✓ Data saved locally');
    } catch (e) {
        console.error('Failed to save data to localStorage', e);
        showStatusToast('⚠️ Storage save failed!');
    }
}

function showStatusToast(message) {
    const toast = document.getElementById('statusToast');
    const toastMsg = document.getElementById('statusToastMessage');
    toastMsg.textContent = message;
    toast.classList.remove('hidden');
    
    clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(() => {
        toast.classList.add('hidden');
    }, 2500);
}

// --- Navigation & Theme handling ---
function setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            
            navButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(tabId).classList.add('active');

            if (tabId === 'reports') {
                renderCharts();
            }
        });
    });
}

function setupTheme() {
    const themeBtn = document.getElementById('themeToggleBtn');
    const savedTheme = localStorage.getItem(CONFIG.storageKeys.theme) || 'light';
    
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeBtn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';

    themeBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem(CONFIG.storageKeys.theme, newTheme);
        themeBtn.textContent = newTheme === 'dark' ? '☀️' : '🌙';
        renderCharts(); // Redraw chart colors if theme changed
    });
}

// --- UI Dynamic Rendering & Form Population ---
function populateCategoryDropdowns() {
    const transType = document.getElementById('transType').value;
    const catSelect = document.getElementById('transCategory');
    const filterCatSelect = document.getElementById('filterCategory');

    // Trans Category
    catSelect.innerHTML = '';
    const currentCats = state.categories[transType] || [];
    currentCats.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        catSelect.appendChild(option);
    });

    // Filter Category
    const currentFilterVal = filterCatSelect.value;
    filterCatSelect.innerHTML = '<option value="all">All Categories</option>';
    
    let allCategoriesCombined = new Set();
    Object.values(state.categories).forEach(arr => arr.forEach(c => allCategoriesCombined.add(c)));
    
    allCategoriesCombined.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        filterCatSelect.appendChild(option);
    });
    filterCatSelect.value = currentFilterVal || 'all';

    renderCategoryManagementList();
}

function renderCategoryManagementList() {
    const container = document.getElementById('categoryListDisplay');
    container.innerHTML = '';

    ['income', 'expense', 'other'].forEach(type => {
        state.categories[type].forEach(cat => {
            const tag = document.createElement('div');
            tag.className = 'cat-tag';
            tag.innerHTML = `
                <span>[${type.toUpperCase()}] ${escapeHtml(cat)}</span>
                <span class="remove-cat-btn" onclick="removeCustomCategory('${type}', '${escapeHtml(cat)}')">&times;</span>
            `;
            container.appendChild(tag);
        });
    });
}

function populateYearDropdown() {
    const yearPicker = document.getElementById('yearlyYearPicker');
    const currentYear = new Date().getFullYear();
    yearPicker.innerHTML = '';

    for (let y = currentYear - 5; y <= currentYear + 5; y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        if (y === currentYear) opt.selected = true;
        yearPicker.appendChild(opt);
    }
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    // Dynamic category updates on type selection
    document.getElementById('transType').addEventListener('change', populateCategoryDropdowns);

    // Save Opening Balance
    document.getElementById('saveOpeningBalanceBtn').addEventListener('click', () => {
        const val = parseFloat(document.getElementById('openingBalanceInput').value) || 0;
        state.openingBalance = val;
        saveDataToStorage();
        refreshAllViews();
    });

    // Submit Transaction (Add / Edit)
    document.getElementById('transactionForm').addEventListener('submit', handleTransactionSubmit);

    // Cancel Edit Mode
    document.getElementById('cancelEditBtn').addEventListener('click', resetTransactionForm);

    // Transaction Filters
    ['filterStartDate', 'filterEndDate', 'filterType', 'filterCategory', 'filterSearch'].forEach(id => {
        document.getElementById(id).addEventListener('input', renderTransactionsTable);
    });

    document.getElementById('resetFiltersBtn').addEventListener('click', () => {
        document.getElementById('filterStartDate').value = '';
        document.getElementById('filterEndDate').value = '';
        document.getElementById('filterType').value = 'all';
        document.getElementById('filterCategory').value = 'all';
        document.getElementById('filterSearch').value = '';
        renderTransactionsTable();
    });

    // Monthly navigation controls
    document.getElementById('monthlyMonthPicker').addEventListener('change', renderMonthlySummary);
    document.getElementById('prevMonthBtn').addEventListener('click', () => changeMonth(-1));
    document.getElementById('nextMonthBtn').addEventListener('click', () => changeMonth(1));
    document.getElementById('yearlyYearPicker').addEventListener('change', renderYearlyOverview);

    // Backup & Restore
    document.getElementById('exportJsonBtn').addEventListener('click', exportJsonData);
    document.getElementById('exportCsvBtn').addEventListener('click', exportCsvData);
    document.getElementById('importJsonBtn').addEventListener('click', importJsonData);
    document.getElementById('clearDataBtn').addEventListener('click', clearAllData);

    // Category Management Form
    document.getElementById('addCategoryForm').addEventListener('submit', handleAddCustomCategory);
}

// --- Transaction Handlers ---
function handleTransactionSubmit(e) {
    e.preventDefault();

    const date = document.getElementById('transDate').value;
    const type = document.getElementById('transType').value;
    const category = document.getElementById('transCategory').value;
    const amount = parseFloat(document.getElementById('transAmount').value);
    const description = document.getElementById('transDescription').value.trim();

    if (!date || isNaN(amount) || amount <= 0) {
        alert('Please fill out a valid date and positive amount.');
        return;
    }

    if (state.editingId) {
        // Edit existing transaction
        const index = state.transactions.findIndex(t => t.id === state.editingId);
        if (index !== -1) {
            state.transactions[index] = { id: state.editingId, date, type, category, amount, description };
        }
    } else {
        // Create new transaction
        const newTransaction = {
            id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            date,
            type,
            category,
            amount,
            description
        };
        state.transactions.push(newTransaction);
    }

    saveDataToStorage();
    resetTransactionForm();
    refreshAllViews();
}

function editTransaction(id) {
    const tx = state.transactions.find(t => t.id === id);
    if (!tx) return;

    state.editingId = tx.id;
    document.getElementById('transId').value = tx.id;
    document.getElementById('transDate').value = tx.date;
    document.getElementById('transType').value = tx.type;
    
    populateCategoryDropdowns();
    document.getElementById('transCategory').value = tx.category;
    document.getElementById('transAmount').value = tx.amount;
    document.getElementById('transDescription').value = tx.description;

    document.getElementById('formTitle').textContent = 'Edit Transaction';
    document.getElementById('submitTransBtn').textContent = 'Update Transaction';
    document.getElementById('cancelEditBtn').classList.remove('hidden');

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteTransaction(id) {
    if (confirm('Are you sure you want to permanently delete this transaction?')) {
        state.transactions = state.transactions.filter(t => t.id !== id);
        saveDataToStorage();
        refreshAllViews();
    }
}

function resetTransactionForm() {
    state.editingId = null;
    document.getElementById('transId').value = '';
    document.getElementById('transactionForm').reset();
    document.getElementById('transDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('formTitle').textContent = 'Add New Transaction';
    document.getElementById('submitTransBtn').textContent = 'Add Transaction';
    document.getElementById('cancelEditBtn').classList.add('hidden');
    populateCategoryDropdowns();
}

// --- Main Data Rendering Engine ---
function refreshAllViews() {
    renderDashboard();
    renderTransactionsTable();
    renderMonthlySummary();
    renderYearlyOverview();
    if (document.getElementById('reports').classList.contains('active')) {
        renderCharts();
    }
}

function renderDashboard() {
    let totalIncome = 0;
    let totalExpenses = 0;
    let totalOther = 0;

    const today = new Date();
    const currentYearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    let monthIncome = 0;
    let monthExpenses = 0;
    let monthOther = 0;

    state.transactions.forEach(t => {
        const amt = Number(t.amount) || 0;
        if (t.type === 'income') totalIncome += amt;
        else if (t.type === 'expense') totalExpenses += amt;
        else if (t.type === 'other') totalOther += amt;

        if (t.date.startsWith(currentYearMonth)) {
            if (t.type === 'income') monthIncome += amt;
            else if (t.type === 'expense') monthExpenses += amt;
            else if (t.type === 'other') monthOther += amt;
        }
    });

    const onHandBalance = state.openingBalance + totalIncome - totalExpenses - totalOther;
    const monthBalance = monthIncome - monthExpenses - monthOther;

    document.getElementById('dashOnHandBalance').textContent = formatCurrency(onHandBalance);
    document.getElementById('dashTotalIncome').textContent = formatCurrency(totalIncome);
    document.getElementById('dashTotalExpenses').textContent = formatCurrency(totalExpenses);
    document.getElementById('dashTotalOther').textContent = formatCurrency(totalOther);

    document.getElementById('dashMonthIncome').textContent = formatCurrency(monthIncome);
    document.getElementById('dashMonthExpense').textContent = formatCurrency(monthExpenses);
    document.getElementById('dashMonthOther').textContent = formatCurrency(monthOther);
    document.getElementById('dashMonthBalance').textContent = formatCurrency(monthBalance);

    document.getElementById('dashTotalTransactionsCount').textContent = state.transactions.length;
}

function renderTransactionsTable() {
    const tbody = document.getElementById('transactionTableBody');
    const emptyMsg = document.getElementById('emptyTableMessage');

    const startDate = document.getElementById('filterStartDate').value;
    const endDate = document.getElementById('filterEndDate').value;
    const type = document.getElementById('filterType').value;
    const category = document.getElementById('filterCategory').value;
    const search = document.getElementById('filterSearch').value.toLowerCase().trim();

    // Sorting latest first
    const sorted = [...state.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

    const filtered = sorted.filter(t => {
        if (startDate && t.date < startDate) return false;
        if (endDate && t.date > endDate) return false;
        if (type !== 'all' && t.type !== type) return false;
        if (category !== 'all' && t.category !== category) return false;
        if (search && !t.description.toLowerCase().includes(search) && !t.category.toLowerCase().includes(search)) return false;
        return true;
    });

    tbody.innerHTML = '';

    if (filtered.length === 0) {
        emptyMsg.classList.remove('hidden');
    } else {
        emptyMsg.classList.add('hidden');
    }

    let sumInc = 0, sumExp = 0, sumOth = 0;

    filtered.forEach(t => {
        const amt = Number(t.amount) || 0;
        if (t.type === 'income') sumInc += amt;
        else if (t.type === 'expense') sumExp += amt;
        else if (t.type === 'other') sumOth += amt;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${escapeHtml(t.date)}</td>
            <td><span class="badge ${t.type}">${t.type}</span></td>
            <td>${escapeHtml(t.category)}</td>
            <td>${escapeHtml(t.description || '-')}</td>
            <td><strong>${formatCurrency(t.amount)}</strong></td>
            <td>
                <div class="action-btns">
                    <button class="btn btn-secondary btn-sm" onclick="editTransaction('${t.id}')">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteTransaction('${t.id}')">Delete</button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });

    // Filter Summary Update
    document.getElementById('filterSumIncome').textContent = formatCurrency(sumInc);
    document.getElementById('filterSumExpense').textContent = formatCurrency(sumExp);
    document.getElementById('filterSumOther').textContent = formatCurrency(sumOth);
    document.getElementById('filterSumBalance').textContent = formatCurrency(sumInc - sumExp - sumOth);
}

function renderMonthlySummary() {
    const selectedMonth = document.getElementById('monthlyMonthPicker').value; // YYYY-MM
    if (!selectedMonth) return;

    let inc = 0, exp = 0, oth = 0;

    state.transactions.forEach(t => {
        if (t.date.startsWith(selectedMonth)) {
            const amt = Number(t.amount) || 0;
            if (t.type === 'income') inc += amt;
            else if (t.type === 'expense') exp += amt;
            else if (t.type === 'other') oth += amt;
        }
    });

    const net = inc - exp - oth;

    document.getElementById('mValIncome').textContent = formatCurrency(inc);
    document.getElementById('mValExpense').textContent = formatCurrency(exp);
    document.getElementById('mValOther').textContent = formatCurrency(oth);
    document.getElementById('mValBalance').textContent = formatCurrency(net);
}

function changeMonth(offset) {
    const picker = document.getElementById('monthlyMonthPicker');
    if (!picker.value) return;

    const [year, month] = picker.value.split('-').map(Number);
    const date = new Date(year, month - 1 + offset, 1);
    const newYearStr = date.getFullYear();
    const newMonthStr = String(date.getMonth() + 1).padStart(2, '0');

    picker.value = `${newYearStr}-${newMonthStr}`;
    renderMonthlySummary();
}

function renderYearlyOverview() {
    const year = document.getElementById('yearlyYearPicker').value;
    const tbody = document.getElementById('yearlyTableBody');
    tbody.innerHTML = '';

    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    months.forEach((mName, index) => {
        const monthStr = `${year}-${String(index + 1).padStart(2, '0')}`;
        let inc = 0, exp = 0, oth = 0;

        state.transactions.forEach(t => {
            if (t.date.startsWith(monthStr)) {
                const amt = Number(t.amount) || 0;
                if (t.type === 'income') inc += amt;
                else if (t.type === 'expense') exp += amt;
                else if (t.type === 'other') oth += amt;
            }
        });

        const bal = inc - exp - oth;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${mName}</strong></td>
            <td class="text-success">${formatCurrency(inc)}</td>
            <td class="text-danger">${formatCurrency(exp)}</td>
            <td class="text-warning">${formatCurrency(oth)}</td>
            <td><strong>${formatCurrency(bal)}</strong></td>
        `;
        tbody.appendChild(row);
    });
}

// --- Charting Engine with Safe CDN Handling ---
function renderCharts() {
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js library is not available.');
        return;
    }

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();

    let incData = new Array(12).fill(0);
    let expData = new Array(12).fill(0);
    let othData = new Array(12).fill(0);
    let balData = new Array(12).fill(0);

    let expenseCategoryMap = {};

    state.transactions.forEach(t => {
        const d = new Date(t.date);
        if (d.getFullYear() === currentYear) {
            const m = d.getMonth();
            const amt = Number(t.amount) || 0;

            if (t.type === 'income') incData[m] += amt;
            else if (t.type === 'expense') {
                expData[m] += amt;
                expenseCategoryMap[t.category] = (expenseCategoryMap[t.category] || 0) + amt;
            } else if (t.type === 'other') othData[m] += amt;
        }
    });

    for (let i = 0; i < 12; i++) {
        balData[i] = incData[i] - expData[i] - othData[i];
    }

    // Chart 1: Income vs Expense vs Other
    const ctx1 = document.getElementById('chartIncomeExpense').getContext('2d');
    if (state.charts.incExp) state.charts.incExp.destroy();
    state.charts.incExp = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [
                { label: 'Income', data: incData, backgroundColor: '#10b981' },
                { label: 'Expenses', data: expData, backgroundColor: '#ef4444' },
                { label: 'Other Costs', data: othData, backgroundColor: '#f59e0b' }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // Chart 2: Expenses by Category
    const ctx2 = document.getElementById('chartExpenseCategory').getContext('2d');
    if (state.charts.expCat) state.charts.expCat.destroy();
    state.charts.expCat = new Chart(ctx2, {
        type: 'doughnut',
        data: {
            labels: Object.keys(expenseCategoryMap).length ? Object.keys(expenseCategoryMap) : ['No Data'],
            datasets: [{
                data: Object.keys(expenseCategoryMap).length ? Object.values(expenseCategoryMap) : [1],
                backgroundColor: ['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#64748b']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // Chart 3: Net Balance Trend
    const ctx3 = document.getElementById('chartBalanceTrend').getContext('2d');
    if (state.charts.balTrend) state.charts.balTrend.destroy();
    state.charts.balTrend = new Chart(ctx3, {
        type: 'line',
        data: {
            labels: months,
            datasets: [{
                label: 'Monthly Net Balance',
                data: balData,
                borderColor: '#0284c7',
                backgroundColor: 'rgba(2, 132, 199, 0.1)',
                fill: true,
                tension: 0.3
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

// --- Data Export & Import / Backup ---
function exportJsonData() {
    const exportObject = {
        app: 'PersonalFinanceTracker',
        version: '1.0',
        exportDate: new Date().toISOString(),
        openingBalance: state.openingBalance,
        categories: state.categories,
        transactions: state.transactions
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObject, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `finance_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

function exportCsvData() {
    if (state.transactions.length === 0) {
        alert('No data to export.');
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,ID,Date,Type,Category,Description,Amount\n";
    state.transactions.forEach(t => {
        const row = [
            t.id,
            t.date,
            t.type,
            `"${t.category.replace(/"/g, '""')}"`,
            `"${(t.description || '').replace(/"/g, '""')}"`,
            t.amount
        ].join(",");
        csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `financial_transactions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
}

function importJsonData() {
    const fileInput = document.getElementById('importJsonFile');
    const file = fileInput.files[0];

    if (!file) {
        alert('Please choose a valid JSON backup file first.');
        return;
    }

    if (!confirm('Importing data will merge/overwrite existing records. Are you sure you want to continue?')) {
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data && Array.isArray(data.transactions)) {
                state.transactions = data.transactions;
                if (data.categories) state.categories = data.categories;
                if (typeof data.openingBalance === 'number') state.openingBalance = data.openingBalance;

                saveDataToStorage();
                populateCategoryDropdowns();
                refreshAllViews();
                alert('Data successfully imported!');
                fileInput.value = '';
            } else {
                alert('Invalid JSON structure. Missing transaction records.');
            }
        } catch (err) {
            alert('Error parsing JSON file. Please make sure it is a valid file.');
            console.error(err);
        }
    };
    reader.readAsText(file);
}

function clearAllData() {
    if (confirm('CRITICAL WARNING: This will permanently delete ALL transactions, custom categories, and balances. This cannot be undone!\n\nAre you sure?')) {
        localStorage.removeItem(CONFIG.storageKeys.transactions);
        localStorage.removeItem(CONFIG.storageKeys.categories);
        localStorage.removeItem(CONFIG.storageKeys.openingBalance);

        state.transactions = [];
        state.openingBalance = 0;
        state.categories = {
            income: ['Salary', 'Freelance', 'Business', 'Other Income'],
            expense: ['Food', 'Transport', 'Rent', 'Shopping', 'Bills', 'Mobile/Internet', 'Medical', 'Education', 'Other'],
            other: ['Investments', 'Loans/Debts', 'Savings', 'Emergency', 'Miscellaneous']
        };

        populateCategoryDropdowns();
        refreshAllViews();
        alert('All local application data has been wiped.');
    }
}

// --- Category Customization ---
function handleAddCustomCategory(e) {
    e.preventDefault();
    const type = document.getElementById('newCatType').value;
    const name = document.getElementById('newCatName').value.trim();

    if (!name) return;

    if (!state.categories[type].includes(name)) {
        state.categories[type].push(name);
        saveDataToStorage();
        populateCategoryDropdowns();
        document.getElementById('newCatName').value = '';
    } else {
        alert('Category already exists!');
    }
}

function removeCustomCategory(type, catName) {
    if (confirm(`Remove custom category "${catName}"? Existing transactions will retain their names.`)) {
        state.categories[type] = state.categories[type].filter(c => c !== catName);
        saveDataToStorage();
        populateCategoryDropdowns();
    }
}

// --- Utilities ---
function formatCurrency(amount) {
    const val = Number(amount) || 0;
    return CONFIG.currencySymbol + val.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
