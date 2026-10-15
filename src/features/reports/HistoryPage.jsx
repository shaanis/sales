import React,{ useEffect, useState } from "react";
import { ClipboardCopy, Download, Search, Trash2 } from "lucide-react";

import { useAuth } from "../auth/AuthProvider";
import { listRecords, deleteRecord } from "../../lib/data";
import { formatReport } from "./model";

export default function HistoryPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    listRecords(user.uid, "reports")
      .then(setItems)
      .catch(() => setNote("Could not load reports. Check Firestore rules."));
  }, [user.uid]);

  const filtered = items.filter((item) =>
    `${item.date} ${item.area} ${item.executive}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  async function copy(item) {
    try {
      await navigator.clipboard.writeText(formatReport(item));
      setNote("Report copied.");
    } catch {
      setNote("Unable to copy report.");
    }
  }

  function download(item) {
    const blob = new Blob([formatReport(item)], {
      type: "text/plain;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `sales-report-${item.date}.txt`;
    link.click();

    URL.revokeObjectURL(url);
  }

  async function remove(id) {
    if (!window.confirm("Delete this report permanently?")) return;

    try {
      await deleteRecord(user.uid, "reports", id);
      setItems((previous) => previous.filter((item) => item.id !== id));
      setNote("Report deleted.");
    } catch {
      setNote("Could not delete report.");
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">YOUR RECORDS</div>
          <h1>Report history</h1>
          <p>Search, copy, download and delete saved reports.</p>
        </div>
      </header>

      <section className="panel">
        <div className="history-top">
          <div>
            <h2>Saved reports</h2>
            <p>{filtered.length} reports found</p>
          </div>

          <div className="search">
            <Search size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search date, area or executive..."
            />
          </div>
        </div>

        {note && <div className="notice">{note}</div>}

        {!filtered.length ? (
          <div className="empty">
            No reports found. Save a daily report to see it here.
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Area / activity</th>
                  <th>Executive</th>
                  <th>PO count</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td>{item.date}</td>
                    <td>{item.area || "Daily sales report"}</td>
                    <td>{item.executive || "—"}</td>
                    <td>{item.poCount || "—"}</td>
                    <td>
                      <button className="icon-btn" title="Copy" onClick={() => copy(item)}>
                        <ClipboardCopy size={16} />
                      </button>

                      <button className="icon-btn" title="Download" onClick={() => download(item)}>
                        <Download size={16} />
                      </button>

                      <button className="icon-btn" title="Delete" onClick={() => remove(item.id)}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}