import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardCopy, Download, FileText, Plus, Trash2, CalendarDays, Car, Wallet, CheckCircle2, RotateCcw } from 'lucide-react';

const today = () => new Date().toISOString().slice(0,10);
const blankReport = () => ({
  date: today(), executive: 'Shanis', area: '', newLeads: '', siteSurvey: '', proposalSent: '',
  activityType: '', revisits: '', poCount: '', documentsCollected: '', dealerVisits: '',
  paymentCollected: '', totalPoCount: '', mtdPoCount: '', mtdClosure: '', mtdSiteSurvey: '',
  mtdRevisits: '', docsProcess: '', docsBank: '', collectionPending: '', mtdDealerVisits: '',
  focus1: '', focus2: '', focus3: ''
});
const blankExpense = () => ({ date: today(), type: 'TA', km: '', route: '', amount: '', note: '' });
const getSaved = (key, fallback) => { try { const v=localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
const money = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function App() {
  const [report,setReport] = useState(() => getSaved('shanis-report-draft', blankReport()));
  const [expenses,setExpenses] = useState(() => getSaved('shanis-expenses', []));
  const [history,setHistory] = useState(() => getSaved('shanis-report-history', []));
  const [tab,setTab] = useState('report');
  const [copied,setCopied] = useState(false);
  const [expense,setExpense] = useState(blankExpense());
  useEffect(()=>localStorage.setItem('shanis-report-draft',JSON.stringify(report)),[report]);
  useEffect(()=>localStorage.setItem('shanis-expenses',JSON.stringify(expenses)),[expenses]);
  useEffect(()=>localStorage.setItem('shanis-report-history',JSON.stringify(history)),[history]);
  const set = (key,value) => setReport(p=>({...p,[key]:value}));
  const month = report.date.slice(0,7);
  const monthReports = history.filter(x=>x.date?.slice(0,7)===month);
  const monthExpenses = expenses.filter(x=>x.date?.slice(0,7)===month);
  const totalKm = monthExpenses.reduce((s,x)=>s+Number(x.km||0),0);
  const totalExpense = monthExpenses.reduce((s,x)=>s+Number(x.amount||0),0);
  const reportText = useMemo(() => {
    const r=report;
    return `*DAILY SALES REPORT*\n*Date:* ${r.date ? r.date.split('-').reverse().join('/') : ''}\n*Executive:* ${r.executive}\n\n*TODAY'S UPDATE*\n• AREA: ${r.area || '-'}\n• NEW LEADS COLLECTED: ${r.newLeads || '-'}\n• SITE SURVEY DONE: ${r.siteSurvey || '-'}\n• PROPOSAL SENT: ${r.proposalSent || '-'}\n• ACTIVITY TYPE: ${r.activityType || '-'}\n• RE VISITS: ${r.revisits || '-'}\n• PO COUNT: ${r.poCount || '-'}\n• DOCUMENTS COLLECTED: ${r.documentsCollected || '-'}\n• DEALER/B2B VISITS: ${r.dealerVisits || '-'}\n• PAYMENT COLLECTED: ${r.paymentCollected || '-'}\n\n*TA / EXPENSE UPDATE*\n• TRAVEL: ${expenses.filter(x=>x.date===r.date&&x.type==='TA').map(x=>`${x.km||0} km${x.route?' - '+x.route:''}`).join('; ') || '-'}\n• FOOD / OTHER EXPENSES: ${expenses.filter(x=>x.date===r.date&&x.type!=='TA').map(x=>`${x.type}: ${x.note||'-'} ${x.amount?money(x.amount):''}`).join('; ') || '-'}\n• TODAY'S TA KM: ${expenses.filter(x=>x.date===r.date).reduce((s,x)=>s+Number(x.km||0),0)} km\n\n*MTD UPDATE*\n• TOTAL PO COUNT: ${r.totalPoCount || '-'}\n• MTD PO COUNT: ${r.mtdPoCount || '-'}\n• MTD CLOSURE: ${r.mtdClosure || '-'}\n• MTD SITE SURVEY: ${r.mtdSiteSurvey || '-'}\n• MTD REVISITS: ${r.mtdRevisits || '-'}\n• DOCUMENTS IN PROCESS: ${r.docsProcess || '-'}\n• DOCUMENTS IN BANK: ${r.docsBank || '-'}\n• COLLECTION PENDING: ${r.collectionPending || '-'}\n• DEALER / B2B VISITS: ${r.mtdDealerVisits || '-'}\n• MTD TA KM: ${totalKm} km\n• MTD EXPENSES LOGGED: ${money(totalExpense)}\n\n*TOMORROW'S TOP 3 FOCUS*\n1. ${r.focus1 || '-'}\n2. ${r.focus2 || '-'}\n3. ${r.focus3 || '-'}`;
  },[report,expenses,totalKm,totalExpense]);
  const fields = [
    ['area','Area / locations worked'],['newLeads','New leads collected'],['siteSurvey','Site survey done'],['proposalSent','Proposal sent'],
    ['activityType','Activity type'],['revisits','Re-visits'],['poCount','PO count'],['documentsCollected','Documents collected'],
    ['dealerVisits','Dealer / B2B visits'],['paymentCollected','Payment collected']
  ];
  const mtdFields = [
    ['totalPoCount','Total PO count'],['mtdPoCount','MTD PO count'],['mtdClosure','MTD closure'],['mtdSiteSurvey','MTD site survey'],
    ['mtdRevisits','MTD revisits'],['docsProcess','Documents in process'],['docsBank','Documents in bank'],
    ['collectionPending','Collection pending'],['mtdDealerVisits','Dealer / B2B visits']
  ];
  const addExpense = e => {
    e.preventDefault();
    setExpenses(p=>[...p,{...expense,id:Date.now()}]);
    setExpense({...blankExpense(),date:report.date});
  };
  const saveReport = () => {
    setHistory(p=>[...p.filter(x=>x.date!==report.date),{...report,savedAt:new Date().toISOString()}].sort((a,b)=>a.date.localeCompare(b.date)));
    alert('Report saved in this browser.');
  };
  const loadHistory = x => { setReport(x); setTab('report'); };
  const copyReport = async () => {
    try { await navigator.clipboard.writeText(reportText); setCopied(true); setTimeout(()=>setCopied(false),1800); }
    catch { const area=document.querySelector('#report-output'); area?.select(); document.execCommand('copy'); setCopied(true); }
  };
  const downloadReport = () => {
    const blob=new Blob([reportText],{type:'text/plain;charset=utf-8'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`sales-report-${report.date}.txt`; a.click(); URL.revokeObjectURL(url);
  };
  const Input = ({id,label,placeholder='Enter details',type='text'}) => <label className="field"><span>{label}</span><input type={type} value={report[id] ?? ''} placeholder={placeholder} onChange={e=>set(id,e.target.value)} /></label>;
  const Textarea = ({id,label,placeholder='Enter details'}) => <label className="field"><span>{label}</span><textarea rows="2" value={report[id] ?? ''} placeholder={placeholder} onChange={e=>set(id,e.target.value)} /></label>;
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-icon">ES</div><div><strong>ECHONIX</strong><small>Sales workspace</small></div></div>
      <div className="nav-label">WORKSPACE</div>
      <button className={tab==='report'?'nav active':'nav'} onClick={()=>setTab('report')}><FileText size={18}/> Daily report</button>
      <button className={tab==='expenses'?'nav active':'nav'} onClick={()=>setTab('expenses')}><Car size={18}/> TA & expenses</button>
      <button className={tab==='history'?'nav active':'nav'} onClick={()=>setTab('history')}><CalendarDays size={18}/> Saved reports</button>
      <div className="sidebar-tip"><Wallet size={20}/><strong>Quick daily updates</strong><p>Enter once, generate a WhatsApp-ready report, and keep your records in one place.</p></div>
      <small className="sidebar-foot">Shanis · Personal sales tracker</small>
    </aside>
    <main className="main">
      <header className="topbar"><div><div className="eyebrow">SALES MANAGEMENT</div><h1>{tab==='report'?'Daily sales report':tab==='expenses'?'TA & expense tracker':'Saved reports'}</h1><p>Simple reporting for your daily field work.</p></div><div className="date-chip"><CalendarDays size={16}/>{report.date}</div></header>
      {tab==='report' && <div className="content-grid">
        <section className="panel form-panel">
          <div className="panel-heading"><div><h2>Report details</h2><p>Fill only what applies today. Leave the rest blank.</p></div><span className="step-pill">01 / DAILY</span></div>
          <div className="form-grid"><label className="field"><span>Report date</span><input type="date" value={report.date} onChange={e=>set('date',e.target.value)}/></label><Input id="executive" label="Executive name" placeholder="Your name"/></div>
          <h3 className="section-title">Today's update</h3><div className="form-grid">{fields.map(([id,label])=> id==='area'||id==='activityType' ? <Textarea key={id} id={id} label={label} placeholder={id==='area'?'e.g. Worked with Ashraf, Vendallur':'e.g. Lead follow-up, site visit'}/> : <Input key={id} id={id} label={label} placeholder={id==='paymentCollected'?'e.g. ₹10,000':'Enter count / details'}/>)}</div>
          <div className="section-row"><h3 className="section-title">Month-to-date (MTD)</h3><span className="muted">For the selected month</span></div>
          <div className="form-grid">{mtdFields.map(([id,label])=><Input key={id} id={id} label={label} placeholder="Enter current total"/>)}</div>
          <h3 className="section-title">Tomorrow's top 3 focus</h3><div className="focus-list"><Input id="focus1" label="Priority 1" placeholder="First task"/><Input id="focus2" label="Priority 2" placeholder="Second task"/><Input id="focus3" label="Priority 3" placeholder="Third task"/></div>
          <div className="actions"><button className="btn secondary" onClick={()=>setReport(blankReport())}><RotateCcw size={16}/> Clear form</button><button className="btn primary" onClick={saveReport}><CheckCircle2 size={17}/> Save report</button></div>
        </section>
        <section className="panel preview-panel"><div className="panel-heading"><div><h2>WhatsApp preview</h2><p>Copy and paste this text into your group.</p></div><span className="live-dot">LIVE</span></div><textarea id="report-output" className="report-output" readOnly value={reportText}/><div className="preview-stats"><div><span>MTD TA distance</span><strong>{totalKm} km</strong></div><div><span>MTD expenses</span><strong>{money(totalExpense)}</strong></div></div><button className="btn primary full" onClick={copyReport}><ClipboardCopy size={17}/>{copied?'Copied!':'Copy WhatsApp report'}</button><button className="btn secondary full" onClick={downloadReport}><Download size={17}/> Download .txt</button><p className="privacy-note">Your entries are saved in this browser on this device. This version does not send data to a server.</p></section>
      </div>}
      {tab==='expenses' && <div className="single-column"><section className="panel"><div className="panel-heading"><div><h2>Add travel or expense</h2><p>Log daily TA kilometres, routes and food expenses.</p></div></div><form onSubmit={addExpense}><div className="form-grid"><label className="field"><span>Date</span><input type="date" value={expense.date} required onChange={e=>setExpense(p=>({...p,date:e.target.value}))}/></label><label className="field"><span>Entry type</span><select value={expense.type} onChange={e=>setExpense(p=>({...p,type:e.target.value}))}><option>TA</option><option>Food</option><option>SIM / recharge</option><option>Other</option></select></label><label className="field"><span>Distance (km)</span><input type="number" min="0" step="0.1" value={expense.km} placeholder="e.g. 33" onChange={e=>setExpense(p=>({...p,km:e.target.value}))}/></label><label className="field"><span>Amount (₹)</span><input type="number" min="0" value={expense.amount} placeholder="e.g. 350" onChange={e=>setExpense(p=>({...p,amount:e.target.value}))}/></label><label className="field span-2"><span>Route / places visited</span><input value={expense.route} placeholder="e.g. KSEB Kandanakam → SBI Kuttippuram → Musthafa" onChange={e=>setExpense(p=>({...p,route:e.target.value}))}/></label><label className="field span-2"><span>Notes</span><input value={expense.note} placeholder="e.g. Food, new SIM" onChange={e=>setExpense(p=>({...p,note:e.target.value}))}/></label></div><button className="btn primary" type="submit"><Plus size={17}/> Add entry</button></form></section><section className="panel"><div className="panel-heading"><div><h2>Expense log</h2><p>{monthExpenses.length} entries in {month || 'selected month'}</p></div><div className="totals"><strong>{totalKm} km</strong><small>{money(totalExpense)} total</small></div></div>{monthExpenses.length===0?<div className="empty">No expenses logged for this month yet.</div>:<div className="table-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Route / notes</th><th>KM</th><th>Amount</th><th></th></tr></thead><tbody>{monthExpenses.map(x=><tr key={x.id}><td>{x.date}</td><td><span className="type-pill">{x.type}</span></td><td>{x.route||x.note||'—'}{x.route&&x.note?<small className="row-note">{x.note}</small>:null}</td><td>{x.km||'—'}</td><td>{x.amount?money(x.amount):'—'}</td><td><button className="icon-btn" title="Delete entry" onClick={()=>setExpenses(p=>p.filter(y=>y.id!==x.id))}><Trash2 size={16}/></button></td></tr>)}</tbody></table></div>}</section></div>}
      {tab==='history' && <section className="panel"><div className="panel-heading"><div><h2>Saved daily reports</h2><p>Reports saved in this browser, newest first.</p></div></div>{history.length===0?<div className="empty">No saved reports yet. Fill the daily report and click “Save report”.</div>:<div className="history-list">{[...history].sort((a,b)=>b.date.localeCompare(a.date)).map(x=><div className="history-item" key={x.date}><div className="history-icon"><FileText size={19}/></div><div className="history-info"><strong>{x.date}</strong><span>{x.area||'No area entered'} · {x.executive||'Shanis'}</span></div><button className="btn secondary small" onClick={()=>loadHistory(x)}>Open report</button><button className="icon-btn" title="Delete report" onClick={()=>setHistory(p=>p.filter(y=>y.date!==x.date))}><Trash2 size={16}/></button></div>)}</div>}</section>}
      <footer className="footer">ECHONIX · Daily reporting tool <span>Local browser storage · No account required</span></footer>
    </main>
  </div>;
}