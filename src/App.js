import React, { useState, useEffect, useRef } from "react";
import { db, storage } from "./firebase";
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, serverTimestamp
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// ---------------- THEME (warm cream/gold — deliberately different from Orders' dark navy) ----------------
const C = {
  cream: "#FBF6EC",
  creamL: "#FFFDF8",
  card: "#FFFFFF",
  gold: "#B8860B",
  goldD: "#8B6508",
  goldL: "#E8C468",
  ink: "#3A2F1E",
  muted: "#8A7A5C",
  border: "#E5D9BE",
  danger: "#B23B3B",
  success: "#3E7A4C",
  warning: "#C07A28",
  wa: "#25D366",
};

const ENTRY_USERS = ["Gary", "Nitin", "Kiran"];

const GEM_TYPES = [
  "Ceylon Sapphire (Blue)", "Ceylon Sapphire (Pink)", "Blue Sapphire", "Pink Sapphire", "Yellow Sapphire",
  "Ruby (Burmese)", "Ruby (Mozambique)", "Ruby (Thai)",
  "Emerald (Colombian)", "Emerald (Zambian)", "Tanzanite",
  "Tsavorite Garnet", "Demantoid Garnet", "Paraiba Tourmaline", "Pink Tourmaline", "Green Tourmaline",
  "Aquamarine", "Morganite", "Red Spinel", "Pink Spinel", "Alexandrite",
  "Imperial Topaz", "Blue Topaz", "South Sea Pearl", "Tahitian Pearl", "Freshwater Pearl",
  "Black Opal", "White Opal", "Amethyst", "Citrine", "Jade (Jadeite)", "Turquoise", "Other / Manual",
];

function loadKarigarDefaults() {
  try { return JSON.parse(localStorage.getItem("gkb-karigar-defaults")) || {}; }
  catch { return {}; }
}
function saveKarigarDefaults(d) { try { localStorage.setItem("gkb-karigar-defaults", JSON.stringify(d)); } catch {} }

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const todayISO = () => new Date().toISOString().slice(0, 10);
const num = (v) => parseFloat(v) || 0;
const fmt2 = (v) => (v || v === 0 ? Number(v).toFixed(2) : "0.00");
const fmt3 = (v) => (v || v === 0 ? Number(v).toFixed(3) : "0.000");

const DEFAULT_KARIGARS = {
  "Balram": { labourPct: 10, purity14: 0.585, purity18: 0.750, phone: "" },
  "Gopal": { labourPct: 9, purity14: 0.590, purity18: 0.750, phone: "" },
};

function purityFor(karigarDefaults, karigarName, karat) {
  const d = karigarDefaults[karigarName];
  if (!d) return karat === 18 ? 0.750 : 0.585;
  return karat === 18 ? d.purity18 : d.purity14;
}

const iBase = { width: "100%", boxSizing: "border-box", background: C.creamL, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", color: C.ink, fontSize: 14, outline: "none", fontFamily: "inherit" };
function Lbl({ c, req }) { return <label style={{ display: "block", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: C.muted, marginBottom: 4, fontWeight: 600 }}>{c}{req && <span style={{ color: C.gold, marginLeft: 3 }}>*</span>}</label>; }
function Inp({ v, on, ph, type = "text", s = {} }) {
  return <input type={type} value={v ?? ""} placeholder={ph} onChange={(e) => on(e.target.value)} style={{ ...iBase, ...s }} />;
}
function Sel({ v, on, opts, ph }) {
  return (
    <select value={v || ""} onChange={(e) => on(e.target.value)} style={{ ...iBase, color: v ? C.ink : C.muted }}>
      <option value="">{ph || "Select…"}</option>
      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
function Btn({ children, onClick, kind = "primary", small, disabled }) {
  const styles = {
    primary: { background: C.gold, color: "#fff", border: "none" },
    outline: { background: "transparent", color: C.gold, border: `1.5px solid ${C.gold}` },
    danger: { background: "transparent", color: C.danger, border: `1px solid ${C.danger}80` },
    success: { background: C.success, color: "#fff", border: "none" },
  };
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ ...styles[kind], borderRadius: 8, padding: small ? "7px 12px" : "11px 18px", fontWeight: 700, fontSize: small ? 12 : 14, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1 }}>
      {children}
    </button>
  );
}
function Card({ children, style = {} }) {
  return <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, ...style }}>{children}</div>;
}
function SecH({ children }) {
  return <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: C.gold, fontWeight: 700, margin: "18px 0 10px" }}>{children}</div>;
}

async function uploadPhoto(file, folder) {
  const filename = `${folder}/${Date.now()}_${file.name}`;
  const r = ref(storage, filename);
  await uploadBytes(r, file);
  return getDownloadURL(r);
}

function PhotoUpload({ label, value, onChange }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadPhoto(file, "karigar-photos");
      onChange(url);
    } catch (err) {
      alert("Photo upload failed. Check connection and try again.");
    }
    setUploading(false);
  }
  return (
    <div>
      <Lbl c={label} />
      <div onClick={() => fileRef.current?.click()}
        style={{ border: `2px dashed ${value ? C.gold : C.border}`, borderRadius: 10, minHeight: 130, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", background: C.creamL, position: "relative" }}>
        {uploading ? (
          <div style={{ color: C.gold, fontSize: 13 }}>Uploading…</div>
        ) : value ? (
          <>
            <img src={value} alt="" style={{ maxWidth: "100%", maxHeight: 180, objectFit: "contain" }} />
            <div style={{ position: "absolute", bottom: 6, right: 6, background: "rgba(0,0,0,0.5)", borderRadius: 4, padding: "2px 8px", fontSize: 10, color: "#fff" }}>Tap to replace</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 26, marginBottom: 4 }}>📷</div>
            <div style={{ color: C.gold, fontWeight: 600, fontSize: 12 }}>Tap to add photo</div>
          </>
        )}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: "none" }} />
      </div>
    </div>
  );
}

function newBatch() {
  return {
    id: uid(),
    karigarName: "",
    dateGiven: todayISO(),
    goldGrams: "",
    goldRate: "",
    stonesIssued: [],
    diamondsIssued: [],
    stonesReturned: false,
    items: [],
    enteredBy: "",
    createdAt: null,
  };
}

export default function App() {
  const [view, setView] = useState("dashboard");
  const [batches, setBatches] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const [form, setForm] = useState(null);
  const [currentUser, setCurrentUser] = useState(ENTRY_USERS[0]);
  const [karigarDefaults, setKarigarDefaults] = useState(() => {
    const stored = loadKarigarDefaults();
    return Object.keys(stored).length ? stored : DEFAULT_KARIGARS;
  });
  const [selectedKarigarFilter, setSelectedKarigarFilter] = useState("");

  useEffect(() => {
    const q1 = query(collection(db, "karigarBatches"), orderBy("createdAt", "desc"));
    const unsub1 = onSnapshot(q1, (snap) => {
      setBatches(snap.docs.map((d) => ({ ...d.data(), firebaseId: d.id })));
      setLoading(false);
    }, () => setLoading(false));

    const q2 = query(collection(db, "karigarPayments"), orderBy("date", "desc"));
    const unsub2 = onSnapshot(q2, (snap) => {
      setPayments(snap.docs.map((d) => ({ ...d.data(), firebaseId: d.id })));
    });

    return () => { unsub1(); unsub2(); };
  }, []);

  const karigarNames = Object.keys(karigarDefaults);

  function updateKarigarDefault(name, field, value) {
    setKarigarDefaults((prev) => {
      const next = { ...prev, [name]: { ...prev[name], [field]: value } };
      saveKarigarDefaults(next);
      return next;
    });
  }
  function addKarigarName(name) {
    if (!name.trim() || karigarDefaults[name.trim()]) return;
    setKarigarDefaults((prev) => {
      const next = { ...prev, [name.trim()]: { labourPct: 10, purity14: 0.585, purity18: 0.750, phone: "" } };
      saveKarigarDefaults(next);
      return next;
    });
  }

  function openNewBatch() {
    const b = newBatch();
    b.enteredBy = currentUser;
    setForm(b);
    setView("batchForm");
  }
  function openEditBatch(batch) {
    setForm({ ...batch });
    setView("batchForm");
  }
  async function saveBatch() {
    if (!form.karigarName) { alert("Select a karigar."); return; }
    if (!form.goldGrams) { alert("Enter gold grams given."); return; }
    if (!form.goldRate) { alert("Enter gold rate for the day."); return; }
    try {
      const { firebaseId, ...data } = form;
      if (firebaseId) {
        await updateDoc(doc(db, "karigarBatches", firebaseId), data);
      } else {
        await addDoc(collection(db, "karigarBatches"), { ...data, createdAt: serverTimestamp() });
      }
      setView("dashboard");
      setForm(null);
    } catch (e) {
      alert("Error saving batch. Check connection.");
      console.error(e);
    }
  }
  async function deleteBatch(fid) {
    if (!window.confirm("Delete this batch permanently? This cannot be undone.")) return;
    try { await deleteDoc(doc(db, "karigarBatches", fid)); setView("dashboard"); }
    catch { alert("Error deleting."); }
  }

  function addItem() {
    setForm((f) => ({
      ...f, items: [...f.items, {
        id: uid(), description: "", sketchPhoto: "", status: "pending",
        finalPhoto: "", dateReturned: "", karat: 14, grossWt: "", stoneWt: "", diaWt: "", netWt: 0, pureGold: 0, labourCharge: 0,
      }]
    }));
  }
  function updateItem(itemId, field, value) {
    setForm((f) => ({
      ...f, items: f.items.map((it) => it.id === itemId ? { ...it, [field]: value } : it)
    }));
  }
  function completeItem(itemId) {
    setForm((f) => ({
      ...f, items: f.items.map((it) => {
        if (it.id !== itemId) return it;
        const gross = num(it.grossWt), stone = num(it.stoneWt), dia = num(it.diaWt);
        const netWt = Math.max(0, gross - stone - dia);
        const karat = Number(it.karat) || 14;
        const purity = purityFor(karigarDefaults, f.karigarName, karat);
        const pureGold = netWt * purity;
        const labourPct = karigarDefaults[f.karigarName]?.labourPct ?? 10;
        const labourCharge = netWt * (labourPct / 100) * num(f.goldRate);
        return { ...it, status: "returned", netWt: Math.round(netWt * 1000) / 1000, pureGold: Math.round(pureGold * 1000) / 1000, labourCharge: Math.round(labourCharge * 100) / 100 };
      })
    }));
  }
  function removeItem(itemId) {
    setForm((f) => ({ ...f, items: f.items.filter((it) => it.id !== itemId) }));
  }

  function addStoneIssued() {
    setForm((f) => ({ ...f, stonesIssued: [...f.stonesIssued, { gemType: "", customType: "", count: "", weight: "" }] }));
  }
  function updateStoneIssued(i, field, value) {
    setForm((f) => { const arr = [...f.stonesIssued]; arr[i] = { ...arr[i], [field]: value }; return { ...f, stonesIssued: arr }; });
  }
  function removeStoneIssued(i) {
    setForm((f) => ({ ...f, stonesIssued: f.stonesIssued.filter((_, j) => j !== i) }));
  }
  function addDiamondIssued() {
    setForm((f) => ({ ...f, diamondsIssued: [...f.diamondsIssued, { kind: "natural", count: "", weight: "" }] }));
  }
  function updateDiamondIssued(i, field, value) {
    setForm((f) => { const arr = [...f.diamondsIssued]; arr[i] = { ...arr[i], [field]: value }; return { ...f, diamondsIssued: arr }; });
  }
  function removeDiamondIssued(i) {
    setForm((f) => ({ ...f, diamondsIssued: f.diamondsIssued.filter((_, j) => j !== i) }));
  }

  async function addPayment(karigarName, amount, note) {
    if (!amount) return;
    try {
      await addDoc(collection(db, "karigarPayments"), {
        karigarName, amount: num(amount), note: note || "", date: todayISO(), enteredBy: currentUser, createdAt: serverTimestamp(),
      });
    } catch { alert("Error saving payment."); }
  }

  function karigarSummary(karigarName) {
    const kBatches = batches.filter((b) => b.karigarName === karigarName);
    let goldGiven = 0, pureGoldReturned = 0, labourEarned = 0, pendingCount = 0;
    let stonesIssuedWt = 0, diamondsIssuedWt = 0;
    let stonesUsedWt = 0, diamondsUsedWt = 0;

    kBatches.forEach((b) => {
      goldGiven += num(b.goldGrams);
      (b.stonesIssued || []).forEach((s) => { stonesIssuedWt += num(s.weight); });
      (b.diamondsIssued || []).forEach((d) => { diamondsIssuedWt += num(d.weight); });
      (b.items || []).forEach((it) => {
        if (it.status === "returned") {
          pureGoldReturned += num(it.pureGold);
          labourEarned += num(it.labourCharge);
          stonesUsedWt += num(it.stoneWt);
          diamondsUsedWt += num(it.diaWt);
        } else {
          pendingCount += 1;
        }
      });
    });

    const goldBalance = Math.round((goldGiven - pureGoldReturned) * 1000) / 1000;
    const stonesBalance = kBatches.some(b => !b.stonesReturned) ? Math.max(0, Math.round((stonesIssuedWt - stonesUsedWt) * 1000) / 1000) : 0;
    const diamondsBalance = kBatches.some(b => !b.stonesReturned) ? Math.max(0, Math.round((diamondsIssuedWt - diamondsUsedWt) * 1000) / 1000) : 0;
    const totalPaid = payments.filter((p) => p.karigarName === karigarName).reduce((s, p) => s + num(p.amount), 0);
    const netPayable = Math.round((labourEarned - totalPaid) * 100) / 100;

    return { goldGiven, pureGoldReturned, goldBalance, labourEarned, totalPaid, netPayable, pendingCount, stonesBalance, diamondsBalance };
  }

  function buildWaLink(karigarName) {
    const s = karigarSummary(karigarName);
    const phone = karigarDefaults[karigarName]?.phone || "";
    const clean = phone.replace(/[^0-9]/g, "");
    const msg =
"Gemsstar Karigar Book - Balance Update\n" +
karigarName + "\n\n" +
"Gold balance with you: " + fmt3(s.goldBalance) + "g\n" +
"Items pending return: " + s.pendingCount + "\n" +
"Labour earned: Rs." + fmt2(s.labourEarned) + "\n" +
"Paid so far: Rs." + fmt2(s.totalPaid) + "\n" +
"Net payable: Rs." + fmt2(s.netPayable);
    return "https://wa.me/" + clean + "?text=" + encodeURIComponent(msg);
  }

  if (view === "karigars") {
    return (
      <Shell view={view} setView={setView} currentUser={currentUser} setCurrentUser={setCurrentUser}>
        <SecH>Manage Karigars</SecH>
        {karigarNames.map((name) => (
          <Card key={name} style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>{name}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div><Lbl c="Labour %" /><Inp type="number" v={karigarDefaults[name].labourPct} on={(v) => updateKarigarDefault(name, "labourPct", Number(v))} /></div>
              <div><Lbl c="WhatsApp Phone" /><Inp v={karigarDefaults[name].phone} on={(v) => updateKarigarDefault(name, "phone", v)} ph="91XXXXXXXXXX" /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div><Lbl c="14K Purity Factor" /><Inp type="number" v={karigarDefaults[name].purity14} on={(v) => updateKarigarDefault(name, "purity14", Number(v))} /></div>
              <div><Lbl c="18K Purity Factor" /><Inp type="number" v={karigarDefaults[name].purity18} on={(v) => updateKarigarDefault(name, "purity18", Number(v))} /></div>
            </div>
          </Card>
        ))}
        <Card>
          <Lbl c="Add New Karigar" />
          <NewKarigarForm onAdd={addKarigarName} />
        </Card>
      </Shell>
    );
  }

  if (view === "payments") {
    return (
      <Shell view={view} setView={setView} currentUser={currentUser} setCurrentUser={setCurrentUser}>
        <SecH>Record Payment / Advance</SecH>
        <PaymentForm karigarNames={karigarNames} onSave={addPayment} />
        <SecH>Recent Payments</SecH>
        {payments.slice(0, 20).map((p) => (
          <Card key={p.firebaseId} style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div><strong>{p.karigarName}</strong><div style={{ fontSize: 12, color: C.muted }}>{p.date} by {p.enteredBy}</div></div>
              <div style={{ fontWeight: 700, color: C.gold }}>Rs.{fmt2(p.amount)}</div>
            </div>
            {p.note && <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{p.note}</div>}
          </Card>
        ))}
      </Shell>
    );
  }

  if (view === "batchDetail") {
    const batch = batches.find((b) => b.firebaseId === selectedBatchId);
    if (!batch) { setView("dashboard"); return null; }
    return (
      <Shell view={view} setView={setView} currentUser={currentUser} setCurrentUser={setCurrentUser} onBack={() => setView("dashboard")}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{batch.karigarName}</div>
            <div style={{ fontSize: 12, color: C.muted }}>Batch given {batch.dateGiven} - Rate Rs.{batch.goldRate}/g - by {batch.enteredBy}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn kind="outline" small onClick={() => openEditBatch(batch)}>Edit</Btn>
            <Btn kind="danger" small onClick={() => deleteBatch(batch.firebaseId)}>Delete</Btn>
          </div>
        </div>

        <Card style={{ marginBottom: 14 }}>
          <SecH>Gold Issued</SecH>
          <div style={{ fontSize: 15 }}>{batch.goldGrams}g (24K) at Rs.{batch.goldRate}/g</div>
        </Card>

        {(batch.stonesIssued?.length > 0 || batch.diamondsIssued?.length > 0) && (
          <Card style={{ marginBottom: 14 }}>
            <SecH>Stones / Diamonds Issued</SecH>
            {batch.stonesIssued?.map((s, i) => (
              <div key={i} style={{ fontSize: 13, marginBottom: 4 }}>{s.gemType === "Other / Manual" ? s.customType : s.gemType} - {s.count}pcs, {s.weight}ct</div>
            ))}
            {batch.diamondsIssued?.map((d, i) => (
              <div key={i} style={{ fontSize: 13, marginBottom: 4 }}>{d.kind === "natural" ? "Natural" : "Lab Grown"} Diamonds - {d.count}pcs, {d.weight}ct</div>
            ))}
            <div style={{ marginTop: 8 }}>
              {batch.stonesReturned ? (
                <span style={{ fontSize: 12, background: "#E8F5E9", color: C.success, padding: "4px 10px", borderRadius: 6, fontWeight: 600 }}>Stones Returned - Balance Cleared</span>
              ) : (
                <Btn kind="success" small onClick={async () => { await updateDoc(doc(db, "karigarBatches", batch.firebaseId), { stonesReturned: true }); }}>
                  Mark All Stones Returned
                </Btn>
              )}
            </div>
          </Card>
        )}

        <SecH>Items in This Batch</SecH>
        {batch.items?.map((it) => (
          <Card key={it.id} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ display: "flex", gap: 6 }}>
                {it.sketchPhoto && <img src={it.sketchPhoto} alt="sketch" style={{ width: 56, height: 56, borderRadius: 6, objectFit: "cover", border: "1px solid " + C.border }} />}
                {it.finalPhoto && <img src={it.finalPhoto} alt="final" style={{ width: 56, height: 56, borderRadius: 6, objectFit: "cover", border: "1px solid " + C.border }} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{it.description || "(item)"}</div>
                <span style={{ fontSize: 11, background: it.status === "pending" ? "#FFF3CD" : "#E8F5E9", color: it.status === "pending" ? "#856404" : C.success, padding: "2px 8px", borderRadius: 6, fontWeight: 600 }}>
                  {it.status === "pending" ? "With Karigar" : "Returned"}
                </span>
                {it.status === "returned" && (
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
                    Net: {it.netWt}g ({it.karat}K) - Pure gold used: {fmt3(it.pureGold)}g - Labour: Rs.{fmt2(it.labourCharge)}
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}

        <div style={{ marginTop: 20 }}>
          <a href={buildWaLink(batch.karigarName)} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
            <Btn kind="outline">Send {batch.karigarName} WhatsApp Balance</Btn>
          </a>
        </div>
      </Shell>
    );
  }

  if (view === "batchForm" && form) {
    const summary = form.karigarName ? karigarSummary(form.karigarName) : null;
    return (
      <Shell view={view} setView={setView} currentUser={currentUser} setCurrentUser={setCurrentUser} onBack={() => { setView("dashboard"); setForm(null); }}>
        <SecH>{form.firebaseId ? "Edit Batch" : "New Batch - Issue Work to Karigar"}</SecH>

        <Card style={{ marginBottom: 14 }}>
          <div style={{ marginBottom: 10 }}><Lbl c="Karigar" req /><Sel v={form.karigarName} on={(v) => setForm((f) => ({ ...f, karigarName: v }))} opts={karigarNames} ph="Select karigar..." /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div><Lbl c="Date Given" /><Inp type="date" v={form.dateGiven} on={(v) => setForm((f) => ({ ...f, dateGiven: v }))} /></div>
            <div><Lbl c="Entered By" /><Sel v={form.enteredBy} on={(v) => setForm((f) => ({ ...f, enteredBy: v }))} opts={ENTRY_USERS} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><Lbl c="Gold Given (grams, 24K)" req /><Inp type="number" v={form.goldGrams} on={(v) => setForm((f) => ({ ...f, goldGrams: v }))} ph="20" /></div>
            <div><Lbl c="Gold Rate Today (Rs./gram)" req /><Inp type="number" v={form.goldRate} on={(v) => setForm((f) => ({ ...f, goldRate: v }))} ph="14500" /></div>
          </div>
        </Card>

        <Card style={{ marginBottom: 14 }}>
          <SecH>Stones Issued (optional)</SecH>
          {form.stonesIssued.map((s, i) => (
            <div key={i} style={{ border: "1px solid " + C.border, borderRadius: 8, padding: 10, marginBottom: 8 }}>
              <div style={{ marginBottom: 8 }}><Sel v={s.gemType} on={(v) => updateStoneIssued(i, "gemType", v)} opts={GEM_TYPES} ph="Gem type..." /></div>
              {s.gemType === "Other / Manual" && <div style={{ marginBottom: 8 }}><Inp v={s.customType} on={(v) => updateStoneIssued(i, "customType", v)} ph="Type gem name" /></div>}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "end" }}>
                <div><Lbl c="Count" /><Inp type="number" v={s.count} on={(v) => updateStoneIssued(i, "count", v)} /></div>
                <div><Lbl c="Weight (ct)" /><Inp type="number" v={s.weight} on={(v) => updateStoneIssued(i, "weight", v)} /></div>
                <Btn kind="danger" small onClick={() => removeStoneIssued(i)}>X</Btn>
              </div>
            </div>
          ))}
          <Btn kind="outline" small onClick={addStoneIssued}>+ Add Stone</Btn>

          <div style={{ marginTop: 16 }}>
            <SecH>Diamonds Issued (optional)</SecH>
            {form.diamondsIssued.map((d, i) => (
              <div key={i} style={{ border: "1px solid " + C.border, borderRadius: 8, padding: 10, marginBottom: 8 }}>
                <div style={{ marginBottom: 8, display: "flex", gap: 8 }}>
                  <Btn kind={d.kind === "natural" ? "primary" : "outline"} small onClick={() => updateDiamondIssued(i, "kind", "natural")}>Natural</Btn>
                  <Btn kind={d.kind === "labgrown" ? "primary" : "outline"} small onClick={() => updateDiamondIssued(i, "kind", "labgrown")}>Lab Grown</Btn>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "end" }}>
                  <div><Lbl c="Count" /><Inp type="number" v={d.count} on={(v) => updateDiamondIssued(i, "count", v)} /></div>
                  <div><Lbl c="Weight (ct)" /><Inp type="number" v={d.weight} on={(v) => updateDiamondIssued(i, "weight", v)} /></div>
                  <Btn kind="danger" small onClick={() => removeDiamondIssued(i)}>X</Btn>
                </div>
              </div>
            ))}
            <Btn kind="outline" small onClick={addDiamondIssued}>+ Add Diamonds</Btn>
          </div>
        </Card>

        <SecH>Items to Make</SecH>
        {form.items.map((it) => (
          <Card key={it.id} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 11, background: it.status === "pending" ? "#FFF3CD" : "#E8F5E9", color: it.status === "pending" ? "#856404" : C.success, padding: "2px 8px", borderRadius: 6, fontWeight: 600 }}>
                {it.status === "pending" ? "With Karigar" : "Returned"}
              </span>
              <Btn kind="danger" small onClick={() => removeItem(it.id)}>Remove Item</Btn>
            </div>
            <div style={{ marginBottom: 10 }}><Lbl c="Item Description" /><Inp v={it.description} on={(v) => updateItem(it.id, "description", v)} ph="e.g. Ring with Blue Sapphire" /></div>
            <div style={{ marginBottom: 10 }}><PhotoUpload label="Sketch Photo" value={it.sketchPhoto} onChange={(v) => updateItem(it.id, "sketchPhoto", v)} /></div>

            {it.status === "pending" ? (
              <div style={{ marginTop: 10, borderTop: "1px dashed " + C.border, paddingTop: 10 }}>
                <div style={{ fontSize: 11, color: C.gold, fontWeight: 700, marginBottom: 8 }}>MARK AS RETURNED FROM KARIGAR</div>
                <div style={{ marginBottom: 10 }}><PhotoUpload label="Finished Piece Photo" value={it.finalPhoto} onChange={(v) => updateItem(it.id, "finalPhoto", v)} /></div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div><Lbl c="Karat" /><Sel v={String(it.karat)} on={(v) => updateItem(it.id, "karat", Number(v))} opts={["14", "18"]} /></div>
                  <div><Lbl c="Gross Weight (g)" /><Inp type="number" v={it.grossWt} on={(v) => updateItem(it.id, "grossWt", v)} /></div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div><Lbl c="Stone Weight (g)" /><Inp type="number" v={it.stoneWt} on={(v) => updateItem(it.id, "stoneWt", v)} /></div>
                  <div><Lbl c="Diamond Weight (g)" /><Inp type="number" v={it.diaWt} on={(v) => updateItem(it.id, "diaWt", v)} /></div>
                </div>
                <Btn kind="success" onClick={() => completeItem(it.id)}>Calculate & Mark Returned</Btn>
              </div>
            ) : (
              <div style={{ marginTop: 10, background: C.cream, borderRadius: 8, padding: 10, fontSize: 13 }}>
                <div>Net weight: <strong>{it.netWt}g ({it.karat}K)</strong></div>
                <div>Pure gold used: <strong>{fmt3(it.pureGold)}g</strong></div>
                <div>Labour charge: <strong>Rs.{fmt2(it.labourCharge)}</strong></div>
              </div>
            )}
          </Card>
        ))}
        <Btn kind="outline" onClick={addItem}>+ Add Item</Btn>

        {summary && (
          <Card style={{ marginTop: 20, background: C.cream }}>
            <SecH>Live Balance - {form.karigarName}</SecH>
            <div style={{ fontSize: 13 }}>Gold balance with karigar: <strong>{fmt3(summary.goldBalance)}g</strong></div>
            <div style={{ fontSize: 13 }}>Labour earned so far: <strong>Rs.{fmt2(summary.labourEarned)}</strong></div>
            <div style={{ fontSize: 13 }}>Net payable: <strong>Rs.{fmt2(summary.netPayable)}</strong></div>
          </Card>
        )}

        <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
          <Btn kind="outline" onClick={() => { setView("dashboard"); setForm(null); }}>Cancel</Btn>
          <Btn onClick={saveBatch}>{form.firebaseId ? "Update Batch" : "Save Batch"}</Btn>
        </div>
      </Shell>
    );
  }

  const filteredBatches = selectedKarigarFilter ? batches.filter((b) => b.karigarName === selectedKarigarFilter) : batches;

  return (
    <Shell view={view} setView={setView} currentUser={currentUser} setCurrentUser={setCurrentUser}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "Georgia, serif" }}>Karigar Book</div>
        <Btn onClick={openNewBatch}>+ New Batch</Btn>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <button onClick={() => setSelectedKarigarFilter("")} style={{ background: !selectedKarigarFilter ? C.gold : C.card, color: !selectedKarigarFilter ? "#fff" : C.ink, border: "1px solid " + C.border, borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: 600 }}>All</button>
        {karigarNames.map((name) => (
          <button key={name} onClick={() => setSelectedKarigarFilter(name)} style={{ background: selectedKarigarFilter === name ? C.gold : C.card, color: selectedKarigarFilter === name ? "#fff" : C.ink, border: "1px solid " + C.border, borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: 600 }}>{name}</button>
        ))}
      </div>

      {karigarNames.map((name) => {
        if (selectedKarigarFilter && selectedKarigarFilter !== name) return null;
        const s = karigarSummary(name);
        return (
          <Card key={name} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{name}</div>
              {s.pendingCount > 0 && <span style={{ fontSize: 11, background: "#FFF3CD", color: "#856404", padding: "3px 10px", borderRadius: 20, fontWeight: 600 }}>{s.pendingCount} pending</span>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13, marginBottom: 10 }}>
              <div>Gold balance: <strong>{fmt3(s.goldBalance)}g</strong></div>
              <div>Net payable: <strong style={{ color: C.gold }}>Rs.{fmt2(s.netPayable)}</strong></div>
              {s.stonesBalance > 0 && <div style={{ color: C.warning }}>Stones pending: {fmt2(s.stonesBalance)}ct</div>}
              {s.diamondsBalance > 0 && <div style={{ color: C.warning }}>Diamonds pending: {fmt2(s.diamondsBalance)}ct</div>}
            </div>
            <a href={buildWaLink(name)} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
              <Btn kind="outline" small>Send WhatsApp Balance</Btn>
            </a>
          </Card>
        );
      })}

      <SecH>All Batches</SecH>
      {loading ? <div style={{ textAlign: "center", padding: 40, color: C.muted }}>Loading...</div>
      : filteredBatches.length === 0 ? <div style={{ textAlign: "center", padding: 40, color: C.muted }}>No batches yet. Tap + New Batch to start.</div>
      : filteredBatches.map((b) => {
        const pendingInBatch = (b.items || []).filter((it) => it.status === "pending").length;
        return (
          <Card key={b.firebaseId} style={{ marginBottom: 10, cursor: "pointer" }}
            onClick={() => { setSelectedBatchId(b.firebaseId); setView("batchDetail"); }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 700 }}>{b.karigarName}</div>
                <div style={{ fontSize: 12, color: C.muted }}>{b.dateGiven} - {b.goldGrams}g given - {(b.items || []).length} item(s)</div>
              </div>
              {pendingInBatch > 0 && <span style={{ fontSize: 11, background: "#FFF3CD", color: "#856404", padding: "2px 10px", borderRadius: 20, fontWeight: 600, alignSelf: "flex-start" }}>{pendingInBatch} pending</span>}
            </div>
          </Card>
        );
      })}
    </Shell>
  );
}

function NewKarigarForm({ onAdd }) {
  const [name, setName] = useState("");
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <div style={{ flex: 1 }}><Inp v={name} on={setName} ph="Karigar name" /></div>
      <Btn onClick={() => { onAdd(name); setName(""); }}>Add</Btn>
    </div>
  );
}

function PaymentForm({ karigarNames, onSave }) {
  const [karigarName, setKarigarName] = useState(karigarNames[0] || "");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  return (
    <Card style={{ marginBottom: 20 }}>
      <div style={{ marginBottom: 10 }}><Lbl c="Karigar" /><Sel v={karigarName} on={setKarigarName} opts={karigarNames} /></div>
      <div style={{ marginBottom: 10 }}><Lbl c="Amount (Rs.)" /><Inp type="number" v={amount} on={setAmount} /></div>
      <div style={{ marginBottom: 10 }}><Lbl c="Note (optional)" /><Inp v={note} on={setNote} ph="e.g. cash advance" /></div>
      <Btn onClick={() => { onSave(karigarName, amount, note); setAmount(""); setNote(""); }}>Record Payment</Btn>
    </Card>
  );
}

function Shell({ view, setView, currentUser, setCurrentUser, onBack, children }) {
  return (
    <div style={{ minHeight: "100vh", background: C.cream, color: C.ink, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: C.card, borderBottom: "2px solid " + C.gold, padding: "14px 16px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            {onBack ? (
              <button onClick={onBack} style={{ background: "transparent", border: "none", color: C.gold, fontWeight: 700, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 4 }}>Back</button>
            ) : (
              <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: C.gold, fontWeight: 700 }}>Gemsstar Jewelers</div>
            )}
            <div style={{ fontFamily: "Georgia, serif", fontSize: 19, fontWeight: 700 }}>Karigar Book</div>
          </div>
          <div>
            <Lbl c="Entered by" />
            <select value={currentUser} onChange={(e) => setCurrentUser(e.target.value)} style={{ ...iBase, padding: "6px 10px", fontSize: 13, width: "auto" }}>
              {ENTRY_USERS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
          {[["dashboard", "Dashboard"], ["karigars", "Karigars"], ["payments", "Payments"]].map(([v, label]) => (
            <button key={v} onClick={() => setView(v)} style={{ background: view === v ? C.gold : "transparent", color: view === v ? "#fff" : C.ink, border: "1px solid " + (view === v ? C.gold : C.border), borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{label}</button>
          ))}
        </div>
      </div>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px 14px 60px" }}>
        {children}
      </div>
    </div>
  );
}
