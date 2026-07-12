import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { exportToCsv } from "./csv";

export function exportToXlsx(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, filename);
}

export function exportToPdf(
  filename: string,
  title: string,
  rows: Record<string, unknown>[],
) {
  if (!rows.length) return;
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.setTextColor("#c48a3a");
  doc.text("Sri Surya Group — " + title, 14, 16);
  doc.setFontSize(9);
  doc.setTextColor("#666");
  doc.text(new Date().toLocaleString(), 14, 22);
  const headers = Object.keys(rows[0]);
  autoTable(doc, {
    startY: 28,
    head: [headers],
    body: rows.map((r) => headers.map((h) => (r[h] == null ? "" : String(r[h])))),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [196, 138, 58] },
  });
  doc.save(filename);
}

export { exportToCsv };
