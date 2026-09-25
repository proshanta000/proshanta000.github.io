# Personal Finance Tracker

A complete, responsive, mobile-first Personal Finance Tracker built with **HTML5, CSS3, Vanilla JavaScript**, and **Supabase PostgreSQL**. Hosted completely for free on **GitHub Pages**.

---

## 🛠️ Features

1. **User Identification System**: Simple ID/password separation of data per user.
2. **Account Balances Engine**: Complete balance tracking across Cash, Bank Accounts, and Mobile Wallets (e.g., bKash, Nagad).
3. **Transaction Rules**:
   - `Income` = Account Balance + Income
   - `Expense` = Account Balance - Expense
   - `Other Cost` = Account Balance - Other Cost
   - `Transfer` = Source Balance - Transfer, Destination Balance + Transfer (Net total unaffected).
4. **Dashboard**: Summary totals, monthly performance, daily/weekly stats, and account breakdown.
5. **Analytics & Reports**: Visual dynamic charts powered by Chart.js.
6. **Budgets**: Monthly category budget targets with warning progress indicators.
7. **Backup & Import**: JSON full snapshot export/import and CSV export.
8. **Responsive UI**: Built for desktop sidebars and mobile bottom/drawer navigation with Dark Mode support.

---

## 🚀 Setup Instructions

### 1. Supabase Database Setup
1. Create a free account at [Supabase](https://supabase.com).
2. Create a **New Project**.
3. In your Supabase dashboard, navigate to **SQL Editor**.
4. Paste the content of `sql/schema.sql` into the SQL Editor and click **Run**.

### 2. Frontend Configuration
1. Open `config.js`.
2. Retrieve your project credentials from Supabase under **Project Settings > API**:
   - `Project URL` → Paste into `SUPABASE_URL`
   - `anon public` key → Paste into `SUPABASE_ANON_KEY`
3. Save `config.js`.

### 3. Local Testing
- Open `index.html` directly in any modern browser.

---

## 🌐 Deploying to GitHub Pages

1. Initialize a Git repository and commit your files:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
