# Personal Income & Expense Tracker

A lightweight, responsive, completely browser-based Personal Finance Tracker web application built using HTML5, CSS3, and modern vanilla JavaScript.

## Features

- **Zero Backend Required:** Operates 100% locally in your browser.
- **LocalStorage Persistence:** All financial records are automatically saved directly in your browser.
- **Complete Financial Tracking:** Supports **Income**, **Expense**, and **Other Costs** categorization.
- **Real-time Balance Computations:** Keeps track of Opening Balance, On-Hand Cash Balance, and Monthly Summaries dynamically.
- **Filtering & Search:** Easily filter transactions by Date Range, Type, Category, or keyword search.
- **Visual Analytics:** Dynamic interactive charts powered by Chart.js.
- **Data Portability:** Complete Backup & Restore (JSON Export/Import and CSV Export).
- **Theme Switcher:** Integrated Light and Dark mode options.
- **Mobile First & Responsive:** Works seamlessly on smartphones, tablets, and desktop computers.

---

## Hosting on GitHub Pages

1. **Create a GitHub Repository:**
   - Go to [GitHub](https://github.com) and create a new public repository (e.g. `finance-tracker`).

2. **Upload Files:**
   - Upload `index.html`, `style.css`, `script.js`, and `README.md` directly into the repository root.

3. **Enable GitHub Pages:**
   - Go to your repository **Settings**.
   - Click on **Pages** in the left sidebar menu.
   - Under **Build and deployment** -> **Source**, select `Deploy from a branch`.
   - Select `main` (or `master`) branch and folder `/ (root)`.
   - Click **Save**.

4. **Access Application:**
   - After a minute, GitHub Pages will provide a live link: `https://<username>.github.io/<repository-name>/`.

---

## Data Privacy & Security Notice

This application **does not** transmit, store, or share your financial records with any remote servers, analytics tracking platforms, or external databases. All data remains exclusively within your web browser's `localStorage`.

*Note: Clearing browser cookies or cache may delete local data. Make sure to regularly export backups using the built-in **Export JSON Data** button in the "Backup & Settings" tab.*
