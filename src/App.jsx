import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";

const SUPABASE_URL = "https://qoxkhxodvurxlnsokonl.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFveGtoeG9kdnVyeGxuc29rb25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NzA4MzksImV4cCI6MjA5NTA0NjgzOX0.wUwCVJ19wg5YPQWJzO4kc_az1_UVOHNOfcSnmhoOlE8";

const api = async (path, method = "GET", body = null) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : null,
  });
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return text ? JSON.parse(text) : [];
};

const BASE_COLUMNS = [
  { key: "torneo", label: "Torneo", width: 110 },
  { key: "nombre", label: "Nombre y Apellido", width: 190 },
  { key: "fecha_seña", label: "F. Seña", width: 90 },
  { key: "seña", label: "Seña $", width: 100, numeric: true },
  { key: "fecha_saldo", label: "F. Saldo", width: 90 },
  { key: "saldo", label: "Saldo $", width: 100, numeric: true },
  { key: "observacion", label: "Observación", width: 160 },
];

const fmt = (n) => n != null && n !== "" ? `$${Number(n).toLocaleString("es-AR")}` : "—";

export default function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [columns, setColumns] = useState(BASE_COLUMNS);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [filterTorneo, setFilterTorneo] = useState("Todos");
  const [search, setSearch] = useState("");
  const [showAddCol, setShowAddCol] = useState(false);
  const [showAddRow, setShowAddRow] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newRow, setNewRow] = useState({});
  const [sortConfig, setSortConfig] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await api("torneos?order=id.asc&select=*");
      setData(rows);
    } catch (e) {
      setError("Error al cargar: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const torneos = ["Todos", ...Array.from(new Set(data.map(r => r.torneo).filter(Boolean)))];

  const filtered = data
    .filter(r => filterTorneo === "Todos" || r.torneo === filterTorneo)
    .filter(r => !search || columns.some(c => String(r[c.key] ?? "").toLowerCase().includes(search.toLowerCase())))
    .sort((a, b) => {
      if (!sortConfig) return 0;
      const av = a[sortConfig.key] ?? "", bv = b[sortConfig.key] ?? "";
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortConfig.dir === "asc" ? cmp : -cmp;
    });

  const startEdit = (id, key, val) => {
    setEditingCell({ id, key });
    setEditValue(String(val ?? ""));
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const commitEdit = async () => {
    if (!editingCell) return;
    const { id, key } = editingCell;
    const col = columns.find(c => c.key === key);
    const value = col?.numeric ? (editValue === "" ? null : Number(editValue)) : editValue;
    setData(prev => prev.map(r => r.id === id ? { ...r, [key]: value } : r));
    setEditingCell(null);
    setSaving(true);
    try {
      await api(`torneos?id=eq.${id}`, "PATCH", { [key]: value });
    } catch (e) {
      setError("Error al guardar"); loadData();
    } finally {
      setSaving(false);
    }
  };

  const deleteRow = async (id) => {
    if (!confirm("¿Eliminar este registro?")) return;
    setData(prev => prev.filter(r => r.id !== id));
    try { await api(`torneos?id=eq.${id}`, "DELETE"); }
    catch (e) { setError("Error al eliminar"); loadData(); }
  };

  const addRow = async () => {
    const row = { torneo: "", nombre: "", fecha_seña: "", seña: null, fecha_saldo: "", saldo: null, observacion: "", ...newRow };
    setSaving(true);
    try {
      const [created] = await api("torneos", "POST", row);
      setData(prev => [...prev, created]);
      setNewRow({}); setShowAddRow(false);
    } catch (e) { setError("Error al agregar"); }
    finally { setSaving(false); }
  };

  const addColumn = () => {
    if (!newColName.trim()) return;
    const key = newColName.trim().toLowerCase().replace(/\s+/g, "_");
    setColumns(prev => [...prev, { key, label: newColName.trim(), width: 130 }]);
    setNewColName(""); setShowAddCol(false);
  };

  const handleSort = (key) => {
    setSortConfig(prev => prev?.key === key
      ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
      : { key, dir: "asc" });
  };

  const exportToExcel = () => {
    const rows = filtered.map(r => {
      const obj = {};
      columns.forEach(c => { obj[c.label] = r[c.key] ?? ""; });
      return obj;
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = columns.map(c => ({ wch: Math.max(c.label.length, 14) }));
    XLSX.utils.book_append_sheet(wb, ws, "Torneos");
    XLSX.writeFile(wb, "planillas_campo.xlsx");
  };

  const totalSeña = filtered.reduce((s, r) => s + (Number(r.seña) || 0), 0);
  const totalSaldo = filtered.reduce((s, r) => s + (Number(r.saldo) || 0), 0);
  const conSeña = filtered.filter(r => r.seña).length;
  const conSaldo = filtered.filter(r => r.saldo).length;
  const sinSaldo = filtered.filter(r => !r.saldo).length;
  const totalRecaudado = totalSeña + totalSaldo;

  const statsByTorneo = Array.from(new Set(data.map(r => r.torneo).filter(Boolean))).map(t => {
    const rows = data.filter(r => r.torneo === t);
    return {
      torneo: t,
      alumnos: rows.length,
      señas: rows.reduce((s, r) => s + (Number(r.seña) || 0), 0),
      saldos: rows.reduce((s, r) => s + (Number(r.saldo) || 0), 0),
      pendientes: rows.filter(r => !r.saldo).length,
    };
  });

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0f172a", color: "#94a3b8", fontFamily: "system-ui, sans-serif", fontSize: 16 }}>
      Cargando datos...
    </div>
  );

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: "#0f172a", minHeight: "100vh", color: "#e2e8f0" }}>

      {/* HEADER */}
      <div style={{ background: "#1e293b", borderBottom: "1px solid #334155", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🏅</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 600, color: "#f1f5f9" }}>Planillas Campo Gimnástico</div>
            <div style={{ fontSize: 11, color: saving ? "#f59e0b" : "#10b981" }}>{saving ? "⏳ Guardando..." : "● Sincronizado"}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn icon="📊" label="Estadísticas" onClick={() => setShowStats(true)} color="#6366f1" />
          <Btn icon="⬇" label="Excel" onClick={exportToExcel} color="#10b981" />
          <Btn icon="+" label="Alumno" onClick={() => setShowAddRow(true)} color="#3b82f6" />
          <Btn icon="⊞" label="Columna" onClick={() => setShowAddCol(true)} color="#475569" />
          <button onClick={loadData} title="Recargar" style={{ background: "#334155", border: "none", color: "#94a3b8", borderRadius: 7, padding: "7px 11px", cursor: "pointer", fontSize: 16 }}>↻</button>
        </div>
      </div>

      {/* STATS BAR */}
      <div style={{ background: "#1e293b", borderBottom: "1px solid #1e293b", padding: "10px 24px", display: "flex", gap: 24, flexWrap: "wrap" }}>
        <StatPill label="Alumnos" value={filtered.length} color="#3b82f6" />
        <StatPill label="Señas cobradas" value={fmt(totalSeña)} color="#8b5cf6" />
        <StatPill label="Saldos cobrados" value={fmt(totalSaldo)} color="#10b981" />
        <StatPill label="Total recaudado" value={fmt(totalRecaudado)} color="#f59e0b" />
        <StatPill label="Sin saldo" value={sinSaldo} color="#ef4444" />
      </div>

      {error && (
        <div style={{ background: "#450a0a", borderBottom: "1px solid #7f1d1d", padding: "10px 24px", fontSize: 13, color: "#fca5a5", display: "flex", justifyContent: "space-between" }}>
          {error}
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "#fca5a5", cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>
      )}

      {/* FILTERS */}
      <div style={{ padding: "12px 24px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input placeholder="🔍  Buscar..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 7, padding: "8px 14px", color: "#e2e8f0", fontSize: 13, outline: "none", width: 220 }} />
        <select value={filterTorneo} onChange={e => setFilterTorneo(e.target.value)}
          style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 7, padding: "8px 14px", color: "#e2e8f0", fontSize: 13, outline: "none" }}>
          {torneos.map(t => <option key={t}>{t}</option>)}
        </select>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#475569" }}>{filtered.length} registros — clic en celda para editar</span>
      </div>

      {/* TABLE */}
      <div style={{ overflowX: "auto", padding: "0 24px 32px" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 700 }}>
          <thead>
            <tr style={{ background: "#1e293b" }}>
              {columns.map(c => (
                <th key={c.key} onClick={() => handleSort(c.key)}
                  style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: "#64748b", cursor: "pointer", whiteSpace: "nowrap", borderBottom: "1px solid #334155", userSelect: "none", minWidth: c.width }}>
                  {c.label} {sortConfig?.key === c.key ? (sortConfig.dir === "asc" ? "↑" : "↓") : ""}
                </th>
              ))}
              <th style={{ width: 32, borderBottom: "1px solid #334155" }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr key={row.id} style={{ borderBottom: "1px solid #1e293b", background: i % 2 === 0 ? "#0f172a" : "#111827" }}
                onMouseEnter={e => e.currentTarget.style.background = "#1e293b"}
                onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "#0f172a" : "#111827"}>
                {columns.map(c => (
                  <td key={c.key} onClick={() => startEdit(row.id, c.key, row[c.key])}
                    style={{ padding: "9px 12px", fontSize: 13, color: c.numeric ? "#34d399" : c.key === "nombre" ? "#f1f5f9" : "#cbd5e1", fontWeight: c.key === "nombre" ? 500 : 400, cursor: "text", maxWidth: c.width, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {editingCell?.id === row.id && editingCell?.key === c.key ? (
                      <input ref={inputRef} value={editValue} onChange={e => setEditValue(e.target.value)}
                        onBlur={commitEdit} onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingCell(null); }}
                        style={{ background: "#0f172a", border: "1px solid #3b82f6", borderRadius: 4, padding: "3px 6px", color: "#f1f5f9", fontSize: 13, width: "100%", outline: "none" }} />
                    ) : (
                      c.numeric ? fmt(row[c.key]) : (row[c.key] || <span style={{ color: "#334155" }}>—</span>)
                    )}
                  </td>
                ))}
                <td style={{ padding: "0 6px", textAlign: "center" }}>
                  <button onClick={() => deleteRow(row.id)} style={{ background: "none", border: "none", color: "#334155", cursor: "pointer", fontSize: 16, lineHeight: 1 }}
                    onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                    onMouseLeave={e => e.currentTarget.style.color = "#334155"}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL: ESTADÍSTICAS */}
      {showStats && (
        <Modal onClose={() => setShowStats(false)} title="Estadísticas por torneo">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
            {statsByTorneo.map(s => (
              <div key={s.torneo} style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", marginBottom: 10 }}>{s.torneo}</div>
                <Row label="Alumnos" val={s.alumnos} />
                <Row label="Total señas" val={fmt(s.señas)} />
                <Row label="Total saldos" val={fmt(s.saldos)} />
                <Row label="Sin saldo" val={s.pendientes} danger={s.pendientes > 0} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, padding: "12px 16px", background: "#0f172a", borderRadius: 8, border: "1px solid #334155" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#f59e0b", marginBottom: 8 }}>Total general</div>
            <Row label="Alumnos totales" val={data.length} />
            <Row label="Total señas" val={fmt(data.reduce((s, r) => s + (Number(r.seña) || 0), 0))} />
            <Row label="Total saldos" val={fmt(data.reduce((s, r) => s + (Number(r.saldo) || 0), 0))} />
            <Row label="Total recaudado" val={fmt(data.reduce((s, r) => s + (Number(r.seña) || 0) + (Number(r.saldo) || 0), 0))} />
          </div>
        </Modal>
      )}

      {/* MODAL: NUEVO ALUMNO */}
      {showAddRow && (
        <Modal onClose={() => setShowAddRow(false)} title="Nuevo alumno">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {BASE_COLUMNS.map(c => (
              <div key={c.key} style={{ gridColumn: c.key === "observacion" || c.key === "nombre" ? "1 / -1" : "auto" }}>
                <label style={{ display: "block", fontSize: 11, color: "#64748b", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>{c.label}</label>
                <input value={newRow[c.key] ?? ""} onChange={e => setNewRow(p => ({ ...p, [c.key]: e.target.value }))}
                  style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 6, padding: "8px 10px", color: "#e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
            <BtnModal onClick={() => setShowAddRow(false)} secondary>Cancelar</BtnModal>
            <BtnModal onClick={addRow}>Guardar</BtnModal>
          </div>
        </Modal>
      )}

      {/* MODAL: NUEVA COLUMNA */}
      {showAddCol && (
        <Modal onClose={() => setShowAddCol(false)} title="Nueva columna">
          <input placeholder="Nombre de la columna" value={newColName} onChange={e => setNewColName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addColumn()} autoFocus
            style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 6, padding: "9px 12px", color: "#e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 14 }} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <BtnModal onClick={() => setShowAddCol(false)} secondary>Cancelar</BtnModal>
            <BtnModal onClick={addColumn}>Agregar</BtnModal>
          </div>
        </Modal>
      )}
    </div>
  );
}

function StatPill({ label, value, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }}></div>
      <span style={{ fontSize: 12, color: "#64748b" }}>{label}:</span>
      <span style={{ fontSize: 13, fontWeight: 600, color }}>{value}</span>
    </div>
  );
}

function Btn({ icon, label, onClick, color }) {
  return (
    <button onClick={onClick} style={{ background: color, border: "none", color: "#fff", borderRadius: 7, padding: "7px 14px", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontWeight: 500 }}
      onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
      onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
      <span>{icon}</span> {label}
    </button>
  );
}

function BtnModal({ children, onClick, secondary }) {
  return (
    <button onClick={onClick} style={{ background: secondary ? "#1e293b" : "#3b82f6", border: secondary ? "1px solid #334155" : "none", color: secondary ? "#94a3b8" : "#fff", borderRadius: 7, padding: "8px 18px", fontSize: 13, cursor: "pointer", fontWeight: 500 }}>
      {children}
    </button>
  );
}

function Modal({ children, onClose, title }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
      <div style={{ background: "#1e293b", borderRadius: 12, border: "1px solid #334155", padding: 24, width: "100%", maxWidth: 560, maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#f1f5f9" }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Row({ label, val, danger }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #1e293b" }}>
      <span style={{ fontSize: 12, color: "#64748b" }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 500, color: danger ? "#ef4444" : "#e2e8f0" }}>{val}</span>
    </div>
  );
}
