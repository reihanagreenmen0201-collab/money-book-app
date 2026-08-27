import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Wallet, PiggyBank, ListChecks, CalendarCheck, Home as HomeIcon,
  Plus, Trash2, ChevronLeft, ChevronRight, Check, AlertCircle, Download, Upload
} from "lucide-react";

/* ---------- fonts & theme ---------- */
const FontStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500;700;900&family=Zen+Kaku+Gothic+New:wght@400;500;700&family=Roboto+Mono:wght@500;700&display=swap');
    .mb-root, .mb-root * { font-family: 'Zen Kaku Gothic New', sans-serif; box-sizing: border-box; }
    .mb-display { font-family: 'Zen Maru Gothic', sans-serif; }
    .mb-num { font-family: 'Roboto Mono', monospace; font-variant-numeric: tabular-nums; }
    .mb-scroll::-webkit-scrollbar { display: none; }
    .mb-scroll { -ms-overflow-style: none; scrollbar-width: none; }
    @keyframes mb-stamp { 0% { transform: scale(1.6) rotate(-8deg); opacity:0; } 60%{transform: scale(0.95) rotate(-8deg); opacity:1;} 100% { transform: scale(1) rotate(-8deg); opacity:1; } }
    .mb-stamp-anim { animation: mb-stamp .35s ease-out; }
  `}</style>
);

const COLORS = {
  bg: "#F3EEE2",
  paper: "#FBF8F0",
  line: "#E2D8C1",
  ink: "#33422F",     // 深緑（判子インク）
  inkSoft: "#5B6B54",
  inkLight: "rgba(75, 107, 69, 0.14)", // 薄い透明がかった緑（総資産カード用）
  clay: "#9C6B44",
  text: "#332B22",
  textMute: "#8C8272",
  danger: "#B3452D",
  ok: "#4B6B45",
};

/* ---------- storage helpers ---------- */
// 給料日(25日)基準の「月度」。26日〜翌月25日を1つの月度として扱う
const monthKey = (d) => {
  let y = d.getFullYear();
  let m = d.getMonth() + 1;
  if (d.getDate() >= 26) {
    m += 1;
    if (m === 13) { m = 1; y += 1; }
  }
  return `${y}-${String(m).padStart(2, "0")}`;
};
const monthLabel = (key) => {
  const [y, m] = key.split("-");
  return `${y}年${parseInt(m, 10)}月度`;
};
const monthRangeLabel = (key) => {
  const [y, m] = key.split("-").map(Number);
  let startM = m - 1;
  if (startM === 0) startM = 12;
  return `${startM}/26 〜 ${m}/25`;
};
const addMonths = (key, diff) => {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + diff, 1);
  return monthKey(d);
};
const fmt = (n) => (Number(n) || 0).toLocaleString("ja-JP");

const DEFAULT_WALLETS = [
  { key: "cash", name: "現金" },
  { key: "bundle", name: "バンドルカード" },
  { key: "pasmo", name: "パスモ" },
  { key: "yucho", name: "ゆうちょ銀行" },
  { key: "mizuho", name: "みずほ銀行" },
  { key: "dpay", name: "d払い残高" },
];

const DEFAULT_CATEGORIES = [
  { slug: "kakei", name: "家計", target: 110000 },
  { slug: "jiyuhi", name: "自由費", target: 20000 },
  { slug: "biyouin", name: "美容院費", target: 7000 },
  { slug: "biyou", name: "美容費", target: 3000 },
  { slug: "koutsu", name: "交通費・バンドル費", target: 20000 },
  { slug: "tabako", name: "たばこ", target: 6000 },
  { slug: "tanjyoubi", name: "誕生日費", target: 10000 },
  { slug: "ryokou", name: "旅行費", target: 10000 },
  { slug: "present", name: "プレゼント費", target: 3000 },
  { slug: "yobi", name: "予備費", target: 5000 },
  { slug: "docomo", name: "ドコモ代", target: 0 },
];

// カテゴリの繰り越しはfreshMonthで前月のリストをそのまま引き継ぐ方式にしたため、
// slugは将来の拡張用に保持のみ（現時点では照合には未使用）

const DEFAULT_PAYMENTS = [
  { label: "ドコモ", linkedCategory: null },
  { label: "バンドルカードにチャージ", linkedCategory: null },
  { label: "バンドル支払い", linkedCategory: null },
  { label: "d払い残高チャージ", linkedCategory: null },
  { label: "Vカード支払い", linkedCategory: null },
  { label: "JCBカード支払い", linkedCategory: null },
  { label: "ガス代", linkedCategory: null },
];

const DEFAULT_MONTH_END = [
  "銀行からおろす",
  "現金と貯金を調整する",
  "バンドルに現金チャージ",
  "バンドルにd払いチャージ",
  "ゆうちょにカード代・ガス代を移動",
];

const DEFAULT_DAY25 = [
  "お金を振り分ける",
  "現金の残りを貯金へ",
  "銀行の残りを繰り越す",
  "パスモの残りを繰り越す",
];

let idc = 1;
const nid = () => `i${Date.now()}_${idc++}`;

const freshMonth = (carryWallets, prevMonth) => ({
  wallets: DEFAULT_WALLETS.map((w) => ({
    ...w,
    balance: carryWallets ? carryWallets[w.key] ?? 0 : 0,
  })),
  salary: 0,
  // 前月のカテゴリ一覧をそのまま引き継ぐことで、名前を変更しても積み立て残高が途切れない
  categories:
    prevMonth && prevMonth.categories && prevMonth.categories.length
      ? prevMonth.categories.map((c) => ({
          ...c,
          id: nid(),
          actual: 0,
          balance: c.name === "家計" ? 0 : c.balance ?? 0,
        }))
      : DEFAULT_CATEGORIES.map((c) => ({ ...c, id: nid(), actual: 0, balance: 0 })),
  payments:
    prevMonth && prevMonth.payments && prevMonth.payments.length
      ? prevMonth.payments.map((p) => ({ ...p, id: nid(), amount: 0, done: false, deducted: 0 }))
      : DEFAULT_PAYMENTS.map((p) => ({
          id: nid(),
          label: p.label,
          amount: 0,
          done: false,
          linkedCategory: p.linkedCategory,
          deducted: 0,
        })),
  monthEnd: DEFAULT_MONTH_END.map((label) => ({ id: nid(), label, done: false })),
  day25: DEFAULT_DAY25.map((label) => ({ id: nid(), label, done: false })),
  memo: "",
});

// Claude内(window.storage)でもGitHub Pages等の一般環境(localStorage)でも
// 同じインターフェースで動くようにする互換レイヤー
const storage = (() => {
  const hasNative =
    typeof window !== "undefined" && window.storage && typeof window.storage.get === "function";
  if (hasNative) return window.storage;
  const has = typeof window !== "undefined" && "localStorage" in window;
  return {
    async get(key) {
      if (!has) return null;
      try {
        const raw = window.localStorage.getItem(key);
        return raw === null ? null : { key, value: raw, shared: false };
      } catch {
        return null;
      }
    },
    async set(key, value) {
      if (!has) return null;
      try {
        window.localStorage.setItem(key, value);
        return { key, value, shared: false };
      } catch {
        return null;
      }
    },
    async delete(key) {
      if (!has) return null;
      try {
        const existed = window.localStorage.getItem(key) !== null;
        window.localStorage.removeItem(key);
        return { key, deleted: existed, shared: false };
      } catch {
        return null;
      }
    },
    async list(prefix = "") {
      if (!has) return null;
      try {
        const keys = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k && k.startsWith(prefix)) keys.push(k);
        }
        return { keys, prefix, shared: false };
      } catch {
        return null;
      }
    },
  };
})();

async function loadMonth(key) {
  try {
    const res = await storage.get(`month-data:${key}`);
    return res ? JSON.parse(res.value) : null;
  } catch {
    return null;
  }
}

// 新しい財布項目が増えても、既存の保存データに自動で追加反映する
function normalizeWallets(existingWallets) {
  const map = new Map((existingWallets || []).map((w) => [w.key, w]));
  return DEFAULT_WALLETS.map((dw) => ({ ...dw, balance: map.get(dw.key)?.balance ?? 0 }));
}

async function saveMonth(key, data) {
  try {
    await storage.set(`month-data:${key}`, JSON.stringify(data));
  } catch (e) {
    console.error("save failed", e);
  }
}

// 支払いチェックリストの項目を更新し、連動先カテゴリの積み立て残高から差分だけ増減させる
function reconcilePayment(data, paymentId, patch) {
  const payments = data.payments.map((p) => (p.id === paymentId ? { ...p, ...patch } : p));
  const payment = payments.find((p) => p.id === paymentId);
  const desired = payment.done ? Number(payment.amount || 0) : 0;
  const prevDeducted = payment.deducted || 0;
  const delta = desired - prevDeducted;
  let categories = data.categories;
  if (payment.linkedCategory && delta !== 0) {
    categories = categories.map((c) =>
      c.name === payment.linkedCategory ? { ...c, balance: Number(c.balance || 0) - delta } : c
    );
  }
  const newPayments = payments.map((p) => (p.id === paymentId ? { ...p, deducted: desired } : p));
  return { ...data, payments: newPayments, categories };
}

// 支払い項目を削除する際、すでに差し引き済みの分をカテゴリの残高へ戻す
function removePaymentWithReconcile(data, paymentId) {
  const payment = data.payments.find((p) => p.id === paymentId);
  let categories = data.categories;
  if (payment && payment.linkedCategory && payment.deducted) {
    categories = categories.map((c) =>
      c.name === payment.linkedCategory ? { ...c, balance: Number(c.balance || 0) + payment.deducted } : c
    );
  }
  return { ...data, payments: data.payments.filter((p) => p.id !== paymentId), categories };
}

/* ---------- small UI atoms ---------- */
const Section = ({ title, right, children }) => (
  <div
    style={{
      background: COLORS.paper,
      border: `1px solid ${COLORS.line}`,
      borderRadius: 18,
      padding: "18px 16px",
      marginBottom: 14,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
      <h3 className="mb-display" style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, margin: 0, letterSpacing: 1 }}>
        {title}
      </h3>
      {right}
    </div>
    {children}
  </div>
);

const NumField = ({ value, onChange, prefix = "¥", placeholder }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
    {prefix && <span className="mb-num" style={{ color: COLORS.textMute, fontSize: 13 }}>{prefix}</span>}
    <input
      type="number"
      inputMode="numeric"
      value={value === 0 ? "" : value}
      placeholder={placeholder ?? "0"}
      onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      className="mb-num"
      style={{
        width: "100%",
        border: "none",
        borderBottom: `1px solid ${COLORS.line}`,
        background: "transparent",
        padding: "4px 2px",
        fontSize: 15,
        fontWeight: 700,
        color: COLORS.text,
        textAlign: "right",
        outline: "none",
      }}
    />
  </div>
);

const CheckRow = ({ label, subtitle, done, onToggle, right, onDelete }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "9px 2px",
      borderBottom: `1px dashed ${COLORS.line}`,
    }}
  >
    <button
      onClick={onToggle}
      aria-label={done ? "完了を取り消す" : "完了にする"}
      style={{
        width: 22,
        height: 22,
        flexShrink: 0,
        borderRadius: 7,
        border: `2px solid ${done ? COLORS.ink : COLORS.line}`,
        background: done ? COLORS.ink : "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      }}
    >
      {done && <Check size={14} color="#fff" strokeWidth={3} />}
    </button>
    <span style={{ flex: 1, minWidth: 0 }}>
      <span
        style={{
          display: "block",
          fontSize: 14,
          color: done ? COLORS.textMute : COLORS.text,
          textDecoration: done ? "line-through" : "none",
        }}
      >
        {label}
      </span>
      {subtitle && (
        <span style={{ display: "block", fontSize: 10.5, color: COLORS.clay, marginTop: 1 }}>{subtitle}</span>
      )}
    </span>
    {right}
    {onDelete && (
      <button onClick={onDelete} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }} aria-label="削除">
        <Trash2 size={14} color={COLORS.textMute} />
      </button>
    )}
  </div>
);

const ProgressBar = ({ ratio, tone = "ink" }) => (
  <div style={{ height: 6, borderRadius: 4, background: COLORS.line, overflow: "hidden" }}>
    <div
      style={{
        width: `${Math.min(100, ratio * 100)}%`,
        height: "100%",
        background: ratio > 1 ? COLORS.danger : COLORS[tone] || COLORS.ink,
        transition: "width .25s ease",
      }}
    />
  </div>
);

/* ---------- tabs ---------- */
function HomeTab({ data, totalAssets, fund, onExport, onImportClick, ioStatus }) {
  const totalTarget = data.categories.reduce((s, c) => s + Number(c.target || 0), 0);
  const totalActual = data.categories.reduce((s, c) => s + Number(c.actual || 0), 0);
  const doneCount =
    data.payments.filter((p) => p.done).length +
    data.monthEnd.filter((p) => p.done).length +
    data.day25.filter((p) => p.done).length;
  const totalCount = data.payments.length + data.monthEnd.length + data.day25.length;

  return (
    <>
      <div
        className="mb-stamp-anim"
        style={{
          background: COLORS.inkLight,
          border: `1px solid ${COLORS.inkSoft}33`,
          borderRadius: 20,
          padding: "22px 20px",
          marginBottom: 14,
          color: COLORS.ink,
        }}
      >
        <div style={{ fontSize: 12, color: COLORS.inkSoft, marginBottom: 6 }}>総資産</div>
        <div className="mb-num" style={{ fontSize: 34, fontWeight: 700, letterSpacing: 0.5 }}>
          ¥{fmt(totalAssets)}
        </div>
      </div>

      <Section title="財布の内訳">
        {data.wallets.map((w) => (
          <div key={w.key} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13.5 }}>
            <span style={{ color: COLORS.textMute }}>{w.name}</span>
            <span className="mb-num" style={{ color: COLORS.text, fontWeight: 700 }}>¥{fmt(w.balance)}</span>
          </div>
        ))}
      </Section>

      <Section title="積み立ての内訳">
        {data.categories
          .filter((c) => c.name !== "家計")
          .map((c) => {
            const isNegative = Number(c.balance || 0) < 0;
            return (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", fontSize: 13.5 }}>
                <span style={{ color: COLORS.textMute, display: "flex", alignItems: "center", gap: 4 }}>
                  {isNegative && <AlertCircle size={12} color={COLORS.danger} />}
                  {c.name}
                </span>
                <span className="mb-num" style={{ color: isNegative ? COLORS.danger : COLORS.text, fontWeight: 700 }}>
                  ¥{fmt(c.balance ?? 0)}
                </span>
              </div>
            );
          })}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 0", marginTop: 4, borderTop: `1px dashed ${COLORS.line}`, fontSize: 13 }}>
          <span style={{ color: COLORS.textMute }}>合計</span>
          <span className="mb-num" style={{ color: COLORS.ink, fontWeight: 700 }}>
            ¥{fmt(data.categories.filter((c) => c.name !== "家計").reduce((s, c) => s + Number(c.balance || 0), 0))}
          </span>
        </div>
      </Section>

      <Section title="今月の振り分け状況">
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6, color: COLORS.textMute }}>
          <span>目標合計 ¥{fmt(totalTarget)}</span>
          <span>実績 ¥{fmt(totalActual)}</span>
        </div>
        <ProgressBar ratio={totalTarget ? totalActual / totalTarget : 0} />
        {fund > 0 && (
          <div style={{ marginTop: 8, fontSize: 12.5, color: COLORS.textMute }}>
            振り分け原資 ¥{fmt(fund)}（残り ¥{fmt(fund - totalActual)}）
          </div>
        )}
      </Section>

      <Section title="タスク進捗">
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6, color: COLORS.textMute }}>
          <span>チェックリスト</span>
          <span>{doneCount} / {totalCount}</span>
        </div>
        <ProgressBar ratio={totalCount ? doneCount / totalCount : 0} tone="ok" />
      </Section>

      <Section title="バックアップ">
        <p style={{ fontSize: 11.5, color: COLORS.textMute, marginTop: 0, marginBottom: 10 }}>
          全ての月度のデータをファイルに書き出したり、書き出したファイルから復元したりできます。
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onExport}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "9px 0",
              borderRadius: 10,
              border: `1px solid ${COLORS.clay}66`,
              background: "rgba(156, 107, 68, 0.10)",
              color: COLORS.clay,
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <Download size={14} /> 書き出す
          </button>
          <button
            onClick={onImportClick}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "9px 0",
              borderRadius: 10,
              border: `1px solid ${COLORS.clay}66`,
              background: "rgba(156, 107, 68, 0.10)",
              color: COLORS.clay,
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <Upload size={14} /> 読み込む
          </button>
        </div>
        {ioStatus && ioStatus.type !== "idle" && (
          <div
            style={{
              marginTop: 8,
              fontSize: 12,
              color: ioStatus.type === "error" ? COLORS.danger : ioStatus.type === "success" ? COLORS.ok : COLORS.textMute,
            }}
          >
            {ioStatus.message}
          </div>
        )}
      </Section>
    </>
  );
}

function WalletsTab({ data, update }) {
  const setBal = (key, val) => {
    update((d) => ({ ...d, wallets: d.wallets.map((w) => (w.key === key ? { ...w, balance: val } : w)) }));
  };
  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          background: "rgba(156, 107, 68, 0.12)",
          border: `1px solid ${COLORS.clay}55`,
          borderRadius: 14,
          padding: "12px 14px",
          marginBottom: 14,
        }}
      >
        <CalendarCheck size={16} color={COLORS.clay} style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12.5, color: COLORS.text, lineHeight: 1.6 }}>
          給料日：25日。<strong>24日までに</strong>財布ごとの残高を最終更新。
        </div>
      </div>
      <Section title="財布ごとの残高">
      {data.wallets.map((w) => (
        <div key={w.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px dashed ${COLORS.line}` }}>
          <span style={{ flex: 1, fontSize: 14, color: COLORS.text }}>{w.name}</span>
          <div style={{ width: 130 }}>
            <NumField value={w.balance} onChange={(v) => setBal(w.key, v)} />
          </div>
        </div>
      ))}
      <p style={{ fontSize: 11.5, color: COLORS.textMute, marginTop: 10, marginBottom: 0 }}>
        月が変わると、この残高がそのまま来月の繰り越しとして引き継がれます。
      </p>
      </Section>
    </>
  );
}

function CategoriesTab({ data, update, fund, carryover }) {
  const totalTarget = data.categories.reduce((s, c) => s + Number(c.target || 0), 0);
  const totalActual = data.categories.reduce((s, c) => s + Number(c.actual || 0), 0);
  const remain = fund - totalActual;

  const setCat = (id, patch) =>
    update((d) => ({ ...d, categories: d.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const addCat = () =>
    update((d) => ({ ...d, categories: [...d.categories, { id: nid(), name: "新しい項目", target: 0, actual: 0, balance: 0 }] }));
  const delCat = (id) => {
    const cat = data.categories.find((c) => c.id === id);
    if (!cat) return;
    const balanceNote = cat.balance ? `（積み立て残高 ¥${fmt(cat.balance)} も一緒に消えます）` : "";
    if (!window.confirm(`「${cat.name}」を削除しますか？${balanceNote}`)) return;
    update((d) => ({ ...d, categories: d.categories.filter((c) => c.id !== id) }));
  };

  return (
    <>
      <Section title="今月の振り分け原資">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <span style={{ flex: 1, fontSize: 14, color: COLORS.text }}>給料</span>
          <div style={{ width: 140 }}>
            <NumField value={data.salary || 0} onChange={(v) => update((d) => ({ ...d, salary: v }))} />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: COLORS.textMute, marginBottom: 10 }}>
          <span>前月からの繰り越し（自動計算）</span>
          <span className="mb-num">¥{fmt(carryover || 0)}</span>
        </div>
        <div style={{ borderTop: `1px dashed ${COLORS.line}`, paddingTop: 10 }}>
          <div style={{ fontSize: 11.5, color: COLORS.textMute, marginBottom: 2 }}>原資（給料＋前月繰り越し）</div>
          <div className="mb-num" style={{ fontSize: 26, fontWeight: 700, color: COLORS.text }}>
            ¥{fmt(fund)}
          </div>
        </div>
        <div style={{ marginTop: 10, fontSize: 12.5, color: remain < 0 ? COLORS.danger : COLORS.textMute, display: "flex", alignItems: "center", gap: 4 }}>
          {remain < 0 && <AlertCircle size={13} />}
          残り ¥{fmt(remain)}（目標合計 ¥{fmt(totalTarget)}）
        </div>
      </Section>

      <Section
        title="カテゴリ別 振り分け"
        right={
          <button onClick={addCat} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", color: COLORS.clay }}>
            <Plus size={16} />
          </button>
        }
      >
        {data.categories.map((c) => {
          const ratio = c.target ? c.actual / c.target : 0;
          return (
            <div key={c.id} style={{ padding: "10px 0", borderBottom: `1px dashed ${COLORS.line}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <input
                  value={c.name}
                  onChange={(e) => setCat(c.id, { name: e.target.value })}
                  style={{ flex: 1, border: "none", background: "transparent", fontSize: 14, color: COLORS.text, outline: "none" }}
                />
                <button onClick={() => delCat(c.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                  <Trash2 size={13} color={COLORS.textMute} />
                </button>
              </div>
              <div style={{ display: "flex", gap: 14, marginBottom: 6 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10.5, color: COLORS.textMute, marginBottom: 2 }}>目標</div>
                  <NumField value={c.target} onChange={(v) => setCat(c.id, { target: v })} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10.5, color: COLORS.textMute, marginBottom: 2 }}>実績</div>
                  <NumField value={c.actual} onChange={(v) => setCat(c.id, { actual: v })} />
                </div>
              </div>
              <ProgressBar ratio={ratio} />
              {c.name !== "家計" && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                    <span style={{ fontSize: 10.5, color: COLORS.textMute }}>積み立て残高</span>
                    <div style={{ width: 130 }}>
                      <NumField value={c.balance ?? 0} onChange={(v) => setCat(c.id, { balance: v })} />
                    </div>
                  </div>
                  {Number(c.balance || 0) < 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, fontSize: 10.5, color: COLORS.danger }}>
                      <AlertCircle size={11} /> 積み立て残高がマイナスになっています
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </Section>
    </>
  );
}

function ChecklistTab({ data, update }) {
  const patchList = (field, id, patch) =>
    update((d) => ({ ...d, [field]: d[field].map((it) => (it.id === id ? { ...it, ...patch } : it)) }));
  const addItem = (field) =>
    update((d) => ({
      ...d,
      [field]: [...d[field], { id: nid(), label: "新しい項目", amount: 0, done: false, linkedCategory: null, deducted: 0 }],
    }));
  const delItem = (field, id) => {
    const item = data[field].find((it) => it.id === id);
    if (!item) return;
    if (!window.confirm(`「${item.label}」を削除しますか？`)) return;
    update((d) => ({ ...d, [field]: d[field].filter((it) => it.id !== id) }));
  };

  const patchPayment = (id, patch) => update((d) => reconcilePayment(d, id, patch));
  const deletePayment = (id) => {
    const item = data.payments.find((p) => p.id === id);
    if (!item) return;
    if (!window.confirm(`「${item.label}」を削除しますか？`)) return;
    update((d) => removePaymentWithReconcile(d, id));
  };

  const paidTotal = data.payments.reduce((s, p) => s + Number(p.amount || 0), 0);

  return (
    <>
      <Section
        title="支払いチェックリスト"
        right={
          <button onClick={() => addItem("payments")} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.clay }}>
            <Plus size={16} />
          </button>
        }
      >
        {data.payments.map((p) => (
          <CheckRow
            key={p.id}
            label={p.label}
            subtitle={p.linkedCategory ? `→ ${p.linkedCategory}の積み立てから差し引き` : null}
            done={p.done}
            onToggle={() => patchPayment(p.id, { done: !p.done })}
            onDelete={() => deletePayment(p.id)}
            right={
              <div style={{ width: 100 }}>
                <NumField value={p.amount} onChange={(v) => patchPayment(p.id, { amount: v })} prefix="" />
              </div>
            }
          />
        ))}
        <div style={{ textAlign: "right", fontSize: 12.5, color: COLORS.textMute, marginTop: 8 }}>
          合計 ¥{fmt(paidTotal)}
        </div>
      </Section>

      <Section
        title="月末にすること"
        right={
          <button onClick={() => addItem("monthEnd")} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.clay }}>
            <Plus size={16} />
          </button>
        }
      >
        {data.monthEnd.map((p) => (
          <CheckRow key={p.id} label={p.label} done={p.done} onToggle={() => patchList("monthEnd", p.id, { done: !p.done })} onDelete={() => delItem("monthEnd", p.id)} />
        ))}
      </Section>

      <Section
        title="25日にすること"
        right={
          <button onClick={() => addItem("day25")} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.clay }}>
            <Plus size={16} />
          </button>
        }
      >
        {data.day25.map((p) => (
          <CheckRow key={p.id} label={p.label} done={p.done} onToggle={() => patchList("day25", p.id, { done: !p.done })} onDelete={() => delItem("day25", p.id)} />
        ))}
      </Section>
    </>
  );
}

/* ---------- main ---------- */
export default function MoneyBook() {
  const [key, setKey] = useState(monthKey(new Date()));
  const [data, setData] = useState(null);
  const [carryover, setCarryover] = useState(0);
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef(null);

  const loadForKey = useCallback(async (k) => {
    setLoading(true);
    const prev = await loadMonth(addMonths(k, -1));
    const carry = prev ? prev.wallets.reduce((s, w) => s + Number(w.balance || 0), 0) : 0;
    let existing = await loadMonth(k);
    if (!existing) {
      const carryWallets = prev ? Object.fromEntries(prev.wallets.map((w) => [w.key, w.balance])) : null;
      existing = freshMonth(carryWallets, prev);
      await saveMonth(k, existing);
    } else {
      const normalizedWallets = normalizeWallets(existing.wallets);
      const salary = existing.salary ?? 0;
      const needsBalanceMigration = existing.categories.some((c) => c.balance === undefined);
      let categories = needsBalanceMigration
        ? existing.categories.map((c) => ({ ...c, balance: c.balance ?? 0 }))
        : existing.categories;

      // 支払いとカテゴリの連携を廃止したため、既存の連携は解除し、
      // すでに差し引かれていた分はカテゴリの積み立て残高に戻す
      const needsUnlink = existing.payments.some((p) => p.linkedCategory);
      let payments = existing.payments;
      if (needsUnlink) {
        payments = payments.map((p) => {
          if (p.linkedCategory && p.deducted) {
            categories = categories.map((c) =>
              c.name === p.linkedCategory ? { ...c, balance: Number(c.balance || 0) + p.deducted } : c
            );
          }
          return { ...p, linkedCategory: null, deducted: 0 };
        });
      }
      const needsPaymentFieldMigration = payments.some((p) => p.deducted === undefined || p.linkedCategory === undefined);
      if (needsPaymentFieldMigration) {
        payments = payments.map((p) => ({ ...p, linkedCategory: p.linkedCategory ?? null, deducted: p.deducted ?? 0 }));
      }

      if (
        JSON.stringify(normalizedWallets) !== JSON.stringify(existing.wallets) ||
        existing.salary === undefined ||
        needsBalanceMigration ||
        needsUnlink ||
        needsPaymentFieldMigration
      ) {
        existing = { ...existing, wallets: normalizedWallets, salary, categories, payments };
        await saveMonth(k, existing);
      }
    }
    setCarryover(carry);
    setData(existing);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadForKey(key);
  }, [key, loadForKey]);

  const fileInputRef = useRef(null);
  const [ioStatus, setIoStatus] = useState({ type: "idle", message: "" });

  const exportAllData = useCallback(async () => {
    setIoStatus({ type: "busy", message: "書き出し中…" });
    try {
      const list = await storage.list("month-data:");
      const months = {};
      for (const k of list?.keys || []) {
        try {
          const res = await storage.get(k);
          if (res) months[k.replace("month-data:", "")] = JSON.parse(res.value);
        } catch {
          // このキーの取得に失敗しても他は続行する
        }
      }
      const backup = { app: "money-book", version: 1, exportedAt: new Date().toISOString(), months };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `money-book-backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setIoStatus({ type: "success", message: "書き出しが完了しました" });
    } catch (e) {
      console.error("export failed", e);
      setIoStatus({ type: "error", message: "書き出しに失敗しました" });
    }
  }, []);

  const importFile = useCallback(
    async (file) => {
      const ok = window.confirm(
        "バックアップを読み込むと、現在保存されているデータが上書きされます。よろしいですか？"
      );
      if (!ok) return;
      setIoStatus({ type: "busy", message: "読み込み中…" });
      try {
        const text = await file.text();
        const backup = JSON.parse(text);
        if (!backup || typeof backup.months !== "object") {
          setIoStatus({ type: "error", message: "ファイルの形式が正しくありません" });
          return;
        }
        for (const [mk, monthObj] of Object.entries(backup.months)) {
          await storage.set(`month-data:${mk}`, JSON.stringify(monthObj));
        }
        await loadForKey(key);
        setIoStatus({ type: "success", message: "読み込みが完了しました" });
      } catch (e) {
        console.error("import failed", e);
        setIoStatus({ type: "error", message: "読み込みに失敗しました。ファイルをご確認ください" });
      }
    },
    [key, loadForKey]
  );

  const update = useCallback(
    (fn) => {
      setData((prev) => {
        const next = fn(prev);
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => saveMonth(key, next), 400);
        return next;
      });
    },
    [key]
  );

  const [tab, setTab] = useState("home");
  const tabs = [
    { id: "home", label: "ホーム", icon: HomeIcon },
    { id: "wallets", label: "財布", icon: Wallet },
    { id: "categories", label: "振り分け", icon: PiggyBank },
    { id: "checklist", label: "タスク", icon: ListChecks },
  ];

  const totalAssets = data ? data.wallets.reduce((s, w) => s + Number(w.balance || 0), 0) : 0;
  const fund = data ? Number(data.salary || 0) + Number(carryover || 0) : 0;

  return (
    <div
      className="mb-root"
      style={{
        background: COLORS.bg,
        height: "100dvh",
        borderRadius: 24,
        display: "flex",
        flexDirection: "column",
        maxWidth: 420,
        width: "100%",
        margin: "0 auto",
        overflow: "hidden",
        border: `1px solid ${COLORS.line}`,
      }}
    >
      <FontStyle />
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files && e.target.files[0];
          if (f) importFile(f);
          e.target.value = "";
        }}
      />

      {/* header */}
      <div style={{ flexShrink: 0, padding: "18px 18px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={() => setKey((k) => addMonths(k, -1))} style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }} aria-label="前の月">
          <ChevronLeft size={18} color={COLORS.text} />
        </button>
        <div style={{ textAlign: "center" }}>
          <div className="mb-display" style={{ fontSize: 17, fontWeight: 700, color: COLORS.text, letterSpacing: 1 }}>
            {monthLabel(key)}
          </div>
          <div className="mb-num" style={{ fontSize: 10.5, color: COLORS.textMute, marginTop: 2 }}>
            {monthRangeLabel(key)}
          </div>
        </div>
        <button onClick={() => setKey((k) => addMonths(k, 1))} style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }} aria-label="次の月">
          <ChevronRight size={18} color={COLORS.text} />
        </button>
      </div>

      {/* body */}
      <div className="mb-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 16px 16px", WebkitOverflowScrolling: "touch" }}>
        {loading || !data ? (
          <div style={{ textAlign: "center", color: COLORS.textMute, padding: 40, fontSize: 13 }}>読み込み中…</div>
        ) : tab === "home" ? (
          <HomeTab
            data={data}
            totalAssets={totalAssets}
            fund={fund}
            onExport={exportAllData}
            onImportClick={() => fileInputRef.current?.click()}
            ioStatus={ioStatus}
          />
        ) : tab === "wallets" ? (
          <WalletsTab data={data} update={update} />
        ) : tab === "categories" ? (
          <CategoriesTab data={data} update={update} fund={fund} carryover={carryover} />
        ) : (
          <ChecklistTab data={data} update={update} />
        )}
      </div>

      {/* tab bar */}
      <div style={{ flexShrink: 0, display: "flex", borderTop: `1px solid ${COLORS.line}`, background: COLORS.paper }}>
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1,
                border: "none",
                background: "none",
                padding: "10px 0 8px",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
              }}
            >
              <Icon size={19} color={active ? COLORS.ink : COLORS.textMute} strokeWidth={active ? 2.4 : 1.8} />
              <span style={{ fontSize: 10.5, color: active ? COLORS.ink : COLORS.textMute, fontWeight: active ? 700 : 400 }}>
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
