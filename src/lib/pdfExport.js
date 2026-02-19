// src/lib/pdfExport.js
// PDF generation using jsPDF + jsPDF-AutoTable

import dayjs from "dayjs";

function fmtAmt(n) {
  return "Rs. " + Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ─────────────────────────────────────────────
// LOAD jsPDF DYNAMICALLY — most reliable way in browser
// ─────────────────────────────────────────────
async function getJsPDF() {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  return { jsPDF, autoTable };
}

// ─────────────────────────────────────────────
// EXPORT ALL TRANSACTIONS AS PDF
// ─────────────────────────────────────────────
export async function exportTransactionsPDF(transactions, title = "All Transactions") {
  const { jsPDF, autoTable } = await getJsPDF();

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 42, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("SMS Ledger", 14, 16);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text(title, 14, 25);
  doc.text("Generated: " + dayjs().format("DD MMM YYYY, hh:mm A"), 14, 32);

  // Summary
  const totalCredit = transactions.filter(t => t.type === "credit").reduce((s, t) => s + t.amount, 0);
  const totalDebit = transactions.filter(t => t.type === "debit").reduce((s, t) => s + t.amount, 0);
  const net = totalCredit - totalDebit;

  const cards = [
    { label: "Total Income", value: fmtAmt(totalCredit), color: [22, 163, 74] },
    { label: "Total Spent",  value: fmtAmt(totalDebit),  color: [220, 38, 38] },
    { label: "Net Savings",  value: fmtAmt(net),          color: net >= 0 ? [22, 163, 74] : [220, 38, 38] },
    { label: "Transactions", value: String(transactions.length), color: [37, 99, 235] },
  ];

  const cardW = (pageW - 28 - 9) / 4;
  cards.forEach((card, i) => {
    const x = 14 + i * (cardW + 3);
    const y = 48;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, y, cardW, 18, 2, 2, "F");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.text(card.label.toUpperCase(), x + 3, y + 6);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...card.color);
    doc.text(card.value, x + 3, y + 13);
  });

  // Table rows
  const rows = transactions.map(tx => [
    dayjs(tx.date).format("DD-MM-YY"),
    dayjs(tx.date).format("hh:mm A"),
    tx.bank || "",
    tx.merchant || "",
    tx.category || "",
    tx.paymentMode || "",
    {
      content: (tx.type === "credit" ? "+" : "-") + Number(tx.amount).toFixed(2),
      styles: { textColor: tx.type === "credit" ? [22, 163, 74] : [220, 38, 38], fontStyle: "bold", halign: "right" }
    },
    { content: tx.balance ? Number(tx.balance).toFixed(2) : "", styles: { halign: "right" } },
  ]);

  autoTable(doc, {
    startY: 72,
    head: [["Date", "Time", "Bank", "Merchant", "Category", "Mode", "Amount", "Balance"]],
    body: rows,
    theme: "grid",
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 7, fontStyle: "bold", cellPadding: 3 },
    bodyStyles: { fontSize: 7, cellPadding: 2.5 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 18 }, 1: { cellWidth: 18 }, 2: { cellWidth: 28 },
      3: { cellWidth: 30 }, 4: { cellWidth: 22 }, 5: { cellWidth: 18 },
      6: { cellWidth: 24, halign: "right" }, 7: { cellWidth: 22, halign: "right" },
    },
    margin: { left: 14, right: 14 },
  });

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const y = doc.internal.pageSize.getHeight() - 8;
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.setFont("helvetica", "normal");
    doc.text("SMS Ledger — All data stored locally on your device", 14, y);
    doc.text("Page " + i + " of " + pageCount, pageW - 14, y, { align: "right" });
  }

  doc.save("sms_ledger_" + dayjs().format("YYYY-MM-DD") + ".pdf");
}

// ─────────────────────────────────────────────
// EXPORT CATEGORY REPORT AS PDF
// ─────────────────────────────────────────────
export async function exportCategoryPDF(categories, days = 30) {
  const { jsPDF, autoTable } = await getJsPDF();

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 42, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Category Report", 14, 16);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text("Spending breakdown — Last " + days + " days", 14, 25);
  doc.text("Generated: " + dayjs().format("DD MMM YYYY, hh:mm A"), 14, 32);

  const totalSpent = categories.reduce((s, c) => s + c.total, 0);

  doc.setFillColor(254, 242, 242);
  doc.roundedRect(14, 48, pageW - 28, 16, 2, 2, "F");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("TOTAL SPENDING", 18, 55);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(220, 38, 38);
  doc.text(fmtAmt(totalSpent), 18, 62);

  const rows = categories.map(c => {
    const pct = totalSpent > 0 ? ((c.total / totalSpent) * 100).toFixed(1) + "%" : "0%";
    return [
      (c.icon || "") + " " + (c.category || "Other"),
      { content: fmtAmt(c.total), styles: { halign: "right", textColor: [220, 38, 38], fontStyle: "bold" } },
      { content: String(c.count), styles: { halign: "center" } },
      { content: pct, styles: { halign: "center" } },
    ];
  });

  autoTable(doc, {
    startY: 70,
    head: [["Category", "Total Spent", "Transactions", "% of Total"]],
    body: rows,
    theme: "grid",
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 8, fontStyle: "bold", cellPadding: 4 },
    bodyStyles: { fontSize: 9, cellPadding: 4 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 80 }, 1: { cellWidth: 50, halign: "right" },
      2: { cellWidth: 30, halign: "center" }, 3: { cellWidth: 28, halign: "center" },
    },
    margin: { left: 14, right: 14 },
  });

  const y = doc.internal.pageSize.getHeight() - 8;
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text("SMS Ledger — All data stored locally on your device", 14, y);
  doc.save("sms_ledger_categories_" + dayjs().format("YYYY-MM-DD") + ".pdf");
}

// ─────────────────────────────────────────────
// EXPORT DAILY SUMMARY AS PDF
// ─────────────────────────────────────────────
export async function exportDailySummaryPDF(transactions) {
  const { jsPDF, autoTable } = await getJsPDF();

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  const map = {};
  for (const tx of transactions) {
    const day = tx.date.split("T")[0];
    if (!map[day]) map[day] = { date: day, credit: 0, debit: 0, count: 0 };
    if (tx.type === "credit") map[day].credit += tx.amount;
    if (tx.type === "debit") map[day].debit += tx.amount;
    map[day].count += 1;
  }
  const days = Object.values(map).sort((a, b) => b.date.localeCompare(a.date));

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 42, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Daily Summary", 14, 16);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text(days.length + " days of transactions", 14, 25);
  doc.text("Generated: " + dayjs().format("DD MMM YYYY, hh:mm A"), 14, 32);

  const rows = days.map(d => [
    dayjs(d.date).format("DD MMM YYYY"),
    dayjs(d.date).format("dddd"),
    { content: fmtAmt(d.credit), styles: { textColor: [22, 163, 74], halign: "right" } },
    { content: fmtAmt(d.debit), styles: { textColor: [220, 38, 38], halign: "right" } },
    {
      content: fmtAmt(d.credit - d.debit),
      styles: { textColor: d.credit - d.debit >= 0 ? [22, 163, 74] : [220, 38, 38], fontStyle: "bold", halign: "right" }
    },
    { content: String(d.count), styles: { halign: "center" } },
  ]);

  autoTable(doc, {
    startY: 48,
    head: [["Date", "Day", "Income", "Spent", "Net", "Txns"]],
    body: rows,
    theme: "grid",
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 8, fontStyle: "bold", cellPadding: 4 },
    bodyStyles: { fontSize: 9, cellPadding: 4 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  });

  const y = doc.internal.pageSize.getHeight() - 8;
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text("SMS Ledger — All data stored locally on your device", 14, y);
  doc.save("sms_ledger_daily_" + dayjs().format("YYYY-MM-DD") + ".pdf");
}
