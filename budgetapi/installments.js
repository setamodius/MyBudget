// Taksit (installment) mantığı
//
// Kavramlar:
//  - "Gerçek" taksit işlemi: Kart/Hesap (boxtype 2/6) → Gider (3), info.Taksit = "x/n"
//  - "Bütçe" taksit satırı: Gider (3) → Destroyer (5), info.plan_id — plan sayfasındaki taksit yükü
//  - Plan imzası: kart + toplam taksit + alış tarihi (±4 gün) + aylık tutar (±%3) [+ açıklama]
//    alış tarihi = taksit tarihi − (taksit no − 1) ay

const { pool } = require('./dbapi');

const CARD = 2, EXPENSE = 3, DESTROYER = 5, STORAGE = 6;
const DATE_TOL_DAYS = 4;
const AMOUNT_TOL = 0.03;

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------
const TR_MAP = { 'İ': 'I', 'ı': 'I', 'Ö': 'O', 'ö': 'O', 'Ü': 'U', 'ü': 'U', 'Ş': 'S', 'ş': 'S', 'Ç': 'C', 'ç': 'C', 'Ğ': 'G', 'ğ': 'G' };
function normMerchant(s) {
  return (s || '')
    .replace(/[İıÖöÜüŞşÇçĞğ]/g, c => TR_MAP[c])
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

function pad(n) { return String(n).padStart(2, '0'); }

function addMonths(dateStr, k) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const idx = (y * 12 + (m - 1)) + k;
  const ny = Math.floor(idx / 12), nm = idx % 12;
  const maxDay = new Date(ny, nm + 1, 0).getDate();
  return `${ny}-${pad(nm + 1)}-${pad(Math.min(d, maxDay))}`;
}

function dayDiff(a, b) {
  return Math.abs((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86400000);
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function round2(x) { return Math.round(x * 100) / 100; }

function amountClose(a, b) {
  a = Number(a); b = Number(b);
  if (!a || !b) return false;
  return Math.abs(a - b) / Math.max(a, b) <= AMOUNT_TOL;
}

function parseTaksit(info) {
  const t = info && info.Taksit;
  if (!t) return null;
  const m = /^(\d+)\s*\/\s*(\d+)$/.exec(String(t));
  if (!m) return null;
  const no = parseInt(m[1]), total = parseInt(m[2]);
  if (!(total > 1) || no < 1 || no > total) return null;
  return { no, total };
}

function planIdOf(info) {
  const v = info && info.plan_id;
  const n = parseInt(v);
  return isNaN(n) ? null : n;
}

// Bir planın i. taksit tarihi
function installmentDate(plan, i) {
  return addMonths(plan.purchase_date, i - 1);
}

// Plan, verilen imzaya uyuyor mu? (merchant sadece eşitlik bozmak için)
function planMatches(plan, sig) {
  if (plan.payment_box_id !== sig.card) return false;
  if (plan.total_installments !== sig.total) return false;
  if (!plan.purchase_date || dayDiff(plan.purchase_date, sig.purchase_date) > DATE_TOL_DAYS) return false;
  if (!amountClose(plan.amount_per_month, sig.amount)) return false;
  return true;
}

function pickPlan(plans, sig) {
  const matches = plans.filter(p => planMatches(p, sig));
  if (matches.length <= 1) return matches[0] || null;
  const byMerchant = matches.filter(p => p.merchant && normMerchant(p.merchant) === sig.merchant);
  if (byMerchant.length === 1) return byMerchant[0];
  return null; // belirsiz
}

// ---------------------------------------------------------------------------
// Veri yükleme
// ---------------------------------------------------------------------------
async function loadPlans(db) {
  const { rows } = await db.query(
    `SELECT ip.*, b.name AS expense_name, pb.name AS payment_box_name, pb.boxtypeid AS payment_box_type
     FROM installment_plans ip
     JOIN boxes b ON b.id = ip.expense_box_id
     LEFT JOIN boxes pb ON pb.id = ip.payment_box_id
     ORDER BY ip.start_date, ip.id`
  );
  return rows.map(p => ({
    ...p,
    purchase_date: p.purchase_date || p.start_date,
    first_no: p.first_no || 1,
    amount_per_month: Number(p.amount_per_month),
  }));
}

// Kart/Hesap → Gider işlemleri (gerçek harcamalar)
async function loadActuals(db) {
  const { rows } = await db.query(
    `SELECT t.id, t.date, t.frombox, t.tobox, t.description, t.amount, t.info,
            f.name AS from_name, tb.name AS to_name
     FROM box_transactions t
     JOIN boxes f ON f.id = t.frombox
     JOIN boxes tb ON tb.id = t.tobox
     WHERE f.boxtypeid IN (${CARD}, ${STORAGE}) AND tb.boxtypeid = ${EXPENSE}
     ORDER BY t.date, t.id`
  );
  return rows.map(r => ({ ...r, amount: Number(r.amount), info: r.info || {} }));
}

async function loadBudgetRows(db) {
  const { rows } = await db.query(
    `SELECT t.id, t.date, t.frombox, t.amount, t.info
     FROM box_transactions t
     JOIN boxes tb ON tb.id = t.tobox
     WHERE tb.boxtypeid = ${DESTROYER} AND (t.info::jsonb) ? 'plan_id'`
  );
  return rows.map(r => ({ ...r, amount: Number(r.amount) }));
}

async function getDestroyerId(db) {
  const r = await db.query(`SELECT id FROM boxes WHERE boxtypeid = ${DESTROYER} ORDER BY id LIMIT 1`);
  if (!r.rows.length) throw new Error('Destroyer box bulunamadı.');
  return r.rows[0].id;
}

// ---------------------------------------------------------------------------
// Gruplama: ekstreden gelen taksit satırlarını alışverişlere ayır
// ---------------------------------------------------------------------------
function buildGroups(actuals) {
  const groups = [];
  for (const tx of actuals) {
    const t = parseTaksit(tx.info);
    if (!t) continue;
    const sig = {
      card: tx.frombox,
      merchant: normMerchant(tx.description),
      total: t.total,
      purchase_date: addMonths(tx.date, -(t.no - 1)),
      amount: tx.amount,
    };
    const g = groups.find(g =>
      g.card === sig.card && g.merchant === sig.merchant && g.total === sig.total &&
      dayDiff(g.purchase_date, sig.purchase_date) <= DATE_TOL_DAYS &&
      amountClose(g.amount, sig.amount) &&
      !g.txs.some(x => x.no === t.no)
    );
    const item = { ...tx, no: t.no, plan_id: planIdOf(tx.info) };
    if (g) g.txs.push(item);
    else groups.push({ ...sig, description: tx.description, card_name: tx.from_name, txs: [item] });
  }
  for (const g of groups) {
    g.txs.sort((a, b) => a.no - b.no);
    g.min_no = g.txs[0].no;
    g.max_no = g.txs[g.txs.length - 1].no;
    g.last_date = addMonths(g.purchase_date, g.total - 1);
  }
  return groups;
}

function groupMatchesSig(g, sig) {
  return g.card === sig.card && g.merchant === sig.merchant && g.total === sig.total &&
    dayDiff(g.purchase_date, sig.purchase_date) <= DATE_TOL_DAYS && amountClose(g.amount, sig.amount);
}

function mostCommon(arr) {
  const c = new Map();
  for (const x of arr) if (x != null) c.set(x, (c.get(x) || 0) + 1);
  let best = null, bc = 0;
  for (const [k, v] of c) if (v > bc) { best = k; bc = v; }
  return best;
}

// ---------------------------------------------------------------------------
// Plan oluşturma / bağlama (transaction içinde)
// ---------------------------------------------------------------------------
async function linkTxs(db, plan, txIds) {
  if (!txIds || !txIds.length) return;
  const { rows } = await db.query(
    `SELECT t.id, t.date, t.frombox, t.info, f.boxtypeid AS from_type
     FROM box_transactions t JOIN boxes f ON f.id = t.frombox WHERE t.id = ANY($1::int[])`,
    [txIds]
  );
  for (const tx of rows) {
    const info = tx.info || {};
    let no = parseTaksit(info)?.no;
    if (!no) {
      // Taksit bilgisi yoksa tarihe en yakın taksit numarası
      let best = plan.first_no, bd = Infinity;
      for (let i = 1; i <= plan.total_installments; i++) {
        const d = dayDiff(installmentDate(plan, i), tx.date);
        if (d < bd) { bd = d; best = i; }
      }
      no = best;
    }
    // Not: "Taksit" etiketi sadece ekstreden gelen kayıtlarda bulunur; elle girilenlere eklenmez
    const newInfo = { ...info, plan_id: String(plan.id), installment_no: String(no) };
    const isActual = tx.from_type === CARD || tx.from_type === STORAGE;
    await db.query(
      `UPDATE box_transactions SET info = $2 ${isActual ? ', tobox = $3' : ''} WHERE id = $1`,
      isActual ? [tx.id, newInfo, plan.expense_box_id] : [tx.id, newInfo]
    );
  }
}

async function writeBudgetRows(db, plan, destroyerId, onlyNos) {
  for (let i = plan.first_no; i <= plan.total_installments; i++) {
    if (onlyNos && !onlyNos.includes(i)) continue;
    const amt = i === plan.total_installments ? plan.last_amount : plan.amount_per_month;
    await db.query(
      `INSERT INTO box_transactions (date, frombox, tobox, description, amount, info) VALUES ($1,$2,$3,$4,$5,$6)`,
      [installmentDate(plan, i), plan.expense_box_id, destroyerId, plan.description, amt,
       { plan_id: plan.id, installment_no: i, total: plan.total_installments }]
    );
  }
}

/**
 * body:
 *  description, merchant?, expense_box_id, payment_box_id,
 *  purchase_date (ya da eski API: start_date), total_installments,
 *  amount_per_month? | total_amount, first_no? (varsayılan 1),
 *  card_txns? (kart/hesap işlemlerini de oluştur), link_tx_ids?, delete_tx_ids?,
 *  replace_plan_ids? (önce bu planları sil), auto_link? (imzaya uyan bağlanmamış taksitleri bağla)
 */
async function createPlanTx(db, body) {
  const n = parseInt(body.total_installments);
  const purchase_date = body.purchase_date || body.start_date;
  if (!(n > 0) || !purchase_date || !body.expense_box_id) throw new Error('Eksik plan bilgisi');

  for (const pid of body.replace_plan_ids || []) await deletePlanTx(db, pid);

  let monthly, total, last;
  if (body.amount_per_month) {
    monthly = round2(Number(body.amount_per_month));
    total = body.total_amount ? round2(Number(body.total_amount)) : round2(monthly * n);
  } else {
    total = round2(Number(body.total_amount));
    monthly = round2(total / n);
  }
  last = round2(total - (n - 1) * monthly);
  const first_no = Math.min(Math.max(parseInt(body.first_no) || 1, 1), n);

  const { rows } = await db.query(
    `INSERT INTO installment_plans
       (description, merchant, expense_box_id, payment_box_id, start_date, purchase_date, first_no, total_installments, amount_per_month, total_amount)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [body.description, body.merchant || body.description, body.expense_box_id, body.payment_box_id || null,
     addMonths(purchase_date, first_no - 1), purchase_date, first_no, n, monthly, total]
  );
  const plan = {
    id: rows[0].id, description: body.description, expense_box_id: body.expense_box_id,
    payment_box_id: body.payment_box_id || null, purchase_date, first_no, total_installments: n,
    amount_per_month: monthly, last_amount: last,
  };

  const destroyerId = await getDestroyerId(db);
  await writeBudgetRows(db, plan, destroyerId);

  const linkIds = new Set((body.link_tx_ids || []).map(Number));
  if (body.auto_link && plan.payment_box_id) {
    const actuals = await loadActuals(db);
    for (const g of buildGroups(actuals)) {
      const sig = { card: plan.payment_box_id, total: n, purchase_date, amount: monthly };
      if (g.card === sig.card && g.total === n && dayDiff(g.purchase_date, purchase_date) <= DATE_TOL_DAYS &&
          amountClose(g.amount, monthly)) {
        g.txs.filter(t => !t.plan_id).forEach(t => linkIds.add(t.id));
      }
    }
  }
  await linkTxs(db, plan, [...linkIds]);

  if (body.delete_tx_ids && body.delete_tx_ids.length) {
    await db.query(`DELETE FROM box_transactions WHERE id = ANY($1::int[])`, [body.delete_tx_ids]);
  }

  if (body.card_txns && plan.payment_box_id) {
    // Zaten bağlı olan taksit numaraları için tekrar oluşturma
    const { rows: linked } = await db.query(
      `SELECT (info->>'installment_no')::int AS no FROM box_transactions t
       JOIN boxes f ON f.id = t.frombox
       WHERE (t.info->>'plan_id')::int = $1 AND f.boxtypeid IN (${CARD}, ${STORAGE})`,
      [plan.id]
    );
    const have = new Set(linked.map(r => r.no));
    for (let i = first_no; i <= n; i++) {
      if (have.has(i)) continue;
      const amt = i === n ? last : monthly;
      await db.query(
        `INSERT INTO box_transactions (date, frombox, tobox, description, amount, info) VALUES ($1,$2,$3,$4,$5,$6)`,
        [installmentDate(plan, i), plan.payment_box_id, plan.expense_box_id, plan.description, amt,
         { Taksit: `${i}/${n}`, plan_id: String(plan.id), installment_no: String(i), generated: '1' }]
      );
    }
  }
  return plan.id;
}

async function deletePlanTx(db, id) {
  // Bütçe satırlarını ve plan tarafından üretilmiş kart işlemlerini sil
  await db.query(
    `DELETE FROM box_transactions t USING boxes tb
     WHERE tb.id = t.tobox AND (t.info->>'plan_id')::int = $1
       AND (tb.boxtypeid = ${DESTROYER} OR t.info->>'generated' = '1')`,
    [id]
  );
  // Gerçek işlemlerden plan bağını kaldır (işlemler silinmez)
  await db.query(
    `UPDATE box_transactions SET info = ((info::jsonb) - 'plan_id' - 'installment_no')::json
     WHERE (info->>'plan_id')::int = $1`,
    [id]
  );
  await db.query('DELETE FROM installment_plans WHERE id = $1', [id]);
}

async function inTx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await fn(client);
    await client.query('COMMIT');
    return r;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

function fail(response, err, msg) {
  console.error(err);
  response.status(500).send(msg + (err && err.message ? `: ${err.message}` : ''));
}

// ---------------------------------------------------------------------------
// HTTP handler'ları
// ---------------------------------------------------------------------------
const getInstallmentPlans = async (request, response) => {
  try {
    const plans = await loadPlans(pool);
    const actuals = await loadActuals(pool);
    const today = todayStr();
    const out = plans.map(p => {
      let elapsed = 0;
      for (let i = 1; i <= p.total_installments; i++) if (installmentDate(p, i) <= today) elapsed++;
      const paid = actuals.filter(a => planIdOf(a.info) === p.id).length;
      return {
        ...p,
        amount_per_month: String(p.amount_per_month),
        total_amount: String(p.total_amount ?? round2(p.total_installments * p.amount_per_month)),
        elapsed_count: String(elapsed),
        paid_count: paid,
      };
    });
    response.status(200).json(out);
  } catch (err) { fail(response, err, 'Installment plans error'); }
};

const getInstallmentPlan = async (request, response) => {
  const id = parseInt(request.params.id);
  try {
    const plan = (await loadPlans(pool)).find(p => p.id === id);
    if (!plan) return response.status(404).send('Plan bulunamadı');
    const { rows } = await pool.query(
      `SELECT t.id, t.date, t.amount, t.frombox, t.tobox, (t.info->>'installment_no')::int AS no, tb.boxtypeid AS to_type
       FROM box_transactions t JOIN boxes tb ON tb.id = t.tobox
       WHERE (t.info->>'plan_id')::int = $1 ORDER BY t.date`,
      [id]
    );
    const out = [];
    for (let i = plan.first_no; i <= plan.total_installments; i++) {
      const budget = rows.find(r => r.to_type === DESTROYER && r.no === i);
      const actual = rows.find(r => r.to_type !== DESTROYER && r.no === i);
      out.push({
        id: budget ? budget.id : -i,
        installment_no: i,
        total: plan.total_installments,
        date: budget ? budget.date : installmentDate(plan, i),
        amount: budget ? budget.amount : String(plan.amount_per_month),
        has_budget: !!budget,
        actual_id: actual ? actual.id : null,
        actual_date: actual ? actual.date : null,
        actual_amount: actual ? actual.amount : null,
      });
    }
    response.status(200).json(out);
  } catch (err) { fail(response, err, 'Installment plan detail error'); }
};

const createInstallmentPlan = async (request, response) => {
  try {
    const id = await inTx(db => createPlanTx(db, request.body));
    response.status(201).json({ id });
  } catch (err) { fail(response, err, 'Installment plan create error'); }
};

const deleteInstallmentPlan = async (request, response) => {
  const id = parseInt(request.params.id);
  try {
    await inTx(db => deletePlanTx(db, id));
    response.status(200).send(`Installment plan deleted with ID: ${id}`);
  } catch (err) { fail(response, err, 'Installment plan delete error'); }
};

// Plan adını / kategorisini değiştir; bağlı bütçe satırları ve gerçek işlemler de güncellenir
const updateInstallmentPlan = async (request, response) => {
  const id = parseInt(request.params.id);
  const { description, expense_box_id } = request.body;
  try {
    await inTx(async db => {
      if (description) {
        await db.query('UPDATE installment_plans SET description = $2 WHERE id = $1', [id, description]);
        await db.query(
          `UPDATE box_transactions t SET description = $2 FROM boxes tb
           WHERE tb.id = t.tobox AND tb.boxtypeid = ${DESTROYER} AND (t.info->>'plan_id')::int = $1`,
          [id, description]
        );
      }
      if (expense_box_id) {
        await db.query('UPDATE installment_plans SET expense_box_id = $2 WHERE id = $1', [id, expense_box_id]);
        await db.query(
          `UPDATE box_transactions t SET frombox = $2 FROM boxes tb
           WHERE tb.id = t.tobox AND tb.boxtypeid = ${DESTROYER} AND (t.info->>'plan_id')::int = $1`,
          [id, expense_box_id]
        );
        await db.query(
          `UPDATE box_transactions t SET tobox = $2 FROM boxes f
           WHERE f.id = t.frombox AND f.boxtypeid IN (${CARD}, ${STORAGE}) AND (t.info->>'plan_id')::int = $1`,
          [id, expense_box_id]
        );
      }
    });
    response.status(200).send('Plan güncellendi');
  } catch (err) { fail(response, err, 'Installment plan update error'); }
};

const linkToPlan = async (request, response) => {
  const id = parseInt(request.params.id);
  try {
    await inTx(async db => {
      const plan = (await loadPlans(db)).find(p => p.id === id);
      if (!plan) throw new Error('Plan bulunamadı');
      await linkTxs(db, plan, (request.body.tx_ids || []).map(Number));
    });
    response.status(200).send('Bağlandı');
  } catch (err) { fail(response, err, 'Link error'); }
};

// Eksik bütçe satırlarını tamamla
const fillPlanBudget = async (request, response) => {
  const id = parseInt(request.params.id);
  try {
    await inTx(async db => {
      const plan = (await loadPlans(db)).find(p => p.id === id);
      if (!plan) throw new Error('Plan bulunamadı');
      const budget = (await loadBudgetRows(db)).filter(b => planIdOf(b.info) === id);
      const have = new Set(budget.map(b => parseInt(b.info.installment_no)));
      const missing = [];
      for (let i = plan.first_no; i <= plan.total_installments; i++) if (!have.has(i)) missing.push(i);
      plan.last_amount = round2(Number(plan.total_amount) - (plan.total_installments - 1) * plan.amount_per_month);
      await writeBudgetRows(db, plan, await getDestroyerId(db), missing);
    });
    response.status(200).send('Tamamlandı');
  } catch (err) { fail(response, err, 'Fill error'); }
};

/**
 * İçe aktarma öncesi: her taksit satırı için plan ve tekrar durumunu çöz.
 * body: { card, rows: [{ key, description, date, no, total, amount }] }
 */
const resolveInstallments = async (request, response) => {
  const card = parseInt(request.body.card);
  try {
    const plans = await loadPlans(pool);
    const actuals = await loadActuals(pool);
    const groups = buildGroups(actuals);
    const out = (request.body.rows || []).map(r => {
      const sig = {
        card, merchant: normMerchant(r.description), total: r.total,
        purchase_date: addMonths(r.date, -(r.no - 1)), amount: Math.abs(r.amount),
      };
      const group = groups.find(g => groupMatchesSig(g, sig));
      let plan = null;
      if (group) {
        const pid = mostCommon(group.txs.map(t => t.plan_id));
        if (pid) plan = plans.find(p => p.id === pid) || null;
      }
      if (!plan) plan = pickPlan(plans, sig);

      // Aynı taksit zaten kayıtlı mı?
      let existing = group ? group.txs.find(t => t.no === r.no) : null;
      if (!existing && plan) {
        existing = actuals.find(a => planIdOf(a.info) === plan.id && parseInt(a.info.installment_no) === r.no) || null;
      }
      const unlinked = group ? group.txs.filter(t => !t.plan_id).map(t => t.id) : [];
      const firstNo = Math.min(r.no, group ? group.min_no : r.no);
      return {
        key: r.key,
        purchase_date: sig.purchase_date,
        plan_id: plan ? plan.id : null,
        plan_description: plan ? plan.description : null,
        expense_box_id: plan ? plan.expense_box_id : (group ? group.txs[group.txs.length - 1].tobox : null),
        duplicate_tx_id: existing ? existing.id : null,
        unlinked_tx_ids: plan ? [] : unlinked,
        first_no: firstNo,
      };
    });
    response.status(200).json(out);
  } catch (err) { fail(response, err, 'Resolve error'); }
};

/**
 * Onarım taraması: mevcut taksit kayıtlarındaki tutarsızlıkları bul.
 */
const scanInstallments = async (request, response) => {
  try {
    const plans = await loadPlans(pool);
    const actuals = await loadActuals(pool);
    const budget = await loadBudgetRows(pool);
    const groups = buildGroups(actuals);
    const today = todayStr();
    const groupedIds = new Set(groups.flatMap(g => g.txs.map(t => t.id)));

    const groupIssues = [];
    for (const g of groups) {
      const linked = [...new Set(g.txs.map(t => t.plan_id).filter(Boolean))];
      const sig = { card: g.card, merchant: g.merchant, total: g.total, purchase_date: g.purchase_date, amount: g.amount };
      let plan = linked.length === 1 ? plans.find(p => p.id === linked[0]) : null;
      const sigPlan = plan ? null : (linked.length === 0 ? pickPlan(plans, sig) : null);
      const issues = [];
      let action;

      if (linked.length === 0 && !sigPlan) { issues.push('no_plan'); action = 'create'; }
      else if (linked.length > 1) { issues.push('multi_plan'); action = 'create'; }
      else {
        const p = plan || sigPlan;
        const fits = planMatches(p, sig) && p.first_no <= g.min_no;
        if (!fits) { issues.push('plan_mismatch'); action = 'create'; plan = p; }
        else {
          plan = p;
          action = 'link';
          if (g.txs.some(t => t.plan_id !== p.id)) issues.push('partial_link');
          if (g.txs.some(t => t.tobox !== p.expense_box_id)) issues.push('mixed_category');
        }
      }
      if (!issues.length) continue;

      // Aynı alışverişin taksitsiz (tek tutar) girilmiş hâli
      const firstTok = s => normMerchant(s).split(' ')[0];
      const lumps = actuals.filter(a =>
        !groupedIds.has(a.id) && !planIdOf(a.info) && a.frombox === g.card &&
        Math.abs(a.amount - g.amount * g.total) <= Math.max(1, g.amount * g.total * 0.01) &&
        firstTok(a.description) === firstTok(g.description) &&
        dayDiff(a.date, g.purchase_date) <= 45
      ).map(a => ({ id: a.id, date: a.date, amount: a.amount, description: a.description, to_name: a.to_name }));

      const categories = [...new Set(g.txs.map(t => t.to_name))];
      groupIssues.push({
        key: `${g.card}|${g.merchant}|${g.purchase_date}|${g.total}|${g.amount}`,
        card: g.card,
        card_name: g.card_name,
        description: g.description,
        merchant: g.merchant,
        purchase_date: g.purchase_date,
        total: g.total,
        amount: g.amount,
        min_no: g.min_no,
        max_no: g.max_no,
        finished: g.last_date < today,
        issues,
        action,
        categories,
        suggested_category: plan ? plan.expense_box_id : g.txs[g.txs.length - 1].tobox,
        suggested_description: plan ? plan.description : g.description,
        plan_id: plan ? plan.id : null,
        plan_description: plan ? plan.description : null,
        plan_total: plan ? plan.total_installments : null,
        replace_plan_ids: action === 'create' ? linked : [],
        tx_ids: g.txs.map(t => t.id),
        txs: g.txs.map(t => ({ id: t.id, date: t.date, no: t.no, amount: t.amount, to_name: t.to_name, plan_id: t.plan_id })),
        lumps,
      });
    }

    // Planlar: eksik bütçe satırları ve bağlanmamış elle girilmiş ödemeler
    const planIssues = [];
    const usedCandidates = new Set();
    for (const p of plans) {
      // Bu planın taksitleri gruplardan birinde ise gruplar zaten ilgileniyor
      const myBudget = budget.filter(b => planIdOf(b.info) === p.id);
      const haveBudget = new Set(myBudget.map(b => parseInt(b.info.installment_no)));
      const missingBudget = [];
      for (let i = p.first_no; i <= p.total_installments; i++) if (!haveBudget.has(i)) missingBudget.push(i);

      const linkedActuals = actuals.filter(a => planIdOf(a.info) === p.id);
      const linkedNos = new Set(linkedActuals.map(a => parseInt(a.info.installment_no)));
      // Ekstreden gelen (Taksit bilgili) işlemlere bağlı planlarla gruplar ilgilenir
      const coveredByGroup = linkedActuals.some(a => groupedIds.has(a.id));
      const pairs = [];
      for (let i = p.first_no; i <= p.total_installments && !coveredByGroup; i++) {
        if (linkedNos.has(i)) continue;
        const due = installmentDate(p, i);
        for (const a of actuals) {
          if (planIdOf(a.info) || groupedIds.has(a.id) || usedCandidates.has(a.id)) continue;
          // Elle girilen taksit ödemesi: tutar birebir (±1 TL), kategori aynı
          if (Math.abs(a.amount - p.amount_per_month) > 1) continue;
          if (a.tobox !== p.expense_box_id) continue;
          const d = dayDiff(a.date, due);
          if (d > 16) continue;
          pairs.push({ no: i, d, a });
        }
      }
      pairs.sort((x, y) => x.d - y.d);
      const takenNo = new Set(), takenTx = new Set(), candidates = [];
      for (const pr of pairs) {
        if (takenNo.has(pr.no) || takenTx.has(pr.a.id)) continue;
        takenNo.add(pr.no); takenTx.add(pr.a.id); usedCandidates.add(pr.a.id);
        candidates.push({ installment_no: pr.no, id: pr.a.id, date: pr.a.date, amount: pr.a.amount, description: pr.a.description, from_name: pr.a.from_name, to_name: pr.a.to_name });
      }
      candidates.sort((x, y) => x.installment_no - y.installment_no);
      if (!missingBudget.length && !candidates.length) continue;
      planIssues.push({
        plan_id: p.id, description: p.description, expense_name: p.expense_name,
        payment_box_name: p.payment_box_name, amount_per_month: p.amount_per_month,
        total_installments: p.total_installments, missing_budget: missingBudget, candidates,
      });
    }

    response.status(200).json({ groups: groupIssues, plans: planIssues });
  } catch (err) { fail(response, err, 'Scan error'); }
};

// Tek tutar girilmiş bir işlemi taksitlendir
const installmentizeTransaction = async (request, response) => {
  const txId = parseInt(request.params.id);
  const { total_installments, card_txns, description, expense_box_id } = request.body;
  try {
    const id = await inTx(async db => {
      const { rows } = await db.query(
        `SELECT t.*, f.boxtypeid AS from_type FROM box_transactions t JOIN boxes f ON f.id = t.frombox WHERE t.id = $1`, [txId]
      );
      const tx = rows[0];
      if (!tx) throw new Error('İşlem bulunamadı');
      if (tx.from_type !== CARD && tx.from_type !== STORAGE) throw new Error('Sadece kart/hesap harcamaları taksitlendirilebilir');
      return createPlanTx(db, {
        description: description || tx.description,
        merchant: tx.description,
        expense_box_id: expense_box_id || tx.tobox,
        payment_box_id: tx.frombox,
        purchase_date: tx.date,
        total_installments,
        total_amount: Number(tx.amount),
        first_no: 1,
        auto_link: true,
        card_txns: !!card_txns,
        delete_tx_ids: [txId],
      });
    });
    response.status(201).json({ id });
  } catch (err) { fail(response, err, 'Installmentize error'); }
};

module.exports = {
  getInstallmentPlans,
  getInstallmentPlan,
  createInstallmentPlan,
  deleteInstallmentPlan,
  updateInstallmentPlan,
  linkToPlan,
  fillPlanBudget,
  resolveInstallments,
  scanInstallments,
  installmentizeTransaction,
  // test için
  _internal: { normMerchant, addMonths, buildGroups, parseTaksit },
};
