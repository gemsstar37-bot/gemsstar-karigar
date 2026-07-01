import { db, storage } from "../firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  setDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const KARIGARS = "karigars";
const BATCHES = "karigarBatches";
const WORK_ITEMS = "karigarWorkItems";
const PAYMENTS = "karigarPayments";
const MONTHLY_CLOSE = "karigarMonthlyClosed";

// ─────────────────────────────────────────────────────────────
// KARIGAR MANAGEMENT
// ─────────────────────────────────────────────────────────────

export async function getKarigars() {
  const snap = await getDocs(
    query(collection(db, KARIGARS), where("active", "==", true), orderBy("name"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addKarigar({ name, phone, abbreviation, defaultLabourPct }) {
  return addDoc(collection(db, KARIGARS), {
    name,
    phone: phone || "",
    abbreviation: abbreviation || "",
    defaultLabourPct: defaultLabourPct || 10,
    active: true,
    createdAt: serverTimestamp(),
  });
}

export async function updateKarigar(karigarId, updates) {
  return updateDoc(doc(db, KARIGARS, karigarId), updates);
}

// ─────────────────────────────────────────────────────────────
// BATCH MANAGEMENT (GOLD GIVEN)
// ─────────────────────────────────────────────────────────────

export async function addMetalGivenBatch({
  karigarId,
  dateGiven,
  weightGiven,
  goldRate,
  enteredBy,
}) {
  return addDoc(collection(db, BATCHES), {
    karigarId,
    dateGiven,
    weightGiven: Number(weightGiven),
    goldRate: Number(goldRate),
    enteredBy,
    createdAt: serverTimestamp(),
  });
}

export async function getBatchesForKarigarAndMonth(karigarId, month, year) {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0).toISOString().slice(0, 10);
  
  const snap = await getDocs(
    query(
      collection(db, BATCHES),
      where("karigarId", "==", karigarId),
      where("dateGiven", ">=", startDate),
      where("dateGiven", "<=", endDate),
      orderBy("dateGiven", "asc")
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ─────────────────────────────────────────────────────────────
// WORK ITEM MANAGEMENT (ORDERS GIVEN TO KARIGARS)
// ─────────────────────────────────────────────────────────────

export async function getNextOrderNumber(karigarId, dateGiven) {
  // Count how many items given to this karigar on this date
  const [year, month, day] = dateGiven.split("-");
  const dayStart = dateGiven;
  const dayEnd = dateGiven;
  
  const snap = await getDocs(
    query(
      collection(db, WORK_ITEMS),
      where("karigarId", "==", karigarId),
      where("dateGiven", ">=", dayStart),
      where("dateGiven", "<=", dayEnd),
      orderBy("createdAt", "asc")
    )
  );
  
  const count = snap.size + 1;
  
  // Get karigar abbreviation
  const kSnap = await getDoc(doc(db, KARIGARS, karigarId));
  const abbr = kSnap.exists() ? kSnap.data().abbreviation : "K";
  
  // Format: BAL-1-1Jul26
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dayNum = parseInt(day);
  const monthStr = months[parseInt(month) - 1];
  const yearStr = year.slice(-2);
  
  return `${abbr}-${count}-${dayNum}${monthStr}${yearStr}`;
}

export async function createWorkItem({
  karigarId,
  itemDescription,
  sketchPhotoFile,
  dateGiven,
  isClientOrder,
  gemsstarOrderNo,
  forStock,
  enteredBy,
}) {
  let sketchPhotoUrl = "";
  if (sketchPhotoFile) {
    sketchPhotoUrl = await uploadKarigarPhoto(
      sketchPhotoFile,
      karigarId || "stock",
      "sketch"
    );
  }
  
  const orderNumber = karigarId && !forStock 
    ? await getNextOrderNumber(karigarId, dateGiven)
    : null;
  
  return addDoc(collection(db, WORK_ITEMS), {
    karigarId: karigarId || null,
    orderNumber,
    isClientOrder: !!isClientOrder,
    gemsstarOrderNo: gemsstarOrderNo || "",
    forStock: !!forStock,
    itemDescription: itemDescription || "",
    sketchPhotoUrl,
    dateGiven,
    finalPhotoUrl: "",
    dateReturned: "",
    status: "pending",
    grossWt: null,
    stoneWt: null,
    diaWt: null,
    netWt: null,
    wastageGrams: null,
    wastagePercent: null,
    labourPct: null,
    goldRateUsed: null,
    makingCharge: null,
    enteredBy,
    createdAt: serverTimestamp(),
    editedBy: null,
    editedAt: null,
  });
}

export async function getWorkItemsForKarigarAndMonth(karigarId, month, year) {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0).toISOString().slice(0, 10);
  
  const snap = await getDocs(
    query(
      collection(db, WORK_ITEMS),
      where("karigarId", "==", karigarId),
      where("dateGiven", ">=", startDate),
      where("dateGiven", "<=", endDate),
      orderBy("dateGiven", "asc")
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getWorkItemsForPeriod(karigarId, startDate, endDate) {
  const snap = await getDocs(
    query(
      collection(db, WORK_ITEMS),
      where("karigarId", "==", karigarId),
      where("dateGiven", ">=", startDate),
      where("dateGiven", "<=", endDate),
      orderBy("dateGiven", "asc")
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function completeWorkItem({
  workItemId,
  karigarId,
  finalPhotoFile,
  dateReturned,
  grossWt,
  stoneWt,
  diaWt,
  labourPctOverride,
  enteredBy,
}) {
  let finalPhotoUrl = "";
  if (finalPhotoFile) {
    finalPhotoUrl = await uploadKarigarPhoto(
      finalPhotoFile,
      karigarId || "stock",
      "final"
    );
  }

  const g = Number(grossWt) || 0;
  const s = Number(stoneWt) || 0;
  const d = Number(diaWt) || 0;
  let netWt = g - s - d;
  netWt = Math.round(netWt * 1000) / 1000;

  let labourPct = labourPctOverride;
  let goldRateUsed = null;
  let makingCharge = null;
  let wastageGrams = null;
  let wastagePercent = null;

  if (karigarId) {
    if (!labourPct) {
      const kSnap = await getDoc(doc(db, KARIGARS, karigarId));
      labourPct = kSnap.exists() ? kSnap.data().defaultLabourPct : 10;
    }

    // Get the batch info for gold rate
    const item = await getDoc(doc(db, WORK_ITEMS, workItemId));
    if (item.exists()) {
      const batchSnap = await getDocs(
        query(
          collection(db, BATCHES),
          where("karigarId", "==", karigarId),
          orderBy("dateGiven", "asc")
        )
      );
      if (batchSnap.size > 0) {
        const batch = batchSnap.docs[0].data();
        goldRateUsed = batch.goldRate;
      }
    }

    if (goldRateUsed && netWt > 0) {
      makingCharge =
        Math.round(netWt * goldRateUsed * (labourPct / 100) * 100) / 100;
      
      // Calculate wastage (difference between gross given estimate and net returned)
      // This is a simplified approach — in a full system, you'd track per-batch given
      wastageGrams = Math.round((g - netWt) * 1000) / 1000;
      if (g > 0) {
        wastagePercent = Math.round(((g - netWt) / g) * 100 * 10) / 10;
      }
    }
  }

  await updateDoc(doc(db, WORK_ITEMS, workItemId), {
    finalPhotoUrl,
    dateReturned,
    status: "returned",
    grossWt: g,
    stoneWt: s,
    diaWt: d,
    netWt,
    wastageGrams,
    wastagePercent,
    labourPct,
    goldRateUsed,
    makingCharge,
    enteredBy,
    editedAt: serverTimestamp(),
  });

  return { netWt, makingCharge, goldRateUsed, labourPct, wastageGrams, wastagePercent };
}

export async function adminEditWorkItem(workItemId, updates, adminName) {
  return updateDoc(doc(db, WORK_ITEMS, workItemId), {
    ...updates,
    editedBy: adminName,
    editedAt: serverTimestamp(),
  });
}

export async function adminDeleteWorkItem(workItemId) {
  return deleteDoc(doc(db, WORK_ITEMS, workItemId));
}

export async function uploadKarigarPhoto(file, karigarId, stage) {
  const filename = `karigar-photos/${karigarId}/${Date.now()}_${stage}_${file.name}`;
  const storageRef = ref(storage, filename);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

// ─────────────────────────────────────────────────────────────
// PAYMENTS
// ─────────────────────────────────────────────────────────────

export async function addPayment({ karigarId, amount, date, note, enteredBy }) {
  return addDoc(collection(db, PAYMENTS), {
    karigarId,
    amount: Number(amount),
    date,
    note: note || "",
    enteredBy,
    createdAt: serverTimestamp(),
  });
}

export async function getPaymentsForKarigarAndMonth(karigarId, month, year) {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0).toISOString().slice(0, 10);
  
  const snap = await getDocs(
    query(
      collection(db, PAYMENTS),
      where("karigarId", "==", karigarId),
      where("date", ">=", startDate),
      where("date", "<=", endDate),
      orderBy("date", "asc")
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getPaymentsForPeriod(karigarId, startDate, endDate) {
  const snap = await getDocs(
    query(
      collection(db, PAYMENTS),
      where("karigarId", "==", karigarId),
      where("date", ">=", startDate),
      where("date", "<=", endDate),
      orderBy("date", "asc")
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ─────────────────────────────────────────────────────────────
// MONTHLY SUMMARIES & CLOSE
// ─────────────────────────────────────────────────────────────

export async function getMonthSummary(karigarId, month, year) {
  const [batches, workItems, payments] = await Promise.all([
    getBatchesForKarigarAndMonth(karigarId, month, year),
    getWorkItemsForKarigarAndMonth(karigarId, month, year),
    getPaymentsForKarigarAndMonth(karigarId, month, year),
  ]);

  // Opening balance from previous month close
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const closeSnap = await getDoc(
    doc(db, MONTHLY_CLOSE, `${karigarId}_${prevYear}_${String(prevMonth).padStart(2, "0")}`)
  );
  const openingBalance = closeSnap.exists() 
    ? { goldGrams: closeSnap.data().closingGoldGrams || 0, labourRupees: closeSnap.data().closingLabourRupees || 0 }
    : { goldGrams: 0, labourRupees: 0 };

  // Gold calculations
  const totalGoldGiven = batches.reduce((sum, b) => sum + b.weightGiven, 0);
  const returnedItems = workItems.filter((w) => w.status === "returned");
  const totalGoldReturned = returnedItems.reduce((sum, w) => sum + (w.netWt || 0), 0);
  const totalWastage = returnedItems.reduce((sum, w) => sum + (w.wastageGrams || 0), 0);
  const goldBalance = Math.round((openingBalance.goldGrams + totalGoldGiven - totalGoldReturned) * 1000) / 1000;

  // Labour calculations
  const totalMakingCharges = returnedItems.reduce(
    (sum, w) => sum + (w.makingCharge || 0),
    0
  );
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const labourBalance = Math.round((openingBalance.labourRupees + totalMakingCharges - totalPaid) * 100) / 100;

  const pendingCount = workItems.filter((w) => w.status === "pending").length;

  return {
    month,
    year,
    openingBalance,
    totalGoldGiven,
    totalGoldReturned,
    totalWastage,
    goldBalance,
    totalMakingCharges,
    totalPaid,
    labourBalance,
    pendingCount,
    batches,
    workItems,
    payments,
  };
}

export async function closeMonth(karigarId, month, year, summary) {
  // Lock the month snapshot
  return setDoc(
    doc(db, MONTHLY_CLOSE, `${karigarId}_${year}_${String(month).padStart(2, "0")}`),
    {
      karigarId,
      month,
      year,
      closingGoldGrams: summary.goldBalance,
      closingLabourRupees: summary.labourBalance,
      totalGoldGiven: summary.totalGoldGiven,
      totalGoldReturned: summary.totalGoldReturned,
      totalWastage: summary.totalWastage,
      totalMakingCharges: summary.totalMakingCharges,
      totalPaid: summary.totalPaid,
      closedAt: serverTimestamp(),
    }
  );
}

export async function getMonthClosed(karigarId, month, year) {
  const snap = await getDoc(
    doc(db, MONTHLY_CLOSE, `${karigarId}_${year}_${String(month).padStart(2, "0")}`)
  );
  return snap.exists() ? snap.data() : null;
}

// ─────────────────────────────────────────────────────────────
// WHATSAPP & EXPORT
// ─────────────────────────────────────────────────────────────

export function buildWhatsAppStatement(karigarName, phone, summary) {
  const cleanPhone = (phone || "").replace(/[^0-9]/g, "");
  const message =
    `Gemsstar Jewelers — Monthly Settlement\n` +
    `${karigarName}\n\n` +
    `📅 Month: ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][summary.month - 1]} ${summary.year}\n\n` +
    `💰 Labour Account (₹)\n` +
    `Opening: ₹${summary.openingBalance.labourRupees.toFixed(2)}\n` +
    `Charges: ₹${summary.totalMakingCharges.toFixed(2)}\n` +
    `Paid: ₹${summary.totalPaid.toFixed(2)}\n` +
    `Closing: ₹${summary.labourBalance.toFixed(2)}\n\n` +
    `⚖️ Gold Account (g)\n` +
    `Opening: ${summary.openingBalance.goldGrams.toFixed(3)}g\n` +
    `Given: ${summary.totalGoldGiven.toFixed(3)}g\n` +
    `Returned: ${summary.totalGoldReturned.toFixed(3)}g\n` +
    `Wastage: ${summary.totalWastage.toFixed(3)}g\n` +
    `Closing: ${summary.goldBalance.toFixed(3)}g\n\n` +
    `Thank you for your work!\n` +
    `*Gemsstar Jewelers*`;
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}
