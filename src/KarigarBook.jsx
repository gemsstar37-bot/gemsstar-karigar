import React, { useEffect, useState } from "react";
import {
  getKarigars,
  addKarigar,
  addMetalGivenBatch,
  createWorkItem,
  completeWorkItem,
  getMonthSummary,
  closeMonth,
  getMonthClosed,
  addPayment,
  getWorkItemsForPeriod,
  getPaymentsForPeriod,
  buildWhatsAppStatement,
} from "./karigarService";

const C = {
  navy: "#0D1B2A",
  navyL: "#162336",
  navyM: "#1E3048",
  gold: "#C9A84C",
  goldL: "#E2C97E",
  ivory: "#F8F4EC",
  muted: "#8A9BB0",
  border: "#243650",
  success: "#27AE60",
  danger: "#C0392B",
};

const TABS = ["Dashboard", "Karigars", "Batches", "Work Items", "Payments", "Monthly Summary", "Preview"];

export default function KarigarBook({ currentUser, role }) {
  const isAdmin = role === "admin";
  const [tab, setTab] = useState("Dashboard");
  const [karigars, setKarigars] = useState([]);
  const [selectedKarigarId, setSelectedKarigarId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [summary, setSummary] = useState(null);
  const [monthClosed, setMonthClosed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    refreshKarigars();
  }, []);

  useEffect(() => {
    if (selectedKarigarId) {
      refreshSummary();
    }
  }, [selectedKarigarId, selectedMonth, selectedYear]);

  async function refreshKarigars() {
    const list = await getKarigars();
    setKarigars(list);
    if (!selectedKarigarId && list.length) {
      setSelectedKarigarId(list[0].id);
    }
  }

  async function refreshSummary() {
    setLoading(true);
    const s = await getMonthSummary(selectedKarigarId, selectedMonth, selectedYear);
    setSummary(s);
    const closed = await getMonthClosed(selectedKarigarId, selectedMonth, selectedYear);
    setMonthClosed(!!closed);
    setLoading(false);
  }

  const selectedKarigar = karigars.find((k) => k.id === selectedKarigarId);

  return (
    <div style={styles.wrap}>
      <h2 style={styles.title}>Karigar Book</h2>

      <div style={styles.tabRow}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={tab === t ? styles.tabActive : styles.tab}
          >
            {t}
          </button>
        ))}
      </div>

      {selectedKarigar && (
        <div style={styles.monthSelector}>
          <label style={styles.label}>Month:</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            style={styles.select}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]}
              </option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            style={styles.select}
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <label style={{ ...styles.label, marginLeft: 16 }}>Karigar:</label>
          <select
            value={selectedKarigarId}
            onChange={(e) => setSelectedKarigarId(e.target.value)}
            style={styles.select}
          >
            {karigars.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
          {monthClosed && (
            <div style={{ ...styles.label, color: C.gold, fontWeight: 600 }}>
              ✓ Closed
            </div>
          )}
        </div>
      )}

      {tab === "Dashboard" && selectedKarigar && summary && (
        <DashboardTab summary={summary} karigar={selectedKarigar} loading={loading} isAdmin={isAdmin} />
      )}

      {tab === "Karigars" && (
        <KarigarsTab karigars={karigars} onAdd={refreshKarigars} isAdmin={isAdmin} />
      )}

      {tab === "Batches" && selectedKarigar && (
        <BatchesTab karigar={selectedKarigar} currentUser={currentUser} onSaved={refreshSummary} />
      )}

      {tab === "Work Items" && selectedKarigar && (
        <WorkItemsTab
          karigar={selectedKarigar}
          month={selectedMonth}
          year={selectedYear}
          currentUser={currentUser}
          isAdmin={isAdmin}
          onSaved={refreshSummary}
        />
      )}

      {tab === "Payments" && selectedKarigar && (
        <PaymentsTab
          karigar={selectedKarigar}
          month={selectedMonth}
          year={selectedYear}
          currentUser={currentUser}
          onSaved={refreshSummary}
        />
      )}

      {tab === "Monthly Summary" && selectedKarigar && summary && (
        <MonthlySummaryTab
          summary={summary}
          karigar={selectedKarigar}
          monthClosed={monthClosed}
          isAdmin={isAdmin}
          onClose={() => {
            closeMonth(selectedKarigarId, selectedMonth, selectedYear, summary);
            setMonthClosed(true);
          }}
        />
      )}

      {tab === "Preview" && selectedKarigar && (
        <PreviewTab karigar={selectedKarigar} month={selectedMonth} year={selectedYear} />
      )}
    </div>
  );
}

function DashboardTab({ summary, karigar, loading, isAdmin }) {
  if (loading || !summary) return <p style={styles.muted}>Loading…</p>;

  return (
    <div>
      <h3>Live Balances — {karigar.name}</h3>
      <div style={styles.balanceGrid}>
        <BalanceCard label="Gold Balance" value={`${summary.goldBalance.toFixed(3)}g`} unit="grams" highlight />
        <BalanceCard label="Labour Balance" value={`₹${summary.labourBalance.toFixed(2)}`} unit="rupees" highlight />
      </div>

      <h4 style={{ marginTop: 20 }}>This Month's Activity</h4>
      <div style={styles.statsGrid}>
        <StatCard label="Gold Given" value={`${summary.totalGoldGiven.toFixed(3)}g`} />
        <StatCard label="Gold Returned" value={`${summary.totalGoldReturned.toFixed(3)}g`} />
        <StatCard label="Wastage" value={`${summary.totalWastage.toFixed(3)}g`} />
        <StatCard label="Labour Earned" value={`₹${summary.totalMakingCharges.toFixed(2)}`} />
        <StatCard label="Payments Made" value={`₹${summary.totalPaid.toFixed(2)}`} />
        <StatCard label="Pending Items" value={summary.pendingCount} />
      </div>
    </div>
  );
}

function BalanceCard({ label, value, unit, highlight }) {
  return (
    <div style={highlight ? styles.balanceCardHighlight : styles.balanceCard}>
      <div style={styles.balanceLabel}>{label}</div>
      <div style={styles.balanceValue}>{value}</div>
      <div style={styles.balanceUnit}>{unit}</div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value}</div>
    </div>
  );
}

function KarigarsTab({ karigars, onAdd, isAdmin }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [abbreviation, setAbbreviation] = useState("");
  const [pct, setPct] = useState(10);

  async function handleAdd() {
    if (!name.trim() || !abbreviation.trim()) {
      alert("Name and abbreviation required.");
      return;
    }
    await addKarigar({ name: name.trim(), phone, abbreviation: abbreviation.trim(), defaultLabourPct: pct });
    setName("");
    setPhone("");
    setAbbreviation("");
    setPct(10);
    onAdd();
  }

  return (
    <div>
      <h3>Karigars</h3>
      <ul style={styles.list}>
        {karigars.map((k) => (
          <li key={k.id} style={styles.listItem}>
            <strong>{k.name}</strong> ({k.abbreviation}) · {k.defaultLabourPct}% labour
            {k.phone && ` · ${k.phone}`}
          </li>
        ))}
      </ul>
      {isAdmin && (
        <div style={styles.formBox}>
          <input
            placeholder="Karigar name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={styles.input}
          />
          <input
            placeholder="Abbreviation (e.g. BAL, GOP)"
            value={abbreviation}
            onChange={(e) => setAbbreviation(e.target.value.toUpperCase())}
            style={styles.input}
          />
          <input
            placeholder="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={styles.input}
          />
          <label style={styles.label}>Default labour %:</label>
          <select value={pct} onChange={(e) => setPct(Number(e.target.value))} style={styles.select}>
            {Array.from({ length: 8 }, (_, i) => 8 + i).map((p) => (
              <option key={p} value={p}>
                {p}%
              </option>
            ))}
          </select>
          <button onClick={handleAdd} style={styles.btn}>
            Add Karigar
          </button>
        </div>
      )}
    </div>
  );
}

function BatchesTab({ karigar, currentUser, onSaved }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [weight, setWeight] = useState("");
  const [rate, setRate] = useState("");

  async function handleSave() {
    if (!weight || !rate) {
      alert("Weight and rate required.");
      return;
    }
    await addMetalGivenBatch({
      karigarId: karigar.id,
      dateGiven: date,
      weightGiven: weight,
      goldRate: rate,
      enteredBy: currentUser,
    });
    setWeight("");
    setRate("");
    onSaved();
  }

  return (
    <div style={styles.formBox}>
      <h3>Record Metal Given — {karigar.name}</h3>
      <label style={styles.label}>Date:</label>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={styles.input} />
      <label style={styles.label}>Weight (grams):</label>
      <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} style={styles.input} />
      <label style={styles.label}>Gold rate (₹/gram):</label>
      <input type="number" value={rate} onChange={(e) => setRate(e.target.value)} style={styles.input} />
      <button onClick={handleSave} style={styles.btn}>
        Save Batch
      </button>
    </div>
  );
}

function WorkItemsTab({ karigar, month, year, currentUser, isAdmin, onSaved }) {
  const [items, setItems] = useState([]);
  const [desc, setDesc] = useState("");
  const [isClientOrder, setIsClientOrder] = useState(true);
  const [orderNo, setOrderNo] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [photo, setPhoto] = useState(null);

  useEffect(() => {
    refreshItems();
  }, [month, year]);

  async function refreshItems() {
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = new Date(year, month, 0).toISOString().slice(0, 10);
    const list = await getWorkItemsForPeriod(karigar.id, startDate, endDate);
    setItems(list);
  }

  async function handleCreate() {
    if (!desc.trim()) {
      alert("Description required.");
      return;
    }
    await createWorkItem({
      karigarId: karigar.id,
      itemDescription: desc,
      sketchPhotoFile: photo,
      dateGiven: date,
      isClientOrder,
      gemsstarOrderNo: orderNo,
      forStock: false,
      enteredBy: currentUser,
    });
    setDesc("");
    setOrderNo("");
    setPhoto(null);
    refreshItems();
    onSaved();
  }

  return (
    <div>
      <h3>Work Items — {karigar.name}</h3>
      <div style={styles.formBox}>
        <h4>New Item</h4>
        <label style={styles.label}>Type:</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button
            onClick={() => setIsClientOrder(true)}
            style={{
              ...styles.btnSmall,
              background: isClientOrder ? C.gold : C.navyL,
              color: isClientOrder ? C.navy : C.muted,
            }}
          >
            Client Order
          </button>
          <button
            onClick={() => setIsClientOrder(false)}
            style={{
              ...styles.btnSmall,
              background: !isClientOrder ? C.gold : C.navyL,
              color: !isClientOrder ? C.navy : C.muted,
            }}
          >
            Stock Item
          </button>
        </div>
        {isClientOrder && (
          <div>
            <label style={styles.label}>Gemsstar Order Number:</label>
            <input value={orderNo} onChange={(e) => setOrderNo(e.target.value)} style={styles.input} />
          </div>
        )}
        <label style={styles.label}>Description:</label>
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Ring lgd/B L" style={styles.input} />
        <label style={styles.label}>Date Given:</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={styles.input} />
        <label style={styles.label}>Sketch Photo:</label>
        <input type="file" accept="image/*" capture="environment" onChange={(e) => setPhoto(e.target.files[0])} style={styles.input} />
        <button onClick={handleCreate} style={styles.btn}>
          Create Item
        </button>
      </div>

      <h4 style={{ marginTop: 20 }}>Items This Month</h4>
      {items.map((item) => (
        <WorkItemRow key={item.id} item={item} karigarId={karigar.id} currentUser={currentUser} isAdmin={isAdmin} onSaved={() => { refreshItems(); onSaved(); }} />
      ))}
    </div>
  );
}

function WorkItemRow({ item, karigarId, currentUser, isAdmin, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [finalPhoto, setFinalPhoto] = useState(null);
  const [dateReturned, setDateReturned] = useState(new Date().toISOString().slice(0, 10));
  const [grossWt, setGrossWt] = useState("");
  const [stoneWt, setStoneWt] = useState("");
  const [diaWt, setDiaWt] = useState("");
  const [labourPct, setLabourPct] = useState("");

  async function handleComplete() {
    if (!grossWt) {
      alert("Gross weight required.");
      return;
    }
    await completeWorkItem({
      workItemId: item.id,
      karigarId,
      finalPhotoFile: finalPhoto,
      dateReturned,
      grossWt,
      stoneWt,
      diaWt,
      labourPctOverride: labourPct ? Number(labourPct) : null,
      enteredBy: currentUser,
    });
    setEditing(false);
    onSaved();
  }

  return (
    <div style={styles.itemRow}>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        {item.sketchPhotoUrl && <img src={item.sketchPhotoUrl} alt="sketch" style={styles.photo} />}
      </div>
      <strong>{item.orderNumber || item.itemDescription}</strong>{" "}
      <span style={item.status === "pending" ? styles.pendingTag : styles.returnedTag}>
        {item.status === "pending" ? "Pending" : "Returned"}
      </span>
      {item.gemsstarOrderNo && <div style={styles.muted}>Gemsstar: {item.gemsstarOrderNo}</div>}
      <div style={styles.muted}>Given: {item.dateGiven}</div>
      {item.status === "returned" && (
        <div style={styles.muted}>
          Net: {item.netWt}g | Making: ₹{item.makingCharge?.toFixed(2)}
        </div>
      )}

      {item.status === "pending" && !editing && (
        <button onClick={() => setEditing(true)} style={styles.btnSmall}>
          Complete & Return
        </button>
      )}

      {editing && (
        <div style={styles.formBox}>
          <label style={styles.label}>Date Returned:</label>
          <input type="date" value={dateReturned} onChange={(e) => setDateReturned(e.target.value)} style={styles.input} />
          <label style={styles.label}>Final Photo:</label>
          <input type="file" accept="image/*" capture="environment" onChange={(e) => setFinalPhoto(e.target.files[0])} style={styles.input} />
          <label style={styles.label}>Gross Weight (g):</label>
          <input type="number" value={grossWt} onChange={(e) => setGrossWt(e.target.value)} style={styles.input} />
          <label style={styles.label}>Stone Weight (g):</label>
          <input type="number" value={stoneWt} onChange={(e) => setStoneWt(e.target.value)} style={styles.input} />
          <label style={styles.label}>Diamond Weight (g):</label>
          <input type="number" value={diaWt} onChange={(e) => setDiaWt(e.target.value)} style={styles.input} />
          {isAdmin && (
            <>
              <label style={styles.label}>Labour % override:</label>
              <select value={labourPct} onChange={(e) => setLabourPct(e.target.value)} style={styles.select}>
                <option value="">Use default</option>
                {Array.from({ length: 8 }, (_, i) => 8 + i).map((p) => (
                  <option key={p} value={p}>
                    {p}%
                  </option>
                ))}
              </select>
            </>
          )}
          <button onClick={handleComplete} style={styles.btn}>
            Save Return
          </button>
        </div>
      )}
    </div>
  );
}

function PaymentsTab({ karigar, month, year, currentUser, onSaved }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");

  async function handleSave() {
    if (!amount) {
      alert("Amount required.");
      return;
    }
    await addPayment({ karigarId: karigar.id, amount, date, note, enteredBy: currentUser });
    setAmount("");
    setNote("");
    onSaved();
  }

  return (
    <div style={styles.formBox}>
      <h3>Record Payment — {karigar.name}</h3>
      <label style={styles.label}>Amount (₹):</label>
      <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} style={styles.input} />
      <label style={styles.label}>Date:</label>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={styles.input} />
      <label style={styles.label}>Note:</label>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" style={styles.input} />
      <button onClick={handleSave} style={styles.btn}>
        Record Payment
      </button>
    </div>
  );
}

function MonthlySummaryTab({ summary, karigar, monthClosed, isAdmin, onClose }) {
  const monthStr = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][summary.month - 1];
  const waLink = karigar.phone
    ? buildWhatsAppStatement(karigar.name, karigar.phone, summary)
    : null;

  return (
    <div>
      <h3>
        {monthStr} {summary.year} — {karigar.name}
      </h3>

      <div style={styles.summarySection}>
        <h4>📊 Summary</h4>
        <div style={styles.summaryGrid}>
          <SummaryCard label="Opening Gold" value={`${summary.openingBalance.goldGrams.toFixed(3)}g`} />
          <SummaryCard label="Gold Given" value={`${summary.totalGoldGiven.toFixed(3)}g`} />
          <SummaryCard label="Gold Returned" value={`${summary.totalGoldReturned.toFixed(3)}g`} />
          <SummaryCard label="Wastage" value={`${summary.totalWastage.toFixed(3)}g`} />
          <SummaryCard label="Closing Gold" value={`${summary.goldBalance.toFixed(3)}g`} highlight />
        </div>

        <div style={styles.summaryGrid}>
          <SummaryCard label="Opening Labour" value={`₹${summary.openingBalance.labourRupees.toFixed(2)}`} />
          <SummaryCard label="Labour Earned" value={`₹${summary.totalMakingCharges.toFixed(2)}`} />
          <SummaryCard label="Payments Made" value={`₹${summary.totalPaid.toFixed(2)}`} />
          <SummaryCard label="Closing Labour" value={`₹${summary.labourBalance.toFixed(2)}`} highlight />
        </div>
      </div>

      <div style={styles.summarySection}>
        <h4>📋 Details</h4>
        <div style={styles.detailsTable}>
          {summary.workItems.filter((w) => w.status === "returned").map((item, i) => (
            <div key={item.id} style={styles.detailRow}>
              <div style={styles.detailPhoto}>
                {item.finalPhotoUrl && (
                  <img src={item.finalPhotoUrl} alt="item" style={{ width: 40, height: 40, borderRadius: 4, objectFit: "cover" }} />
                )}
              </div>
              <div style={styles.detailInfo}>
                <div>{item.orderNumber || item.itemDescription}</div>
                <div style={styles.muted}>{item.dateReturned}</div>
              </div>
              <div style={styles.detailValues}>
                <div>{item.netWt}g</div>
                <div style={{ color: C.gold }}>₹{item.makingCharge?.toFixed(2)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={styles.summarySection}>
        <h4>🔗 Actions</h4>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {waLink && (
            <a href={waLink} target="_blank" rel="noopener noreferrer" style={styles.btn}>
              📱 WhatsApp Statement
            </a>
          )}
          <button
            onClick={() => window.print()}
            style={{ ...styles.btn, background: C.navyM, border: `1px solid ${C.border}`, color: C.muted }}
          >
            🖨 Print Statement
          </button>
          {isAdmin && !monthClosed && (
            <button onClick={onClose} style={{ ...styles.btn, background: C.success }}>
              ✓ Close Month
            </button>
          )}
          {monthClosed && <span style={{ ...styles.btn, background: C.navyL, color: C.gold }}>✓ Closed</span>}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, highlight }) {
  return (
    <div style={highlight ? styles.cardHighlight : styles.card}>
      <div style={styles.cardLabel}>{label}</div>
      <div style={styles.cardValue}>{value}</div>
    </div>
  );
}

function PreviewTab({ karigar, month, year }) {
  const [items, setItems] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    async function load() {
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endDate = new Date(year, month, 0).toISOString().slice(0, 10);
      const list = await getWorkItemsForPeriod(karigar.id, startDate, endDate);
      setItems(list);
    }
    load();
  }, [month, year]);

  if (items.length === 0) {
    return <p style={styles.muted}>No items this month.</p>;
  }

  const item = items[currentIndex];

  return (
    <div style={styles.previewContainer}>
      <h3>Flip-Book Preview — {karigar.name}</h3>
      <div style={styles.flipBook}>
        <div style={styles.flipImage}>
          {item.finalPhotoUrl ? (
            <img src={item.finalPhotoUrl} alt="final" style={{ maxWidth: "100%", maxHeight: 300 }} />
          ) : item.sketchPhotoUrl ? (
            <img src={item.sketchPhotoUrl} alt="sketch" style={{ maxWidth: "100%", maxHeight: 300 }} />
          ) : (
            <div style={{ color: C.muted }}>No image</div>
          )}
        </div>
        <div style={styles.flipDetails}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{item.orderNumber || item.itemDescription}</div>
          <div style={styles.muted}>Given: {item.dateGiven}</div>
          {item.dateReturned && <div style={styles.muted}>Returned: {item.dateReturned}</div>}
          <div style={styles.muted}>Status: {item.status}</div>
          {item.netWt && <div style={{ marginTop: 8 }}>Net Weight: {item.netWt}g</div>}
          {item.makingCharge && <div style={{ color: C.gold }}>Making Charge: ₹{item.makingCharge.toFixed(2)}</div>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "center" }}>
        <button
          onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
          style={styles.btn}
        >
          ← Previous
        </button>
        <span style={styles.muted}>
          {currentIndex + 1} / {items.length}
        </span>
        <button
          onClick={() => setCurrentIndex(Math.min(items.length - 1, currentIndex + 1))}
          disabled={currentIndex === items.length - 1}
          style={styles.btn}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

const styles = {
  wrap: { padding: 12, fontFamily: "system-ui, sans-serif", maxWidth: 600, margin: "0 auto" },
  title: { marginBottom: 8, color: C.gold },
  tabRow: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  tab: { padding: "6px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.navyL, color: C.muted, fontSize: 12 },
  tabActive: { padding: "6px 10px", borderRadius: 8, border: `1px solid ${C.gold}`, background: C.gold, color: C.navy, fontSize: 12, fontWeight: 600 },
  monthSelector: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12, padding: 8, background: C.navyL, borderRadius: 8 },
  label: { fontSize: 12, color: C.muted, marginTop: 8, display: "block" },
  select: { padding: 6, borderRadius: 6, border: `1px solid ${C.border}`, background: C.navyL, color: C.ivory, fontSize: 12 },
  input: { padding: 8, borderRadius: 6, border: `1px solid ${C.border}`, background: C.navyL, color: C.ivory, width: "100%", boxSizing: "border-box", marginBottom: 4, fontSize: 12 },
  btn: { marginTop: 10, padding: "10px 16px", borderRadius: 8, border: "none", background: C.gold, color: C.navy, fontWeight: 600, display: "inline-block", cursor: "pointer", fontSize: 12 },
  btnSmall: { padding: "6px 10px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.navyL, color: C.muted, fontSize: 12, cursor: "pointer" },
  formBox: { border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, marginBottom: 14, background: C.navyL },
  list: { listStyle: "none", padding: 0 },
  listItem: { padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontSize: 12 },
  itemRow: { border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, marginBottom: 10, background: C.navyL },
  photo: { width: 60, height: 60, borderRadius: 6, objectFit: "cover", border: `1px solid ${C.border}` },
  pendingTag: { background: "#fff3cd", color: "#856404", fontSize: 11, padding: "2px 6px", borderRadius: 6, marginLeft: 6 },
  returnedTag: { background: "#d4edda", color: "#155724", fontSize: 11, padding: "2px 6px", borderRadius: 6, marginLeft: 6 },
  muted: { fontSize: 12, color: C.muted },
  balanceGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 },
  balanceCard: { border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, background: C.navyL },
  balanceCardHighlight: { border: `1px solid ${C.gold}`, background: `${C.gold}20`, borderRadius: 10, padding: 12 },
  balanceLabel: { fontSize: 11, color: C.muted, textTransform: "uppercase" },
  balanceValue: { fontSize: 18, fontWeight: 700, color: C.gold, marginTop: 4 },
  balanceUnit: { fontSize: 10, color: C.muted, marginTop: 2 },
  statsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  statCard: { border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, background: C.navyL },
  statLabel: { fontSize: 10, color: C.muted },
  statValue: { fontSize: 14, fontWeight: 600, marginTop: 4 },
  card: { border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, background: C.navyL },
  cardHighlight: { border: `1px solid ${C.gold}`, background: `${C.gold}20`, borderRadius: 10, padding: 10 },
  cardLabel: { fontSize: 11, color: C.muted },
  cardValue: { fontSize: 16, fontWeight: 700, marginTop: 4, color: C.gold },
  summarySection: { marginBottom: 20 },
  summaryGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 },
  detailsTable: { display: "flex", flexDirection: "column", gap: 8 },
  detailRow: { display: "flex", gap: 8, padding: 8, background: C.navyL, borderRadius: 8, alignItems: "center" },
  detailPhoto: { flexShrink: 0 },
  detailInfo: { flex: 1 },
  detailValues: { textAlign: "right", fontSize: 12 },
  previewContainer: { padding: 12 },
  flipBook: { background: C.navyL, borderRadius: 10, border: `1px solid ${C.border}`, padding: 16, marginBottom: 16, display: "flex", flexDirection: "column", alignItems: "center" },
  flipImage: { marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", width: "100%" },
  flipDetails: { width: "100%", fontSize: 12 },
};
