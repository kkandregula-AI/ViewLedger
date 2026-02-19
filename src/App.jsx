// src/App.jsx
import { useState, useEffect, useCallback, useMemo } from "react";
import dayjs from "dayjs";
import { initDB, insertTransaction, getAllTransactions, deleteTransaction, getCategorySummary, getMonthlyTotals, getTransactionCount } from "./lib/db";
import { CATEGORIES, CATEGORY_NAMES, getCategoryData } from "./lib/categories";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const fmt = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtShort = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

const BANKS = ["HDFC Bank","ICICI Bank","SBI","Axis Bank","Kotak Bank","Yes Bank","PNB","Paytm Bank","PhonePe","Bank of Baroda","Canara Bank","Union Bank","IndusInd Bank","IDFC First Bank","Other"];
const MODES = ["UPI","NEFT","IMPS","Cash","Card","Net Banking","EMI","Cheque","Other"];

// ─────────────────────────────────────────────
// QUICK ADD MODAL
// ─────────────────────────────────────────────
function QuickAdd({ onSave, onClose }) {
  const [type, setType] = useState("debit");
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [bank, setBank] = useState("HDFC Bank");
  const [category, setCategory] = useState("Shopping");
  const [mode, setMode] = useState("UPI");
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!amount || isNaN(parseFloat(amount))) return alert("Please enter a valid amount");
    setSaving(true);
    const cat = getCategoryData(type === "credit" ? "Income" : category);
    const finalCat = type === "credit" ? "Income" : category;
    const tx = {
      id: `manual_${Date.now()}_${Math.random().toString(36).substr(2,6)}`,
      date: new Date(date).toISOString(),
      amount: parseFloat(amount),
      type,
      bank,
      account: null,
      merchant: merchant || "Manual Entry",
      paymentMode: mode,
      balance: null,
      category: finalCat,
      categoryIcon: cat.icon,
      categoryColor: cat.color,
      raw: `Manual: ${type} ₹${amount} ${merchant}`,
      sender: "MANUAL",
    };
    await insertTransaction(tx);
    setSaving(false);
    onSave();
    onClose();
  }

  return (
    <div style={styles.modalOverlay}>
      {/* Full-width Cancel bar at top - always visible */}
      <button onClick={onClose} style={{ position:"absolute", top:0, left:0, right:0, padding:"16px", background:"transparent", border:"none", cursor:"pointer", zIndex:200, display:"flex", justifyContent:"center" }}>
        <div style={{ width:40, height:5, background:"rgba(255,255,255,0.3)", borderRadius:3 }} />
      </button>
      <div style={styles.modalSheet}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <h2 style={{ ...styles.modalTitle, marginBottom:0 }}>Add Transaction</h2>
          <button onClick={onClose} style={{ background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:8, padding:"8px 16px", color:"#ef4444", cursor:"pointer", fontSize:14, fontWeight:600 }}>✕ Cancel</button>
        </div>

        {/* Type */}
        <div style={styles.typeRow}>
          {["debit","credit"].map(t => (
            <button key={t} onClick={() => setType(t)} style={{
              ...styles.typeBtn,
              background: type === t ? (t === "debit" ? "#ef444420" : "#10b98120") : "rgba(255,255,255,0.04)",
              borderColor: type === t ? (t === "debit" ? "#ef4444" : "#10b981") : "rgba(255,255,255,0.1)",
              color: type === t ? (t === "debit" ? "#ef4444" : "#10b981") : "#6b7280",
            }}>
              {t === "debit" ? "💸 Spent" : "💰 Income"}
            </button>
          ))}
        </div>

        {/* Amount */}
        <div style={styles.amountRow}>
          <span style={styles.currSymbol}>₹</span>
          <input style={styles.amountInput} type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} autoFocus inputMode="decimal" />
        </div>

        {/* Date */}
        <label style={styles.fieldLabel}>Date</label>
        <input style={styles.input} type="date" value={date} onChange={e => setDate(e.target.value)} />

        {/* Merchant */}
        <label style={styles.fieldLabel}>Merchant / Description</label>
        <input style={styles.input} type="text" placeholder="e.g. Swiggy, Salary, Amazon..." value={merchant} onChange={e => setMerchant(e.target.value)} />

        {/* Bank */}
        <label style={styles.fieldLabel}>Bank</label>
        <select style={styles.select} value={bank} onChange={e => setBank(e.target.value)}>
          {BANKS.map(b => <option key={b}>{b}</option>)}
        </select>

        {/* Category (debit only) */}
        {type === "debit" && (<>
          <label style={styles.fieldLabel}>Category</label>
          <div style={styles.catGrid}>
            {CATEGORY_NAMES.filter(c => c !== "Income").map(c => {
              const d = getCategoryData(c);
              return (
                <button key={c} onClick={() => setCategory(c)} style={{
                  ...styles.catChip,
                  background: category === c ? d.color + "25" : "rgba(255,255,255,0.04)",
                  borderColor: category === c ? d.color : "rgba(255,255,255,0.08)",
                  color: category === c ? d.color : "#9ca3af",
                }}>
                  {d.icon} {c}
                </button>
              );
            })}
          </div>
        </>)}

        {/* Mode */}
        <label style={styles.fieldLabel}>Payment Mode</label>
        <select style={styles.select} value={mode} onChange={e => setMode(e.target.value)}>
          {MODES.map(m => <option key={m}>{m}</option>)}
        </select>

        <button style={{ ...styles.saveBtn, opacity: saving ? 0.6 : 1 }} onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "💾 Save Transaction"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TRANSACTION CARD
// ─────────────────────────────────────────────
function TxCard({ tx, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={styles.txCard} onClick={() => setExpanded(!expanded)}>
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ ...styles.txIcon, background: (tx.categoryColor || "#6b7280") + "18" }}>
          <span style={{ fontSize:18 }}>{tx.categoryIcon || "💳"}</span>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={styles.txBank}>{tx.bank}</div>
          <div style={styles.txMeta}>{tx.category} · {tx.paymentMode}
            {tx.merchant && tx.merchant !== "Manual Entry" ? ` · ${tx.merchant}` : ""}
          </div>
        </div>
        <div style={{ textAlign:"right", flexShrink:0 }}>
          <div style={{ ...styles.txAmount, color: tx.type === "credit" ? "#10b981" : "#ef4444" }}>
            {tx.type === "credit" ? "+" : "−"}{fmt(tx.amount)}
          </div>
          {tx.balance && <div style={styles.txBalance}>Bal: {fmt(tx.balance)}</div>}
        </div>
      </div>
      {expanded && (
        <div style={styles.txExpanded}>
          <div style={styles.txDetailRow}><span style={styles.txDetailLabel}>Date</span><span>{dayjs(tx.date).format("DD MMM YYYY, hh:mm A")}</span></div>
          <div style={styles.txDetailRow}><span style={styles.txDetailLabel}>Mode</span><span>{tx.paymentMode}</span></div>
          <div style={styles.txDetailRow}><span style={styles.txDetailLabel}>Account</span><span>{tx.account || "—"}</span></div>
          <button style={styles.deleteBtn} onClick={e => { e.stopPropagation(); onDelete(tx.id); }}>🗑 Delete</button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// LEDGER SCREEN
// ─────────────────────────────────────────────
function LedgerScreen({ transactions, onDelete, onRefresh }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  let filtered = transactions;
  if (filter !== "all") filtered = filtered.filter(t => t.type === filter);
  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(t =>
      t.merchant?.toLowerCase().includes(q) ||
      t.bank?.toLowerCase().includes(q) ||
      t.category?.toLowerCase().includes(q) ||
      String(t.amount).includes(q)
    );
  }

  // Group by date
  const map = {};
  for (const tx of filtered) {
    const day = tx.date.split("T")[0];
    if (!map[day]) map[day] = { date: day, txs: [], credit: 0, debit: 0 };
    map[day].txs.push(tx);
    if (tx.type === "credit") map[day].credit += tx.amount;
    if (tx.type === "debit") map[day].debit += tx.amount;
  }
  const groups = Object.values(map).sort((a,b) => b.date.localeCompare(a.date));

  const totalCredit = transactions.filter(t => t.type === "credit").reduce((s,t) => s+t.amount, 0);
  const totalDebit = transactions.filter(t => t.type === "debit").reduce((s,t) => s+t.amount, 0);

  const fmtDay = d => {
    const today = dayjs().format("YYYY-MM-DD");
    const yest = dayjs().subtract(1,"day").format("YYYY-MM-DD");
    if (d === today) return "Today";
    if (d === yest) return "Yesterday";
    return dayjs(d).format("DD MMM YYYY");
  };

  return (
    <div style={styles.screen}>
      {/* Summary */}
      <div style={styles.summaryBar}>
        {[
          { label:"↑ Income", val: fmt(totalCredit), color:"#10b981" },
          { label:"↓ Spent",  val: fmt(totalDebit),  color:"#ef4444" },
          { label:"= Net",    val: fmt(totalCredit - totalDebit), color: totalCredit-totalDebit >= 0 ? "#10b981" : "#ef4444" },
        ].map(s => (
          <div key={s.label} style={styles.summaryItem}>
            <div style={styles.summaryLabel}>{s.label}</div>
            <div style={{ ...styles.summaryValue, color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <input style={styles.searchInput} placeholder="🔍 Search bank, merchant, category..." value={search} onChange={e => setSearch(e.target.value)} />

      {/* Filter */}
      <div style={styles.filterRow}>
        {[["all","All"],["credit","💰 Income"],["debit","💸 Spent"]].map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v)} style={{ ...styles.filterBtn, background: filter===v ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)", color: filter===v ? "#e8e4dc" : "#6b7280" }}>{l}</button>
        ))}
      </div>

      {/* Groups */}
      <div style={styles.list}>
        {groups.length === 0 && (
          <div style={styles.emptyState}>
            <div style={{ fontSize:48, marginBottom:12 }}>📭</div>
            <div style={{ fontSize:18, fontWeight:"bold", color:"#e8e4dc", marginBottom:8 }}>No transactions yet</div>
            <div style={{ fontSize:13, color:"#6b7280" }}>Tap the + button to add your first transaction</div>
          </div>
        )}
        {groups.map(g => (
          <div key={g.date} style={{ marginBottom:20 }}>
            <div style={styles.groupHeader}>
              <span style={styles.groupDate}>{fmtDay(g.date)}</span>
              <span>
                {g.credit > 0 && <span style={{ color:"#10b981", fontSize:12, marginRight:8 }}>+{fmt(g.credit)}</span>}
                {g.debit > 0 && <span style={{ color:"#ef4444", fontSize:12 }}>−{fmt(g.debit)}</span>}
              </span>
            </div>
            {g.txs.map(tx => <TxCard key={tx.id} tx={tx} onDelete={async id => { await deleteTransaction(id); onRefresh(); }} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// CHARTS SCREEN
// ─────────────────────────────────────────────
function ChartsScreen() {
  const [categories, setCategories] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [days, setDays] = useState(30);
  const [totalSpent, setTotalSpent] = useState(0);
  const [totalIncome, setTotalIncome] = useState(0);

  useEffect(() => { loadData(); }, [days]);

  async function loadData() {
    const cats = await getCategorySummary(days);
    const mon = await getMonthlyTotals();
    const all = await getAllTransactions();
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const filtered = all.filter(t => t.date >= since);
    setCategories(cats);
    setMonthly(mon.reverse());
    setTotalSpent(filtered.filter(t => t.type === "debit").reduce((s,t) => s+t.amount, 0));
    setTotalIncome(filtered.filter(t => t.type === "credit").reduce((s,t) => s+t.amount, 0));
  }

  const savings = totalIncome > 0 ? (((totalIncome - totalSpent) / totalIncome) * 100).toFixed(1) : 0;

  return (
    <div style={styles.screen}>
      {/* Period selector */}
      <div style={styles.filterRow}>
        {[[7,"7 Days"],[30,"30 Days"],[90,"90 Days"]].map(([v,l]) => (
          <button key={v} onClick={() => setDays(v)} style={{ ...styles.filterBtn, background: days===v ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)", color: days===v ? "#e8e4dc" : "#6b7280" }}>{l}</button>
        ))}
      </div>

      {/* Overview cards */}
      <div style={styles.overviewRow}>
        <div style={{ ...styles.overviewCard, borderColor:"rgba(16,185,129,0.3)" }}>
          <div style={styles.overviewLabel}>💰 Income</div>
          <div style={{ ...styles.overviewValue, color:"#10b981" }}>{fmtShort(totalIncome)}</div>
        </div>
        <div style={{ ...styles.overviewCard, borderColor:"rgba(239,68,68,0.3)" }}>
          <div style={styles.overviewLabel}>💸 Spent</div>
          <div style={{ ...styles.overviewValue, color:"#ef4444" }}>{fmtShort(totalSpent)}</div>
        </div>
      </div>

      {/* Savings rate */}
      {totalIncome > 0 && (
        <div style={styles.savingsCard}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
            <span style={{ fontSize:13, color:"#9ca3af" }}>Savings Rate</span>
            <span style={{ fontSize:13, fontWeight:"bold", color:"#10b981" }}>{savings}%</span>
          </div>
          <div style={{ height:6, background:"rgba(255,255,255,0.08)", borderRadius:3 }}>
            <div style={{ height:"100%", width:`${Math.max(0,Math.min(100,savings))}%`, background:"#10b981", borderRadius:3, transition:"width 0.8s ease" }} />
          </div>
        </div>
      )}

      {/* Monthly bar chart */}
      {monthly.length > 0 && (
        <div style={styles.chartCard}>
          <div style={styles.chartTitle}>Monthly Spending</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={monthly} margin={{ top:8, right:8, left:0, bottom:0 }}>
              <XAxis dataKey="month" tickFormatter={m => dayjs(m).format("MMM")} tick={{ fill:"#6b7280", fontSize:10 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                formatter={v => fmtShort(v)}
                contentStyle={{ background:"#1a1a24", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, fontSize:11 }}
                labelFormatter={m => dayjs(m).format("MMM YYYY")}
              />
              <Bar dataKey="debit" fill="#ef4444" radius={[4,4,0,0]} name="Spent" />
              <Bar dataKey="credit" fill="#10b981" radius={[4,4,0,0]} name="Income" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Category breakdown */}
      {categories.length > 0 && (
        <div style={styles.chartCard}>
          <div style={styles.chartTitle}>Spending by Category</div>

          {/* Pie chart */}
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={categories} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
                {categories.map((c, i) => <Cell key={i} fill={c.color || "#6b7280"} />)}
              </Pie>
              <Tooltip formatter={v => fmtShort(v)} contentStyle={{ background:"#1a1a24", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, fontSize:11 }} />
            </PieChart>
          </ResponsiveContainer>

          {/* Category rows */}
          {categories.map((c,i) => {
            const pct = totalSpent > 0 ? ((c.total / totalSpent) * 100).toFixed(1) : 0;
            return (
              <div key={i} style={styles.catRow}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                  <div style={{ ...styles.catIcon, background:(c.color||"#6b7280")+"18" }}>
                    <span style={{ fontSize:18 }}>{c.icon}</span>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:600, color:"#e8e4dc" }}>{c.category}</div>
                    <div style={{ fontSize:11, color:"#6b7280" }}>{c.count} transactions</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:14, fontWeight:"bold", color:"#ef4444" }}>{fmt(c.total)}</div>
                    <div style={{ fontSize:10, color:"#6b7280" }}>{pct}%</div>
                  </div>
                </div>
                <div style={{ height:4, background:"rgba(255,255,255,0.06)", borderRadius:2 }}>
                  <div style={{ height:"100%", width:`${pct}%`, background:c.color||"#6b7280", borderRadius:2 }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {categories.length === 0 && (
        <div style={styles.emptyState}>
          <div style={{ fontSize:40, marginBottom:12 }}>📊</div>
          <div style={{ fontSize:16, color:"#6b7280" }}>No spending data yet</div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// EXPORT SCREEN
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// REPORTS SCREEN
// ─────────────────────────────────────────────
function ReportsScreen({ transactions, mode, setMode, selectedWeek, setSelectedWeek, selectedMonth, setSelectedMonth, selectedYear, setSelectedYear, customFrom, setCustomFrom, customTo, setCustomTo }) {

  // ── Filter transactions based on mode
  const filtered = useMemo(() => {
    let from, to;
    if (mode === "weekly") {
      from = dayjs(selectedWeek).startOf("week");
      to   = dayjs(selectedWeek).endOf("week");
    } else if (mode === "monthly") {
      from = dayjs(selectedMonth + "-01").startOf("month");
      to   = dayjs(selectedMonth + "-01").endOf("month");
    } else if (mode === "yearly") {
      from = dayjs(selectedYear + "-01-01").startOf("year");
      to   = dayjs(selectedYear + "-12-31").endOf("year");
    } else {
      from = dayjs(customFrom).startOf("day");
      to   = dayjs(customTo).endOf("day");
    }
    return transactions.filter(t => {
      const d = dayjs(t.date);
      return d.isAfter(from.subtract(1, "ms")) && d.isBefore(to.add(1, "ms"));
    });
  }, [transactions, mode, selectedWeek, selectedMonth, selectedYear, customFrom, customTo]);

  const totalCredit = filtered.filter(t => t.type === "credit").reduce((s,t) => s+t.amount, 0);
  const totalDebit  = filtered.filter(t => t.type === "debit").reduce((s,t) => s+t.amount, 0);
  const net         = totalCredit - totalDebit;

  // ── Category breakdown
  const catMap = {};
  filtered.filter(t => t.type === "debit").forEach(t => {
    const k = t.category || "Other";
    if (!catMap[k]) catMap[k] = { name:k, icon:t.categoryIcon||"📌", color:t.categoryColor||"#6b7280", total:0, count:0 };
    catMap[k].total += t.amount;
    catMap[k].count += 1;
  });
  const cats = Object.values(catMap).sort((a,b) => b.total - a.total);

  // ── Daily breakdown for chart
  const dayMap = {};
  filtered.forEach(t => {
    const d = t.date.split("T")[0];
    if (!dayMap[d]) dayMap[d] = { date:d, credit:0, debit:0 };
    if (t.type === "credit") dayMap[d].credit += t.amount;
    if (t.type === "debit")  dayMap[d].debit  += t.amount;
  });
  const chartData = Object.values(dayMap).sort((a,b) => a.date.localeCompare(b.date)).map(d => ({
    ...d,
    label: mode === "yearly" ? dayjs(d.date).format("MMM") : dayjs(d.date).format("DD"),
  }));

  // ── Week options (last 8 weeks)
  const weekOptions = Array.from({ length: 8 }, (_, i) => {
    const start = dayjs().startOf("week").subtract(i, "week");
    return { value: start.format("YYYY-MM-DD"), label: start.format("DD MMM") + " – " + start.endOf("week").format("DD MMM YYYY") };
  });

  // ── Month options (last 12 months)
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const m = dayjs().subtract(i, "month");
    return { value: m.format("YYYY-MM"), label: m.format("MMMM YYYY") };
  });

  // ── Year options (last 5 years)
  const yearOptions = Array.from({ length: 5 }, (_, i) => {
    const y = dayjs().subtract(i, "year").year();
    return { value: String(y), label: String(y) };
  });

  // ── CSV export for this report
  function exportCSV() {
    if (filtered.length === 0) return alert("No transactions in this period");
    const headers = ["Date","Time","Type","Amount","Bank","Merchant","Category","Mode"];
    const rows = filtered.map(tx => [
      dayjs(tx.date).format("DD-MM-YYYY"),
      dayjs(tx.date).format("HH:mm"),
      tx.type,
      Number(tx.amount).toFixed(2),
      tx.bank||"", tx.merchant||"", tx.category||"", tx.paymentMode||"",
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type:"text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report_${mode}_${dayjs().format("YYYY-MM-DD")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const inputStyle = { background:"#1a1a24", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"10px 12px", color:"#e8e4dc", fontSize:13, width:"100%", outline:"none" };

  return (
    <div style={{ padding:"16px 16px 100px" }}>

      {/* Mode Tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:16, flexWrap:"wrap" }}>
        {[["weekly","📅 Weekly"],["monthly","🗓 Monthly"],["yearly","📆 Yearly"],["custom","🔎 Custom"]].map(([v,l]) => (
          <button key={v} onClick={() => setMode(v)} style={{
            flex:1, minWidth:"calc(50% - 6px)", padding:"10px 4px", borderRadius:10, border:"none",
            cursor:"pointer", fontSize:12, fontWeight:600,
            background: mode===v ? "#10b981" : "rgba(255,255,255,0.05)",
            color: mode===v ? "#fff" : "#6b7280",
          }}>{l}</button>
        ))}
      </div>

      {/* Period Selector */}
      <div style={{ marginBottom:16 }}>
        {mode === "weekly" && (
          <select style={inputStyle} value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)}>
            {weekOptions.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
        )}
        {mode === "monthly" && (
          <select style={inputStyle} value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
            {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        )}
        {mode === "yearly" && (
          <select style={inputStyle} value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
            {yearOptions.map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
          </select>
        )}
        {mode === "custom" && (
          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10, color:"#6b7280", marginBottom:6, textTransform:"uppercase", letterSpacing:0.8 }}>From</div>
              <input type="date" style={inputStyle} value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
            </div>
            <div style={{ paddingTop:20, color:"#6b7280" }}>→</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10, color:"#6b7280", marginBottom:6, textTransform:"uppercase", letterSpacing:0.8 }}>To</div>
              <input type="date" style={inputStyle} value={customTo} onChange={e => setCustomTo(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div style={{ display:"flex", gap:10, marginBottom:14 }}>
        {[
          { label:"Income",       val:fmtShort(totalCredit), color:"#10b981" },
          { label:"Spent",        val:fmtShort(totalDebit),  color:"#ef4444" },
          { label:"Net",          val:fmtShort(net),          color: net>=0 ? "#10b981" : "#ef4444" },
          { label:"Transactions", val:filtered.length,        color:"#60a5fa" },
        ].map(s => (
          <div key={s.label} style={{ flex:1, background:"rgba(255,255,255,0.03)", borderRadius:12, padding:"12px 8px", textAlign:"center", border:"1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ fontSize:13, fontWeight:"bold", color:s.color }}>{s.val}</div>
            <div style={{ fontSize:9, color:"#6b7280", marginTop:3, textTransform:"uppercase", letterSpacing:0.5 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Savings rate */}
      {totalCredit > 0 && (
        <div style={{ background:"rgba(255,255,255,0.03)", borderRadius:12, padding:14, marginBottom:14, border:"1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
            <span style={{ fontSize:12, color:"#9ca3af" }}>Savings Rate</span>
            <span style={{ fontSize:12, fontWeight:"bold", color: net>=0 ? "#10b981" : "#ef4444" }}>
              {(((totalCredit-totalDebit)/totalCredit)*100).toFixed(1)}%
            </span>
          </div>
          <div style={{ height:6, background:"rgba(255,255,255,0.08)", borderRadius:3 }}>
            <div style={{ height:"100%", width:`${Math.max(0,Math.min(100,((totalCredit-totalDebit)/totalCredit)*100))}%`, background: net>=0 ? "#10b981" : "#ef4444", borderRadius:3 }} />
          </div>
        </div>
      )}

      {/* Bar Chart */}
      {chartData.length > 0 && (
        <div style={{ background:"rgba(255,255,255,0.03)", borderRadius:14, padding:16, marginBottom:14, border:"1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ fontSize:11, color:"#6b7280", textTransform:"uppercase", letterSpacing:1, marginBottom:12 }}>Daily Breakdown</div>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={chartData} margin={{ top:4, right:4, left:0, bottom:0 }}>
              <XAxis dataKey="label" tick={{ fill:"#6b7280", fontSize:9 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                formatter={v => fmtShort(v)}
                contentStyle={{ background:"#1a1a24", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, fontSize:11 }}
              />
              <Bar dataKey="debit"  fill="#ef4444" radius={[3,3,0,0]} name="Spent" />
              <Bar dataKey="credit" fill="#10b981" radius={[3,3,0,0]} name="Income" />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display:"flex", gap:16, justifyContent:"center", marginTop:8 }}>
            <span style={{ fontSize:10, color:"#ef4444" }}>■ Spent</span>
            <span style={{ fontSize:10, color:"#10b981" }}>■ Income</span>
          </div>
        </div>
      )}

      {/* Category Breakdown */}
      {cats.length > 0 && (
        <div style={{ background:"rgba(255,255,255,0.03)", borderRadius:14, padding:16, marginBottom:14, border:"1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ fontSize:11, color:"#6b7280", textTransform:"uppercase", letterSpacing:1, marginBottom:12 }}>By Category</div>
          {cats.map((c,i) => {
            const pct = totalDebit > 0 ? ((c.total/totalDebit)*100).toFixed(1) : 0;
            return (
              <div key={i} style={{ marginBottom:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                  <span style={{ fontSize:13, color:"#e8e4dc" }}>{c.icon} {c.name}</span>
                  <span style={{ fontSize:13, fontWeight:"bold", color:"#ef4444" }}>{fmt(c.total)} <span style={{ fontSize:10, color:"#6b7280", fontWeight:"normal" }}>({pct}%)</span></span>
                </div>
                <div style={{ height:4, background:"rgba(255,255,255,0.06)", borderRadius:2 }}>
                  <div style={{ height:"100%", width:`${pct}%`, background:c.color, borderRadius:2 }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Transactions List */}
      {filtered.length > 0 && (
        <div style={{ background:"rgba(255,255,255,0.03)", borderRadius:14, padding:16, marginBottom:14, border:"1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ fontSize:11, color:"#6b7280", textTransform:"uppercase", letterSpacing:1, marginBottom:12 }}>Transactions ({filtered.length})</div>
          {filtered.slice(0,50).map((tx,i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:10, paddingBottom:10, marginBottom:10, borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ width:36, height:36, borderRadius:9, background:(tx.categoryColor||"#6b7280")+"18", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>
                {tx.categoryIcon||"💳"}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, color:"#e8e4dc", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{tx.bank}</div>
                <div style={{ fontSize:11, color:"#6b7280" }}>{dayjs(tx.date).format("DD MMM")} · {tx.category}</div>
              </div>
              <div style={{ fontSize:13, fontWeight:"bold", color: tx.type==="credit" ? "#10b981" : "#ef4444", flexShrink:0 }}>
                {tx.type==="credit" ? "+" : "−"}{fmt(tx.amount)}
              </div>
            </div>
          ))}
          {filtered.length > 50 && <div style={{ textAlign:"center", fontSize:12, color:"#6b7280" }}>Showing 50 of {filtered.length} — export CSV to see all</div>}
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div style={{ textAlign:"center", paddingTop:40 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>📭</div>
          <div style={{ fontSize:16, color:"#6b7280" }}>No transactions in this period</div>
        </div>
      )}

      {/* Export this report */}
      {filtered.length > 0 && (
        <button onClick={exportCSV} style={{ width:"100%", padding:16, background:"#10b981", border:"none", borderRadius:12, color:"#fff", fontSize:15, fontWeight:"bold", cursor:"pointer", marginTop:4 }}>
          📥 Export This Report as CSV
        </button>
      )}

    </div>
  );
}

function ExportScreen({ transactions, onBack, mode, setMode, selectedWeek, setSelectedWeek, selectedMonth, setSelectedMonth, selectedYear, setSelectedYear, customFrom, setCustomFrom, customTo, setCustomTo }) {
  const [exporting, setExporting] = useState(null);

  // ── Same filter logic as ReportsScreen — stays in sync
  const filtered = useMemo(() => {
    let from, to;
    if (mode === "weekly") {
      from = dayjs(selectedWeek).startOf("week");
      to   = dayjs(selectedWeek).endOf("week");
    } else if (mode === "monthly") {
      from = dayjs(selectedMonth + "-01").startOf("month");
      to   = dayjs(selectedMonth + "-01").endOf("month");
    } else if (mode === "yearly") {
      from = dayjs(selectedYear + "-01-01").startOf("year");
      to   = dayjs(selectedYear + "-12-31").endOf("year");
    } else if (mode === "custom") {
      from = dayjs(customFrom).startOf("day");
      to   = dayjs(customTo).endOf("day");
    } else {
      // "all" — no filter
      return transactions;
    }
    return transactions.filter(t => {
      const d = dayjs(t.date);
      return d.isAfter(from.subtract(1,"ms")) && d.isBefore(to.add(1,"ms"));
    });
  }, [transactions, mode, selectedWeek, selectedMonth, selectedYear, customFrom, customTo]);

  const totalCredit = filtered.filter(t => t.type==="credit").reduce((s,t) => s+t.amount, 0);
  const totalDebit  = filtered.filter(t => t.type==="debit").reduce((s,t) => s+t.amount, 0);
  const thisMonth   = transactions.filter(t => t.date.startsWith(dayjs().format("YYYY-MM"))).length;

  // ── Period label for filename and display
  function periodLabel() {
    if (mode === "weekly")  return "Week of " + dayjs(selectedWeek).format("DD MMM YYYY");
    if (mode === "monthly") return dayjs(selectedMonth + "-01").format("MMMM YYYY");
    if (mode === "yearly")  return selectedYear;
    if (mode === "custom")  return dayjs(customFrom).format("DD MMM") + " to " + dayjs(customTo).format("DD MMM YYYY");
    return "All Time";
  }

  function filenameSlug() {
    if (mode === "weekly")  return "week_" + selectedWeek;
    if (mode === "monthly") return "month_" + selectedMonth;
    if (mode === "yearly")  return "year_" + selectedYear;
    if (mode === "custom")  return "custom_" + customFrom + "_to_" + customTo;
    return "all";
  }

  async function handleExport(type) {
    if (filtered.length === 0) return alert("No transactions in this period");
    setExporting(type);
    try {
      if (type === "csv") {
        const headers = ["Date","Time","Type","Amount","Bank","Merchant","Category","Mode","Balance"];
        const rows = filtered.map(tx => [
          dayjs(tx.date).format("DD-MM-YYYY"),
          dayjs(tx.date).format("HH:mm"),
          tx.type,
          Number(tx.amount).toFixed(2),
          tx.bank||"", tx.merchant||"", tx.category||"",
          tx.paymentMode||"",
          tx.balance ? Number(tx.balance).toFixed(2) : "",
        ]);
        const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
        const blob = new Blob(["\uFEFF" + csv], { type:"text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `sms_ledger_${filenameSlug()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (type === "json") {
        const json = JSON.stringify({ exportedAt: new Date().toISOString(), period: periodLabel(), count: filtered.length, transactions: filtered }, null, 2);
        const blob = new Blob([json], { type:"application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `sms_ledger_backup_${filenameSlug()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch(e) {
      alert("Export failed: " + (e.message || "Unknown error"));
    }
    setExporting(null);
  }

  const inputStyle = { background:"#1a1a24", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"10px 12px", color:"#e8e4dc", fontSize:13, width:"100%", outline:"none" };

  function ExportBtn({ id, icon, title, subtitle, color }) {
    const isLoading = exporting === id;
    return (
      <button onClick={() => handleExport(id)} disabled={exporting !== null} style={{ width:"100%", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:14, padding:14, display:"flex", alignItems:"center", gap:14, marginBottom:10, cursor:"pointer", opacity: exporting!==null ? 0.5 : 1 }}>
        <div style={{ width:46, height:46, borderRadius:12, background:color+"18", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:22 }}>
          {isLoading ? "⏳" : icon}
        </div>
        <div style={{ flex:1, textAlign:"left" }}>
          <div style={{ fontSize:14, fontWeight:600, color:"#e8e4dc", marginBottom:3 }}>{title}</div>
          <div style={{ fontSize:12, color:"#6b7280", lineHeight:1.5 }}>{subtitle}</div>
        </div>
        <span style={{ color:"#4b5563", fontSize:16 }}>→</span>
      </button>
    );
  }

  return (
    <div style={{ padding:"16px 16px 100px" }}>

      {/* Back */}
      <button onClick={onBack} style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:"10px 16px", color:"#e8e4dc", cursor:"pointer", fontSize:14, marginBottom:16, width:"100%" }}>
        <span style={{ fontSize:18 }}>←</span>
        <span style={{ fontWeight:600 }}>Back to Ledger</span>
      </button>

      {/* Period Selector — same as Reports */}
      <div style={{ background:"rgba(255,255,255,0.03)", borderRadius:14, padding:16, marginBottom:14, border:"1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ fontSize:11, color:"#6b7280", textTransform:"uppercase", letterSpacing:1, marginBottom:12 }}>📅 Select Period to Export</div>

        {/* Mode tabs */}
        <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
          {[["all","🗂 All"],["weekly","📅 Week"],["monthly","🗓 Month"],["yearly","📆 Year"],["custom","🔎 Custom"]].map(([v,l]) => (
            <button key={v} onClick={() => setMode(v)} style={{ flex:1, minWidth:"calc(33% - 4px)", padding:"8px 4px", borderRadius:8, border:"none", cursor:"pointer", fontSize:11, fontWeight:600, background: mode===v ? "#10b981" : "rgba(255,255,255,0.05)", color: mode===v ? "#fff" : "#6b7280" }}>{l}</button>
          ))}
        </div>

        {/* Period picker */}
        {mode === "weekly" && (
          <select style={inputStyle} value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)}>
            {Array.from({length:8},(_,i) => { const s = dayjs().startOf("week").subtract(i,"week"); return { value:s.format("YYYY-MM-DD"), label:s.format("DD MMM")+" – "+s.endOf("week").format("DD MMM YYYY") }; }).map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
        )}
        {mode === "monthly" && (
          <select style={inputStyle} value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
            {Array.from({length:12},(_,i) => { const m = dayjs().subtract(i,"month"); return { value:m.format("YYYY-MM"), label:m.format("MMMM YYYY") }; }).map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        )}
        {mode === "yearly" && (
          <select style={inputStyle} value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
            {Array.from({length:5},(_,i) => String(dayjs().subtract(i,"year").year())).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
        {mode === "custom" && (
          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10, color:"#6b7280", marginBottom:6, textTransform:"uppercase" }}>From</div>
              <input type="date" style={inputStyle} value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
            </div>
            <div style={{ paddingTop:20, color:"#6b7280" }}>→</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10, color:"#6b7280", marginBottom:6, textTransform:"uppercase" }}>To</div>
              <input type="date" style={inputStyle} value={customTo} onChange={e => setCustomTo(e.target.value)} />
            </div>
          </div>
        )}

        {/* Current period summary */}
        <div style={{ marginTop:14, padding:"12px 14px", background:"rgba(16,185,129,0.08)", borderRadius:10, border:"1px solid rgba(16,185,129,0.15)" }}>
          <div style={{ fontSize:12, color:"#10b981", fontWeight:600, marginBottom:4 }}>📊 {periodLabel()}</div>
          <div style={{ fontSize:12, color:"#6b7280" }}>
            {filtered.length} transactions &nbsp;·&nbsp;
            <span style={{ color:"#10b981" }}>+{fmtShort(totalCredit)}</span> &nbsp;
            <span style={{ color:"#ef4444" }}>−{fmtShort(totalDebit)}</span>
          </div>
        </div>
      </div>

      {/* Export buttons */}
      <div style={{ fontSize:10, color:"#4b5563", textTransform:"uppercase", letterSpacing:1.2, marginBottom:10 }}>📥 DOWNLOAD</div>
      <ExportBtn id="csv"  icon="📊" title="Export as CSV"  subtitle={`${filtered.length} transactions · ${periodLabel()} · opens in Excel or Google Sheets`} color="#10b981" />
      <ExportBtn id="json" icon="💾" title="Export as JSON" subtitle={`Full backup of ${filtered.length} transactions for ${periodLabel()}`} color="#6b7280" />

      {/* Tips */}
      <div style={{ background:"rgba(255,255,255,0.03)", borderRadius:14, padding:16, marginTop:8, border:"1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ fontSize:13, fontWeight:600, color:"#e8e4dc", marginBottom:10 }}>💡 Tips</div>
        {[
          "The period selected here stays in sync with the Reports tab",
          "CSV opens in Excel, Numbers or Google Sheets",
          "JSON is a full backup — import it to restore data",
          "Share via AirDrop, WhatsApp or email after downloading",
        ].map((tip,i) => (
          <div key={i} style={{ display:"flex", gap:8, marginBottom:6 }}>
            <span style={{ color:"#6b7280" }}>·</span>
            <span style={{ fontSize:12, color:"#6b7280", lineHeight:1.5 }}>{tip}</span>
          </div>
        ))}
      </div>

    </div>
  );
}


// ─────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("ledger");
  const [transactions, setTransactions] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [dbReady, setDbReady] = useState(false);

  // Shared report period state — synced between Reports and Export
  const [reportMode,    setReportMode]    = useState("monthly");
  const [reportWeek,    setReportWeek]    = useState(dayjs().startOf("week").format("YYYY-MM-DD"));
  const [reportMonth,   setReportMonth]   = useState(dayjs().format("YYYY-MM"));
  const [reportYear,    setReportYear]    = useState(String(dayjs().year()));
  const [reportFrom,    setReportFrom]    = useState(dayjs().startOf("month").format("YYYY-MM-DD"));
  const [reportTo,      setReportTo]      = useState(dayjs().format("YYYY-MM-DD"));

  useEffect(() => {
    initDB().then(() => { setDbReady(true); loadTxns(); });
  }, []);

  const loadTxns = useCallback(async () => {
    const txns = await getAllTransactions();
    setTransactions(txns);
  }, []);

  if (!dbReady) return (
    <div style={{ minHeight:"100vh", background:"#0a0a0f", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12 }}>
      <div style={{ fontSize:64 }}>💳</div>
      <div style={{ fontSize:24, fontWeight:"bold", color:"#e8e4dc" }}>SMS Ledger</div>
      <div style={{ fontSize:14, color:"#6b7280" }}>Loading...</div>
    </div>
  );

  const tabs = [
    { id:"ledger",  icon:"📊", label:"Ledger" },
    { id:"charts",  icon:"📈", label:"Charts" },
    { id:"reports", icon:"📋", label:"Reports" },
    { id:"export",  icon:"📤", label:"Export" },
  ];

  return (
    <div style={styles.app}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.headerTitle}>SMS Ledger</div>
          <div style={styles.headerSub}>{dayjs().format("DD MMMM YYYY")}</div>
        </div>
        <button style={styles.addBtn} onClick={() => setShowAdd(true)}>+ Add</button>
      </div>

      {/* Screen */}
      <div style={styles.content}>
        {tab === "ledger" && <LedgerScreen transactions={transactions} onDelete={async id => { await deleteTransaction(id); loadTxns(); }} onRefresh={loadTxns} />}
        {tab === "charts" && <ChartsScreen />}
        {tab === "reports" && <ReportsScreen
          transactions={transactions}
          mode={reportMode} setMode={setReportMode}
          selectedWeek={reportWeek} setSelectedWeek={setReportWeek}
          selectedMonth={reportMonth} setSelectedMonth={setReportMonth}
          selectedYear={reportYear} setSelectedYear={setReportYear}
          customFrom={reportFrom} setCustomFrom={setReportFrom}
          customTo={reportTo} setCustomTo={setReportTo}
        />}
        {tab === "export" && <ExportScreen
          transactions={transactions}
          onBack={() => setTab("ledger")}
          mode={reportMode} setMode={setReportMode}
          selectedWeek={reportWeek} setSelectedWeek={setReportWeek}
          selectedMonth={reportMonth} setSelectedMonth={setReportMonth}
          selectedYear={reportYear} setSelectedYear={setReportYear}
          customFrom={reportFrom} setCustomFrom={setReportFrom}
          customTo={reportTo} setCustomTo={setReportTo}
        />}
      </div>

      {/* Bottom Nav */}
      <div style={styles.bottomNav}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ ...styles.navBtn, color: tab===t.id ? "#10b981" : "#6b7280" }}>
            <span style={{ fontSize:20 }}>{t.icon}</span>
            <span style={{ fontSize:10, marginTop:2 }}>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Quick Add Modal */}
      {showAdd && <QuickAdd onSave={loadTxns} onClose={() => setShowAdd(false)} />}
    </div>
  );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const styles = {
  app: { minHeight:"100vh", background:"#0a0a0f", color:"#e8e4dc", fontFamily:"system-ui, -apple-system, sans-serif", display:"flex", flexDirection:"column", maxWidth:430, margin:"0 auto", position:"relative" },
  header: { padding:"20px 20px 16px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", justifyContent:"space-between", alignItems:"center", position:"sticky", top:0, background:"#0a0a0f", zIndex:10, paddingTop:"max(20px, env(safe-area-inset-top))" },
  headerTitle: { fontSize:22, fontWeight:"bold", letterSpacing:-0.5 },
  headerSub: { fontSize:12, color:"#6b7280", marginTop:2 },
  addBtn: { background:"#10b981", color:"#fff", border:"none", borderRadius:10, padding:"10px 18px", fontSize:15, fontWeight:"bold", cursor:"pointer" },
  content: { flex:1, overflowY:"auto", paddingBottom:80 },
  screen: { padding:"16px 16px 0" },
  bottomNav: { position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:430, background:"#0f0f17", borderTop:"1px solid rgba(255,255,255,0.08)", display:"flex", paddingBottom:"env(safe-area-inset-bottom)" },
  navBtn: { flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"10px 0", border:"none", background:"transparent", cursor:"pointer", gap:2 },

  summaryBar: { display:"flex", background:"rgba(255,255,255,0.03)", borderRadius:12, marginBottom:12, overflow:"hidden", border:"1px solid rgba(255,255,255,0.07)" },
  summaryItem: { flex:1, padding:"12px 8px", textAlign:"center", borderRight:"1px solid rgba(255,255,255,0.06)" },
  summaryLabel: { fontSize:9, color:"#6b7280", textTransform:"uppercase", letterSpacing:0.5 },
  summaryValue: { fontSize:12, fontWeight:"bold", marginTop:2 },

  searchInput: { width:"100%", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:"10px 14px", color:"#e8e4dc", fontSize:13, marginBottom:10, boxSizing:"border-box", outline:"none" },
  filterRow: { display:"flex", gap:8, marginBottom:14 },
  filterBtn: { flex:1, padding:"8px 4px", borderRadius:8, border:"none", cursor:"pointer", fontSize:12, color:"#6b7280" },

  list: { paddingBottom:20 },
  groupHeader: { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8, padding:"0 4px" },
  groupDate: { fontSize:11, color:"#6b7280", textTransform:"uppercase", letterSpacing:0.8 },
  txCard: { background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:12, marginBottom:8, cursor:"pointer" },
  txIcon: { width:40, height:40, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
  txBank: { fontSize:14, fontWeight:600, color:"#e8e4dc" },
  txMeta: { fontSize:11, color:"#6b7280", marginTop:2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" },
  txAmount: { fontSize:14, fontWeight:"bold" },
  txBalance: { fontSize:10, color:"#4b5563", marginTop:2 },
  txExpanded: { marginTop:12, paddingTop:12, borderTop:"1px solid rgba(255,255,255,0.07)" },
  txDetailRow: { display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid rgba(255,255,255,0.05)", fontSize:12 },
  txDetailLabel: { color:"#6b7280" },
  deleteBtn: { marginTop:10, width:"100%", padding:10, background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.2)", borderRadius:8, color:"#ef4444", cursor:"pointer", fontSize:13 },

  emptyState: { textAlign:"center", paddingTop:60, paddingBottom:40 },

  overviewRow: { display:"flex", gap:12, marginBottom:12 },
  overviewCard: { flex:1, background:"rgba(255,255,255,0.03)", borderRadius:14, padding:16, border:"1px solid" },
  overviewLabel: { fontSize:12, color:"#6b7280", marginBottom:6 },
  overviewValue: { fontSize:18, fontWeight:"bold" },
  savingsCard: { background:"rgba(255,255,255,0.03)", borderRadius:12, padding:14, marginBottom:12, border:"1px solid rgba(255,255,255,0.07)" },
  chartCard: { background:"rgba(255,255,255,0.03)", borderRadius:14, padding:16, marginBottom:12, border:"1px solid rgba(255,255,255,0.07)" },
  chartTitle: { fontSize:11, color:"#6b7280", textTransform:"uppercase", letterSpacing:1, marginBottom:12 },
  catRow: { marginBottom:14, paddingBottom:14, borderBottom:"1px solid rgba(255,255,255,0.05)" },
  catIcon: { width:44, height:44, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center" },

  statsCard: { background:"rgba(255,255,255,0.03)", borderRadius:16, padding:16, marginBottom:16, border:"1px solid rgba(255,255,255,0.08)" },
  statsTitle: { fontSize:13, fontWeight:600, color:"#9ca3af", marginBottom:14 },
  statsGrid: { display:"flex", flexWrap:"wrap", gap:12 },
  statItem: { width:"calc(50% - 6px)", background:"rgba(255,255,255,0.03)", borderRadius:10, padding:12 },
  statValue: { fontSize:16, fontWeight:"bold", color:"#e8e4dc" },
  statLabel: { fontSize:10, color:"#6b7280", marginTop:2, textTransform:"uppercase", letterSpacing:0.5 },
  sectionLabel: { fontSize:10, color:"#4b5563", textTransform:"uppercase", letterSpacing:1.2, marginBottom:10 },
  exportCard: { width:"100%", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:14, padding:14, display:"flex", alignItems:"center", gap:14, marginBottom:10, cursor:"pointer" },
  exportIcon: { width:46, height:46, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
  exportTitle: { fontSize:14, fontWeight:600, color:"#e8e4dc" },
  exportTag: { padding:"2px 7px", borderRadius:6, fontSize:10, fontWeight:600 },
  exportSubtitle: { fontSize:12, color:"#6b7280", lineHeight:1.5, marginTop:2 },
  tipsCard: { background:"rgba(255,255,255,0.03)", borderRadius:14, padding:16, marginTop:4, border:"1px solid rgba(255,255,255,0.07)" },

  modalOverlay: { position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"flex-end", zIndex:100, backdropFilter:"blur(4px)", flexDirection:"column", justifyContent:"flex-end" },
  modalSheet: { background:"#13131a", borderRadius:"20px 20px 0 0", padding:24, width:"100%", maxWidth:430, margin:"0 auto", border:"1px solid rgba(255,255,255,0.1)", maxHeight:"90vh", overflowY:"auto" },
  modalHandle: { width:40, height:4, background:"rgba(255,255,255,0.2)", borderRadius:2, margin:"0 auto 20px" },
  modalTitle: { fontSize:18, fontWeight:"bold", color:"#e8e4dc", marginBottom:0 },
  typeRow: { display:"flex", gap:10, marginBottom:20 },
  typeBtn: { flex:1, padding:12, borderRadius:10, border:"1px solid", cursor:"pointer", fontSize:14, fontWeight:600 },
  amountRow: { display:"flex", alignItems:"center", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, paddingLeft:14, marginBottom:16 },
  currSymbol: { fontSize:18, color:"#6b7280" },
  amountInput: { flex:1, padding:14, background:"transparent", border:"none", color:"#e8e4dc", fontSize:22, fontWeight:"bold", outline:"none", width:"100%" },
  fieldLabel: { display:"block", fontSize:11, color:"#6b7280", textTransform:"uppercase", letterSpacing:0.8, marginBottom:8, marginTop:16 },
  input: { width:"100%", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:"12px 14px", color:"#e8e4dc", fontSize:14, boxSizing:"border-box", outline:"none" },
  select: { width:"100%", background:"#1a1a24", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:"12px 14px", color:"#e8e4dc", fontSize:14, outline:"none" },
  catGrid: { display:"flex", flexWrap:"wrap", gap:8, marginBottom:4 },
  catChip: { padding:"6px 12px", borderRadius:20, border:"1px solid", cursor:"pointer", fontSize:12, display:"flex", alignItems:"center", gap:6 },
  saveBtn: { width:"100%", marginTop:20, padding:16, background:"#10b981", border:"none", borderRadius:12, color:"#fff", fontSize:16, fontWeight:"bold", cursor:"pointer" },
};
