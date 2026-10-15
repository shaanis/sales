# Shanis — ECHONIX Daily Sales Report

A React + Vite frontend for filling a daily sales report, logging TA/food expenses, previewing a WhatsApp-ready report, and saving reports in the current browser.

## Requirements
- Node.js 18 or newer
- npm

## Run locally
```bash
npm install
npm run dev
```
Open the local URL printed by Vite (usually http://localhost:5173).

## Build for deployment
```bash
npm run build
npm run preview
```
Deploy the generated `dist` folder to Netlify or Vercel.

## Included
- Daily report form with today's update, MTD, and tomorrow's top 3 focus
- Live WhatsApp-format preview
- Copy report and download as `.txt`
- TA, route, food and other expense tracker
- MTD kilometres and expense totals
- Save/open/delete reports
- Local browser storage (no backend, no login)

## Notes
- MTD PO/site survey/revisit/document figures are manually entered because the app cannot infer the company's official monthly totals. Expenses and kilometres are totalled automatically from entries logged in the app.
- Data is stored only in the browser on this device. Clearing browser data can remove it. This starter app does not sync between devices or send reports automatically.
