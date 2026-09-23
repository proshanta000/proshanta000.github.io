# Personal Finance Tracker

A private, client-side income and expense tracker built with HTML, CSS and vanilla JavaScript.

## Features

- Income, expense and other-cost transactions
- Opening balance and automatic on-hand balance
- Date, type, category and text filtering
- Edit and delete transactions
- Monthly summaries and yearly overview
- Pure-JavaScript charts
- LocalStorage persistence
- JSON and CSV export
- JSON import/restore
- Custom categories
- Dark/light mode
- Print-friendly monthly report
- Responsive mobile/desktop layout
- No backend, login, database, analytics or paid API

## Files

```text
finance-tracker/
├── index.html
├── style.css
├── script.js
└── README.md
```

## Run locally

Open `index.html` in a modern browser.

## GitHub Pages

1. Create a new GitHub repository.
2. Upload `index.html`, `style.css`, `script.js`, and `README.md`.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select your main branch and `/ (root)`.
6. Save. GitHub will provide the Pages URL.

All paths are relative, so no server configuration is required.

## Data storage

Financial data is stored in the browser's `localStorage`. It is not uploaded to a server by this application.

Important: clearing browser/site data can remove localStorage. Use **Backup → Export JSON** regularly and keep the backup somewhere safe.

## Currency

The default currency is Bangladeshi Taka (BDT), displayed as `৳`. Currency formatting is configured in `script.js` in the `money()` function.

## Calculation

Current on-hand balance:

`Opening Balance + Income − Expenses − Other Costs`

The same transaction data is used by the dashboard, filters, monthly summary and reports.
