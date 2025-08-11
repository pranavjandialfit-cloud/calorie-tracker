import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Calorie Tracker — Apple-like single-file React app (v0.4)
 * -----------------------------------------------------------
 * v0.4 highlights
 * - Bottom tabs: Home / Log / Insights / Profile
 * - Quick Log panel (templates) + “Log your meal” sheet
 * - Meal-type chips (Breakfast/Lunch/Dinner/Snack)
 * - Insights & Profile stubs (ready to expand)
 * - Keeps fiber + polished UI from v0.3
 */

// ---------- Utilities ----------
const LS_KEY = "ct_entries_v4"; // bump for schema (mealType)
const todayKey = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD

const fmtTime = (d) =>
  new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

const clamp = (v, min = 0, max = 99999) => Math.min(max, Math.max(min, Number(v) || 0));

// Metric color helpers — refined, premium
const metricColor = {
  calories: "text-amber-600 dark:text-amber-300",
  protein: "text-emerald-600 dark:text-emerald-300",
  carbs: "text-sky-600 dark:text-sky-300",
  fat: "text-rose-600 dark:text-rose-300",
  fiber: "text-teal-600 dark:text-teal-300",
};

// Simple ring progress SVG for totals
function Ring({ value = 0, max = 100, size = 68, stroke = 8, label, className = "" }) {
  const pct = Math.min(100, Math.round((value / max) * 100 || 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <svg width={size} height={size} className="drop-shadow-sm">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} stroke="rgba(0,0,0,0.08)" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          stroke="currentColor"
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="text-center">
        <div className="text-xs font-medium text-black/60 dark:text-white/70">{label}</div>
        <div className="text-lg font-semibold tracking-tight">
          {Math.round(value)} / {Math.round(max)}
        </div>
      </div>
    </div>
  );
}

// ---------- Mock AI ----------
async function mockAIAnalyze(file) {
  const name = (file?.name || "").toLowerCase();
  const base = { calories: 300, protein: 12, carbs: 30, fat: 12, fiber: 5 };
  if (name.includes("salad")) return { calories: 180, protein: 6, carbs: 16, fat: 8, fiber: 4 };
  if (name.includes("pizza")) return { calories: 520, protein: 20, carbs: 60, fat: 22, fiber: 3 };
  if (name.includes("paneer")) return { calories: 350, protein: 22, carbs: 10, fat: 22, fiber: 0 };
  if (name.includes("chicken")) return { calories: 320, protein: 35, carbs: 4, fat: 16, fiber: 0 };
  if (name.includes("dal") || name.includes("lentil")) return { calories: 260, protein: 14, carbs: 34, fat: 4, fiber: 8 };
  return base;
}

/** @typedef {{ id:string, date:string, time:string, title:string, mealType?:string, photo?:string, calories:number, protein:number, carbs:number, fat:number, fiber:number, notes?:string }} Entry */

// ---------- Main App ----------
export default function App() {
  const [entries, setEntries] = useState(/** @type {Entry[]} */ ([]));
  const [activeDate, setActiveDate] = useState(todayKey());
  const [quickTarget, setQuickTarget] = useState({ kcal: 2000, protein: 140, carbs: 200, fat: 60, fiber: 25 });
  const [composerOpen, setComposerOpen] = useState(false);
  const [tab, setTab] = useState("home"); // 'home' | 'log' | 'insights' | 'profile'

  // Load & migrate
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || "null");
      if (Array.isArray(saved)) return setEntries(saved);

      // migrate older keys
      const keys = ["ct_entries_v3", "ct_entries_v2", "ct_entries_v1"];
      for (const k of keys) {
        const prev = JSON.parse(localStorage.getItem(k) || "null");
        if (Array.isArray(prev)) {
          const migrated = prev.map((e) => ({ fiber: 0, ...e })); // ensure fiber exists
          setEntries(migrated);
          localStorage.setItem(LS_KEY, JSON.stringify(migrated));
          break;
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(entries));
  }, [entries]);

  const dayEntries = useMemo(() => entries.filter((e) => e.date === activeDate), [entries, activeDate]);
  const totals = useMemo(
    () =>
      dayEntries.reduce(
        (acc, e) => ({
          calories: acc.calories + e.calories,
          protein: acc.protein + e.protein,
          carbs: acc.carbs + e.carbs,
          fat: acc.fat + e.fat,
          fiber: acc.fiber + e.fiber,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
      ),
    [dayEntries]
  );

  function addEntry(partial) {
    const now = new Date();
    const entry = {
      id: crypto.randomUUID(),
      date: activeDate,
      time: fmtTime(now),
      title: "Untitled",
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      ...partial,
    };
    setEntries((prev) => [entry, ...prev]);
  }

  function updateEntry(id, patch) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }
  function removeEntry(id) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }
  function duplicateEntry(entry) {
    const { id, ...rest } = entry;
    addEntry(rest);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f7f8fb] to-[#eef2f7] dark:from-neutral-950 dark:to-neutral-900 text-neutral-900 dark:text-neutral-100 font-sans selection:bg-black selection:text-white">
      <TopNav />

      <main className="mx-auto max-w-3xl px-4 pb-36">
        {tab === "home" && (
          <>
            <DateHeader activeDate={activeDate} setActiveDate={setActiveDate} />
            <SummaryBar totals={totals} target={quickTarget} setTarget={setQuickTarget} />
            <StreakAndNudge totals={totals} target={quickTarget} />
            <LogCard onOpen={() => setComposerOpen(true)} />

            <section className="mt-6">
              <h2 className="sr-only">Entries</h2>
              <div className="space-y-4">
                {dayEntries.length === 0 ? (
                  <EmptyState />
                ) : (
                  dayEntries.map((e) => (
                    <EntryCard
                      key={e.id}
                      entry={e}
                      onUpdate={updateEntry}
                      onDelete={() => removeEntry(e.id)}
                      onDuplicate={() => duplicateEntry(e)}
                    />
                  ))
                )}
              </div>
            </section>
          </>
        )}

        {tab === "log" && (
          <>
            <QuickLog onOpen={() => setComposerOpen(true)} onTemplate={(p) => addEntry(p)} />
            <div className="mt-4 text-sm text-black/60 dark:text-white/70">Recent today</div>
            <div className="mt-2 space-y-3">
              {dayEntries.map((e) => (
                <EntryCard
                  key={e.id}
                  entry={e}
                  onUpdate={updateEntry}
                  onDelete={() => removeEntry(e.id)}
                  onDuplicate={() => duplicateEntry(e)}
                />
              ))}
            </div>
          </>
        )}

        {tab === "insights" && <InsightsView entries={entries} />}

        {tab === "profile" && <SettingsView target={quickTarget} setTarget={setQuickTarget} />}
      </main>

      <MealComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onCreate={(e) => {
          addEntry(e);
          setComposerOpen(false);
        }}
      />

      <BottomTabs
        tab={tab}
        setTab={setTab}
        onToday={() => setActiveDate(todayKey())}
        onExport={() => downloadJSON(entries)}
        onImport={(data) => setEntries(data)}
      />
    </div>
  );
}

// ---------- UI Pieces ----------
function TopNav() {
  return (
    <header className="sticky top-0 z-20 backdrop-blur-xl bg-white/70 dark:bg-neutral-900/60 border-b border-black/5 dark:border-white/10">
      <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="text-sm tracking-tight text-black/60 dark:text-white/60">Calorie Tracker</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-black/50 dark:text-white/50">
          <span className="hidden sm:inline">Beta</span>
          <span className="px-2 py-1 rounded-full border border-black/10 dark:border-white/10">v0.4</span>
        </div>
      </div>
    </header>
  );
}

function DateHeader({ activeDate, setActiveDate }) {
  const ref = useRef(null);
  return (
    <section className="mt-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">Date</div>
          <div className="text-2xl font-semibold -mt-0.5">{activeDate}</div>
        </div>
        <div className="flex items-center gap-2">
          <button className="i-btn" onClick={() => setActiveDate(prevDay(activeDate))} aria-label="Previous day">
            ◀︎
          </button>
          <input
            ref={ref}
            type="date"
            className="i-input !w-[11.5rem]"
            value={activeDate}
            onChange={(e) => setActiveDate(e.target.value)}
          />
          <button className="i-btn" onClick={() => setActiveDate(nextDay(activeDate))} aria-label="Next day">
            ▶︎
          </button>
        </div>
      </div>
    </section>
  );
}

function SummaryBar({ totals, target, setTarget }) {
  const items = [
    { key: "calories", label: "Calories", max: target.kcal, val: totals.calories, cls: metricColor.calories },
    { key: "protein", label: "Protein", max: target.protein, val: totals.protein, cls: metricColor.protein },
    { key: "carbs", label: "Carbs", max: target.carbs, val: totals.carbs, cls: metricColor.carbs },
    { key: "fat", label: "Fat", max: target.fat, val: totals.fat, cls: metricColor.fat },
    { key: "fiber", label: "Fiber", max: target.fiber, val: totals.fiber, cls: metricColor.fiber },
  ];
  return (
    <section className="mt-4">
      <div className="glass p-4 rounded-3xl">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-6">
          {items.map((it) => (
            <div key={it.key} className="flex flex-col items-center">
              <Ring value={it.val} max={it.max} label={it.label} className={it.cls} />
            </div>
          ))}
        </div>
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-black/60 dark:text-white/60">Adjust daily targets</summary>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-3">
            <NumberField label="kcal" value={target.kcal} onChange={(v) => setTarget((t) => ({ ...t, kcal: v }))} />
            <NumberField label="protein" value={target.protein} onChange={(v) => setTarget((t) => ({ ...t, protein: v }))} />
            <NumberField label="carbs" value={target.carbs} onChange={(v) => setTarget((t) => ({ ...t, carbs: v }))} />
            <NumberField label="fat" value={target.fat} onChange={(v) => setTarget((t) => ({ ...t, fat: v }))} />
            <NumberField label="fiber" value={target.fiber} onChange={(v) => setTarget((t) => ({ ...t, fiber: v }))} />
          </div>
        </details>
      </div>
    </section>
  );
}

function StreakAndNudge({ totals, target }) {
  const proteinLeft = Math.max(0, Math.round(target.protein - totals.protein));
  const fiberLeft = Math.max(0, Math.round(target.fiber - totals.fiber));
  return (
    <div className="mt-3 grid grid-cols-2 gap-3">
      <div className="glass p-3 rounded-2xl text-sm">
        <div className="font-semibold">Streak</div>
        <div className="text-black/60">You’re on a 1-day streak. Keep logging!</div>
      </div>
      <div className="glass p-3 rounded-2xl text-sm">
        <div className="font-semibold">Today’s nudge</div>
        <div className="text-black/60">Protein {proteinLeft}g • Fiber {fiberLeft}g left</div>
      </div>
    </div>
  );
}

// ---------- Log Card + Composer ----------
function LogCard({ onOpen }) {
  return (
    <section className="mt-6">
      <button onClick={onOpen} className="block w-full text-left">
        <div className="glass rounded-3xl p-4 sm:p-5 flex items-center justify-between">
          <div>
            <div className="text-sm uppercase tracking-wide text-black/50 dark:text-white/50">Quick action</div>
            <div className="mt-1 text-xl font-semibold tracking-tight">Log your meal</div>
            <div className="text-sm text-black/55 dark:text-white/60 mt-1">Add photo • estimate • adjust macros</div>
          </div>
          <div className="i-btn primary shrink-0">Open</div>
        </div>
      </button>
    </section>
  );
}

function MealComposer({ open, onClose, onCreate }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    mealType: "",
    title: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    fiber: "",
    notes: "",
  });

  useEffect(() => {
    if (!file) return setPreview("");
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setForm({ mealType: "", title: "", calories: "", protein: "", carbs: "", fat: "", fiber: "", notes: "" });
    }
  }, [open]);

  async function handleMockAI() {
    if (!file) return;
    setLoading(true);
    try {
      const est = await mockAIAnalyze(file);
      setForm((f) => ({ ...f, ...est, title: f.title || guessTitleFromFile(file.name) }));
    } finally {
      setLoading(false);
    }
  }

  function handleAdd() {
    const entry = {
      mealType: form.mealType || undefined,
      title: form.title || "Meal",
      photo: preview || undefined,
      calories: clamp(form.calories),
      protein: clamp(form.protein),
      carbs: clamp(form.carbs),
      fat: clamp(form.fat),
      fiber: clamp(form.fiber),
      notes: form.notes?.trim() || undefined,
    };
    onCreate(entry);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-full max-w-3xl px-4 pb-4">
        <div className="sheet rounded-t-3xl p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="text-base font-semibold">Log your meal</div>
            <button className="i-btn" onClick={onClose}>
              Close
            </button>
          </div>

          <div className="mt-4 flex items-start gap-4">
            <label className="relative w-28 h-28 shrink-0 rounded-2xl overflow-hidden bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 flex items-center justify-center cursor-pointer">
              {preview ? (
                <img src={preview} alt="preview" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm text-black/60 dark:text-white/60">Add photo</span>
              )}
              <input
                type="file"
                accept="image/*"
                className="absolute inset-0 opacity-0"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>

            <div className="grid grid-cols-2 gap-3 flex-1">
              <div className="col-span-2 flex flex-wrap gap-2">
                {["Breakfast", "Lunch", "Dinner", "Snack"].map((t) => (
                  <button
                    key={t}
                    className={`i-btn ${form.mealType === t ? "primary !text-white" : ""}`}
                    onClick={(e) => {
                      e.preventDefault();
                      setForm((f) => ({ ...f, mealType: t }));
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <TextField
                label="Title"
                placeholder="e.g., Paneer Bowl"
                value={form.title}
                onChange={(v) => setForm((f) => ({ ...f, title: v }))}
              />
              <NumberField
                label="Calories"
                placeholder="kcal"
                value={form.calories}
                onChange={(v) => setForm((f) => ({ ...f, calories: v }))}
              />
              <NumberField
                label="Protein"
                placeholder="g"
                value={form.protein}
                onChange={(v) => setForm((f) => ({ ...f, protein: v }))}
              />
              <NumberField
                label="Carbs"
                placeholder="g"
                value={form.carbs}
                onChange={(v) => setForm((f) => ({ ...f, carbs: v }))}
              />
              <NumberField label="Fat" placeholder="g" value={form.fat} onChange={(v) => setForm((f) => ({ ...f, fat: v }))} />
              <NumberField
                label="Fiber"
                placeholder="g"
                value={form.fiber}
                onChange={(v) => setForm((f) => ({ ...f, fiber: v }))}
              />
              <TextField
                label="Notes"
                placeholder="optional"
                value={form.notes}
                onChange={(v) => setForm((f) => ({ ...f, notes: v }))}
              />

              <div className="col-span-2 flex gap-2 pt-1">
                <button className="i-btn primary" onClick={handleAdd} disabled={loading}>
                  Add Entry
                </button>
                <button className="i-btn" onClick={handleMockAI} disabled={!file || loading}>
                  {loading ? "Estimating…" : "Estimate via AI (mock)"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EntryCard({ entry, onUpdate, onDelete, onDuplicate }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry);

  useEffect(() => setDraft(entry), [entry]);

  const save = () => {
    onUpdate(entry.id, {
      title: draft.title || "Meal",
      calories: clamp(draft.calories),
      protein: clamp(draft.protein),
      carbs: clamp(draft.carbs),
      fat: clamp(draft.fat),
      fiber: clamp(draft.fiber),
      mealType: draft.mealType || undefined,
      notes: draft.notes?.trim() || undefined,
    });
    setEditing(false);
  };

  return (
    <article className="glass p-4 rounded-3xl">
      <div className="flex items-start gap-4">
        <div className="relative w-24 h-24 shrink-0 rounded-2xl overflow-hidden bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10">
          {entry.photo ? (
            <img src={entry.photo} alt={entry.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-black/50 dark:text-white/50">No photo</div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-3 min-w-0">
              {editing ? (
                <input
                  className="i-input !py-1 !px-2 !h-9 font-medium"
                  value={draft.title}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                />
              ) : (
                <h3 className="text-lg font-semibold tracking-tight truncate">{entry.title}</h3>
              )}
              {entry.mealType && (
                <span className="text-xs px-2 py-0.5 rounded-full border border-black/10">{entry.mealType}</span>
              )}
            </div>

            <div className="text-xs text-black/50 dark:text-white/60 shrink-0">{entry.time}</div>
          </div>

          <div className="mt-2 grid grid-cols-5 gap-2 text-sm">
            {editing ? (
              <>
                <NumMini label="kcal" value={draft.calories} onChange={(v) => setDraft((d) => ({ ...d, calories: v }))} />
                <NumMini label="P" value={draft.protein} onChange={(v) => setDraft((d) => ({ ...d, protein: v }))} />
                <NumMini label="C" value={draft.carbs} onChange={(v) => setDraft((d) => ({ ...d, carbs: v }))} />
                <NumMini label="F" value={draft.fat} onChange={(v) => setDraft((d) => ({ ...d, fat: v }))} />
                <NumMini label="Fi" value={draft.fiber} onChange={(v) => setDraft((d) => ({ ...d, fiber: v }))} />
              </>
            ) : (
              <>
                <Pill label="kcal" value={entry.calories} cls={metricColor.calories} />
                <Pill label="P" value={entry.protein} cls={metricColor.protein} />
                <Pill label="C" value={entry.carbs} cls={metricColor.carbs} />
                <Pill label="F" value={entry.fat} cls={metricColor.fat} />
                <Pill label="Fi" value={entry.fiber} cls={metricColor.fiber} />
              </>
            )}
          </div>

          <div className="mt-2">
            {editing ? (
              <input
                className="i-input !py-1 !px-2 !h-9"
                placeholder="Notes"
                value={draft.notes || ""}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              />
            ) : entry.notes ? (
              <div className="text-sm text-black/60 dark:text-white/65 truncate">{entry.notes}</div>
            ) : null}
          </div>

          <div className="mt-3 flex items-center gap-2">
            {editing ? (
              <>
                <button className="i-btn primary" onClick={save}>
                  Save
                </button>
                <button className="i-btn" onClick={() => setEditing(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button className="i-btn" onClick={() => setEditing(true)}>
                  Edit
                </button>
                <button className="i-btn" onClick={onDuplicate}>
                  Duplicate
                </button>
                <button className="i-btn danger" onClick={onDelete}>
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

// ---------- Tabs & Views ----------
function BottomTabs({ tab, setTab, onToday, onExport, onImport }) {
  const fileRef = useRef(null);
  return (
    <footer className="fixed bottom-4 left-0 right-0 z-20">
      <div className="mx-auto max-w-3xl px-4">
        <div className="glass rounded-2xl p-1 grid grid-cols-4">
          {["home", "log", "insights", "profile"].map((k) => (
            <button
              key={k}
              className={`i-btn !h-12 !rounded-xl border-0 ${tab === k ? "primary !text-white" : ""}`}
              onClick={() => setTab(k)}
            >
              {k === "home" ? "Home" : k === "log" ? "Log" : k === "insights" ? "Insights" : "Profile"}
            </button>
          ))}
        </div>

        {tab === "profile" && (
          <div className="mt-2 glass rounded-2xl p-2 flex items-center justify-between">
            <button className="i-btn" onClick={onToday}>
              Today
            </button>
            <div className="flex items-center gap-2">
              <button className="i-btn" onClick={() => onExport()}>
                Export JSON
              </button>
              <input
                type="file"
                accept="application/json"
                ref={fileRef}
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    const data = JSON.parse(await f.text());
                    if (Array.isArray(data)) onImport(data);
                  } catch {
                    alert("Invalid file");
                  } finally {
                    e.target.value = "";
                  }
                }}
              />
              <button className="i-btn" onClick={() => fileRef.current?.click()}>
                Import
              </button>
            </div>
          </div>
        )}
      </div>
    </footer>
  );
}

function QuickLog({ onOpen, onTemplate }) {
  const presets = [
    { title: "Greek Yogurt + Nuts", calories: 220, protein: 18, carbs: 14, fat: 10, fiber: 2, mealType: "Snack" },
    { title: "Paneer Bhurji", calories: 320, protein: 25, carbs: 8, fat: 20, fiber: 1, mealType: "Lunch" },
    { title: "Dal + Roti", calories: 380, protein: 18, carbs: 52, fat: 8, fiber: 9, mealType: "Dinner" },
  ];
  return (
    <section className="mt-6">
      <div className="glass rounded-3xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm uppercase text-black/50">Log</div>
            <div className="text-xl font-semibold">Photo, templates or favorites</div>
          </div>
          <button className="i-btn primary" onClick={onOpen}>
            + Add
          </button>
        </div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
          {presets.map((p, i) => (
            <button key={i} className="i-btn !justify-between" onClick={() => onTemplate(p)}>
              {p.title}
              <span className="text-black/60">{p.calories} kcal</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function InsightsView({ entries }) {
  // Simple weekly summary (last 7 days)
  const last7 = [...entries].filter((e) => {
    const d = new Date(e.date);
    const now = new Date();
    return (now - d) / 86400000 <= 6;
  });
  const totals = last7.reduce(
    (a, e) => ({
      calories: a.calories + e.calories,
      protein: a.protein + e.protein,
      carbs: a.carbs + e.carbs,
      fat: a.fat + e.fat,
      fiber: a.fiber + e.fiber,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  );
  return (
    <section className="mt-6">
      <div className="glass rounded-3xl p-4">
        <div className="text-xl font-semibold">Weekly insights</div>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
          <Pill label="kcal" value={totals.calories} />
          <Pill label="P" value={totals.protein} />
          <Pill label="C" value={totals.carbs} />
          <Pill label="F" value={totals.fat} />
          <Pill label="Fi" value={totals.fiber} />
        </div>
        <div className="mt-4 text-black/60 dark:text-white/70 text-sm">
          Coming soon: trends, macro split, best days, and coach export.
        </div>
      </div>
    </section>
  );
}

function SettingsView({ target, setTarget }) {
  return (
    <section className="mt-6">
      <div className="glass rounded-3xl p-4">
        <div className="text-xl font-semibold">Settings</div>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-3">
          <NumberField label="kcal" value={target.kcal} onChange={(v) => setTarget((t) => ({ ...t, kcal: v }))} />
          <NumberField label="protein" value={target.protein} onChange={(v) => setTarget((t) => ({ ...t, protein: v }))} />
          <NumberField label="carbs" value={target.carbs} onChange={(v) => setTarget((t) => ({ ...t, carbs: v }))} />
          <NumberField label="fat" value={target.fat} onChange={(v) => setTarget((t) => ({ ...t, fat: v }))} />
          <NumberField label="fiber" value={target.fiber} onChange={(v) => setTarget((t) => ({ ...t, fiber: v }))} />
        </div>
        <div className="mt-4 text-sm text-black/60 dark:text-white/70">Dark mode follows system theme.</div>
      </div>
    </section>
  );
}

// ---------- Small Elements ----------
function NumberField({ label, value, onChange, placeholder }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-black/60 dark:text-white/60">{label}</span>
      <input
        className="i-input"
        type="number"
        inputMode="decimal"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function TextField({ label, value, onChange, placeholder }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-black/60 dark:text-white/60">{label}</span>
      <input className="i-input" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function NumMini({ label, value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs w-8 text-black/60 dark:text-white/60">{label}</span>
      <input
        className="i-input !py-1 !px-2 !h-9 w-24"
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Pill({ label, value, cls = "" }) {
  return (
    <div className={`px-2 py-1 rounded-full border border-black/10 dark:border-white/10 text-xs flex items-center gap-1 w-fit ${cls}`}>
      <span className="opacity-60">{label}</span>
      <span className="font-medium">{Math.round(value)}</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="glass p-10 rounded-3xl text-center">
      <div className="text-2xl font-semibold">No entries yet</div>
      <div className="text-black/60 dark:text-white/60 mt-2">Tap “Log your meal” to add your first entry.</div>
    </div>
  );
}

function Logo() {
  return (
    <div className="relative">
      <div className="w-6 h-6 rounded-xl bg-gradient-to-br from-white to-black/10 dark:from-white/20 dark:to-black/40 border border-black/10 dark:border-white/10 shadow-sm" />
      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold tracking-tight text-black/70 dark:text-white/80">
        CT
      </div>
    </div>
  );
}

// ---------- Helpers ----------
function prevDay(iso) {
  const d = new Date(iso);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
function nextDay(iso) {
  const d = new Date(iso);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
function guessTitleFromFile(name = "") {
  const base = name.split(".")[0].replace(/[_-]+/g, " ");
  if (!base) return "Meal";
  return base
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
function downloadJSON(entries) {
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `calorie-tracker-${todayKey()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- Styles ----------
const style = document.createElement("style");
style.innerHTML = `
  .glass { background: linear-gradient(180deg, rgba(255,255,255,0.85), rgba(255,255,255,0.7));
           box-shadow: 0 10px 34px rgba(17,24,39,0.06);
           border: 1px solid rgba(0,0,0,0.06);
           backdrop-filter: blur(10px); }
  .dark .glass { background: linear-gradient(180deg, rgba(24,24,27,0.75), rgba(24,24,27,0.55));
                 box-shadow: 0 16px 40px rgba(0,0,0,0.35);
                 border: 1px solid rgba(255,255,255,0.08); }
  .i-input { height: 42px; border-radius: 14px; padding: 0 14px; border: 1px solid rgba(0,0,0,0.1);
             background: rgba(255,255,255,0.96); outline: none; width: 100%;
             box-shadow: inset 0 0 0 1px transparent; transition: box-shadow .2s, border-color .2s, background .2s; }
  .dark .i-input { background: rgba(24,24,27,0.85); border-color: rgba(255,255,255,0.12); }
  .i-input:focus { box-shadow: inset 0 0 0 2px rgba(0,0,0,0.75); }
  .dark .i-input:focus { box-shadow: inset 0 0 0 2px rgba(255,255,255,0.85); }
  .i-btn { height: 38px; padding: 0 14px; border-radius: 999px; border: 1px solid rgba(0,0,0,0.1);
           background: rgba(255,255,255,0.9); display: inline-flex; align-items: center; gap: 8px;
           box-shadow: 0 1px 0 rgba(255,255,255,0.6) inset, 0 2px 10px rgba(16,24,40,0.06);
           transition: transform .04s, filter .2s; }
  .dark .i-btn { background: rgba(24,24,27,0.85); border-color: rgba(255,255,255,0.12); }
  .i-btn:hover { filter: brightness(0.98); }
  .i-btn:active { transform: translateY(1px); }
  .i-btn.primary { background: linear-gradient(180deg, rgba(0,0,0,1), rgba(0,0,0,0.92)); color: white; border-color: black; }
  .i-btn.danger { border-color: rgba(255,0,0,0.3); color: #b40000; }
  .sheet { background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,255,255,0.94));
           border: 1px solid rgba(0,0,0,0.06); box-shadow: 0 -12px 40px rgba(17,24,39,0.16), 0 -2px 0 rgba(255,255,255,0.8) inset; }
  .dark .sheet { background: linear-gradient(180deg, rgba(24,24,27,0.98), rgba(24,24,27,0.94));
                 border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 -12px 40px rgba(0,0,0,0.6), 0 -2px 0 rgba(255,255,255,0.08) inset; }
`;
document.head.appendChild(style);
