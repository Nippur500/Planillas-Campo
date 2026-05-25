bash

cat /home/claude/planillas-campo/src/App.jsx
Salida

import { useState, useEffect } from "react";
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

const fmt = (n) => n != null && n !== "" ? `$${Number(n).toLocaleString("es-AR")}` : null;

const getStatus = (row) => {
  const tieneSeña = row.seña != null && Number(row.seña) > 0;
  const tieneSaldo = row.saldo != null && Number(row.saldo) > 0;
  if (tieneSeña && tieneSaldo) return { color: "#22c55e", label: "Al día", bg: "#052e16" };
  if (tieneSeña && !tieneSaldo) return { color: "#f97316", label: "Seña pagada", bg: "#1c0a00" };
  return { color: "#ef4444", label: "Sin pagar", bg: "#1c0505" };
};

export default function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [filterTorneo, setFilterTorneo] = useState("Todos");
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [search, setSearch] = useState("");
  const [showStats, setShowStats] = useState(false);
  const [showAddRow, setShowAddRow] = useState(false);
  const [showAddCol, setShowAddCol] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [extraCols, setExtraCols] = useState([]);
  const [newRow, setNewRow] = useState({});
  const [editingCard, setEditingCard] = useState(null);
  const [editData, setEditData] = useState({});

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
    .filter(r => {
      if (filterStatus === "Todos") return true;
      const s = getStatus(r);
      return s.label === filterStatus;
    })
    .filter(r => !search || r.nombre?.toLowerCase().includes(search.toLowerCase()) || r.torneo?.toLowerCase().includes(search.toLowerCase()) || r.observacion?.toLowerCase().includes(search.toLowerCase()));

  const saveCard = async (id) => {
    setSaving(true);
    try {
      await api(`torneos?id=eq.${id}`, "PATCH", editData);
      setData(prev => prev.map(r => r.id === id ? { ...r, ...editData } : r));
      setEditingCard(null);
      setEditData({});
    } catch (e) {
      setError("Error al guardar");
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
    setExtraCols(prev => [...prev, newColName.trim()]);
    setNewColName(""); setShowAddCol(false);
  };

  const exportToExcel = () => {
    const rows = filtered.map(r => ({
      Torneo: r.torneo, Nombre: r.nombre,
      "Fecha Seña": r.fecha_seña, Seña: r.seña,
      "Fecha Saldo": r.fecha_saldo, Saldo: r.saldo,
      Observación: r.observacion, Estado: getStatus(r).label,
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [20,25,12,12,12,12,20,14].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, "Torneos");
    XLSX.writeFile(wb, "planillas_campo.xlsx");
  };

  const totalSeña = filtered.reduce((s, r) => s + (Number(r.seña) || 0), 0);
  const totalSaldo = filtered.reduce((s, r) => s + (Number(r.saldo) || 0), 0);
  const alDia = filtered.filter(r => getStatus(r).label === "Al día").length;
  const conSeña = filtered.filter(r => getStatus(r).label === "Seña pagada").length;
  const sinPagar = filtered.filter(r => getStatus(r).label === "Sin pagar").length;

  const statsByTorneo = Array.from(new Set(data.map(r => r.torneo).filter(Boolean))).map(t => {
    const rows = data.filter(r => r.torneo === t);
    return {
      torneo: t, alumnos: rows.length,
      señas: rows.reduce((s, r) => s + (Number(r.seña) || 0), 0),
      saldos: rows.reduce((s, r) => s + (Number(r.saldo) || 0), 0),
      alDia: rows.filter(r => getStatus(r).label === "Al día").length,
      pendientes: rows.filter(r => getStatus(r).label === "Seña pagada").length,
      sinPagar: rows.filter(r => getStatus(r).label === "Sin pagar").length,
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
      <div style={{ background: "#1e293b", borderBottom: "1px solid #334155", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🏅</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#f1f5f9" }}>Planillas Campo Gimnástico</div>
            <div style={{ fontSize: 10, color: saving ? "#f59e0b" : "#10b981" }}>{saving ? "⏳ Guardando..." : "● Sincronizado con base de datos"}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          <Btn icon="📊" label="Estadísticas" onClick={() => setShowStats(true)} color="#6366f1" />
          <Btn icon="⬇" label="Excel" onClick={exportToExcel} color="#10b981" />
          <Btn icon="+" label="Alumno" onClick={() => setShowAddRow(true)} color="#3b82f6" />
          <Btn icon="⊞" label="Columna" onClick={() => setShowAddCol(true)} color="#475569" />
          <button onClick={loadData} title="Recargar" style={{ background: "#334155", border: "none", color: "#94a3b8", borderRadius: 7, padding: "7px 10px", cursor: "pointer", fontSize: 15 }}>↻</button>
        </div>
      </div>

      {/* STATS BAR */}
      <div style={{ background: "#162032", borderBottom: "1px solid #1e293b", padding: "8px 20px", display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
        <StatPill label="Total" value={filtered.length} color="#64748b" />
        <StatPill label="Al día" value={alDia} color="#22c55e" />
        <StatPill label="Seña pagada" value={conSeña} color="#f97316" />
        <StatPill label="Sin pagar" value={sinPagar} color="#ef4444" />
        <div style={{ width: 1, height: 16, background: "#334155" }} />
        <StatPill label="Señas" value={fmt(totalSeña)} color="#8b5cf6" />
        <StatPill label="Saldos" value={fmt(totalSaldo)} color="#10b981" />
        <StatPill label="Recaudado" value={fmt(totalSeña + totalSaldo)} color="#f59e0b" />
      </div>

      {error && (
        <div style={{ background: "#450a0a", padding: "8px 20px", fontSize: 13, color: "#fca5a5", display: "flex", justifyContent: "space-between" }}>
          {error}
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "#fca5a5", cursor: "pointer" }}>✕</button>
        </div>
      )}

      {/* FILTERS */}
      <div style={{ padding: "12px 20px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input placeholder="🔍 Buscar..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 7, padding: "7px 12px", color: "#e2e8f0", fontSize: 13, outline: "none", width: 200 }} />
        <select value={filterTorneo} onChange={e => setFilterTorneo(e.target.value)}
          style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 7, padding: "7px 12px", color: "#e2e8f0", fontSize: 13, outline: "none" }}>
          {torneos.map(t => <option key={t}>{t}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 7, padding: "7px 12px", color: "#e2e8f0", fontSize: 13, outline: "none" }}>
          {["Todos", "Al día", "Seña pagada", "Sin pagar"].map(s => <option key={s}>{s}</option>)}
        </select>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#475569" }}>{filtered.length} alumnos</span>
      </div>

      {/* CARDS GRID */}
      <div style={{ padding: "0 20px 32px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        {filtered.map(row => {
          const status = getStatus(row);
          const isEditing = editingCard === row.id;
          return (
            <div key={row.id} style={{ background: "#1e293b", borderRadius: 10, overflow: "hidden", border: "1px solid #334155", position: "relative" }}>
              {/* Color bar top */}
              <div style={{ height: 4, background: status.color, width: "100%" }} />

              <div style={{ padding: "14px 14px 10px" }}>
                {/* Name + status */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  {isEditing ? (
                    <input value={editData.nombre ?? row.nombre} onChange={e => setEditData(p => ({ ...p, nombre: e.target.value }))}
                      style={{ background: "#0f172a", border: "1px solid #3b82f6", borderRadius: 5, padding: "4px 8px", color: "#f1f5f9", fontSize: 14, fontWeight: 600, width: "70%", outline: "none" }} autoFocus />
                  ) : (
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", lineHeight: 1.3 }}>{row.nombre}</div>
                  )}
                  <span style={{ fontSize: 10, fontWeight: 600, color: status.color, background: status.bg, padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap", marginLeft: 6 }}>{status.label}</span>
                </div>

                {/* Torneo */}
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>
                  {isEditing ? (
                    <input value={editData.torneo ?? row.torneo} onChange={e => setEditData(p => ({ ...p, torneo: e.target.value }))}
                      style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 4, padding: "2px 6px", color: "#94a3b8", fontSize: 11, width: "100%", outline: "none" }} />
                  ) : row.torneo}
                </div>

                {/* Payment grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                  <PayField label="Seña" amount={isEditing ? editData.seña ?? row.seña : row.seña} date={isEditing ? editData.fecha_seña ?? row.fecha_seña : row.fecha_seña}
                    editing={isEditing} onAmountChange={v => setEditData(p => ({ ...p, seña: v }))} onDateChange={v => setEditData(p => ({ ...p, fecha_seña: v }))} color="#8b5cf6" />
                  <PayField label="Saldo" amount={isEditing ? editData.saldo ?? row.saldo : row.saldo} date={isEditing ? editData.fecha_saldo ?? row.fecha_saldo : row.fecha_saldo}
                    editing={isEditing} onAmountChange={v => setEditData(p => ({ ...p, saldo: v }))} onDateChange={v => setEditData(p => ({ ...p, fecha_saldo: v }))} color="#10b981" />
                </div>

                {/* Observacion */}
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
                  {isEditing ? (
                    <input value={editData.observacion ?? row.observacion} onChange={e => setEditData(p => ({ ...p, observacion: e.target.value }))}
                      placeholder="Observación..."
                      style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 4, padding: "4px 8px", color: "#94a3b8", fontSize: 12, width: "100%", outline: "none", boxSizing: "border-box" }} />
                  ) : (
                    row.observacion ? <span style={{ color: "#94a3b8" }}>💬 {row.observacion}</span> : null
                  )}
                </div>

                {/* Extra cols */}
                {extraCols.map(col => (
                  <div key={col} style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>
                    <span style={{ textTransform: "uppercase", letterSpacing: 1, fontSize: 10 }}>{col}: </span>
                    {isEditing ? (
                      <input value={editData[col] ?? row[col] ?? ""} onChange={e => setEditData(p => ({ ...p, [col]: e.target.value }))}
                        style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 4, padding: "2px 6px", color: "#94a3b8", fontSize: 12, outline: "none" }} />
                    ) : <span style={{ color: "#94a3b8" }}>{row[col] || "—"}</span>}
                  </div>
                ))}

                {/* Actions */}
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  {isEditing ? (
                    <>
                      <ActionBtn onClick={() => { setEditingCard(null); setEditData({}); }} secondary>Cancelar</ActionBtn>
                      <ActionBtn onClick={() => saveCard(row.id)} color="#3b82f6">Guardar</ActionBtn>
                    </>
                  ) : (
                    <>
                      <ActionBtn onClick={() => deleteRow(row.id)} color="#ef444420" textColor="#ef4444">Eliminar</ActionBtn>
                      <ActionBtn onClick={() => { setEditingCard(row.id); setEditData({}); }} color="#3b82f620" textColor="#3b82f6">Editar</ActionBtn>
                    </>
                  )}
                </div>
              </div>

              {/* Color bar bottom */}
              <div style={{ height: 5, background: status.color, width: "100%", opacity: 0.7 }} />
            </div>
          );
        })}
      </div>

      {/* MODAL ESTADÍSTICAS */}
      {showStats && (
        <Modal onClose={() => setShowStats(false)} title="Estadísticas por torneo">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10, marginBottom: 14 }}>
            {statsByTorneo.map(s => (
              <div key={s.torneo} style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9", marginBottom: 10 }}>{s.torneo}</div>
                <SRow label="Alumnos" val={s.alumnos} />
                <SRow label="Al día" val={s.alDia} color="#22c55e" />
                <SRow label="Seña pagada" val={s.pendientes} color="#f97316" />
                <SRow label="Sin pagar" val={s.sinPagar} color="#ef4444" />
                <SRow label="Total señas" val={fmt(s.señas)} color="#8b5cf6" />
                <SRow label="Total saldos" val={fmt(s.saldos)} color="#10b981" />
              </div>
            ))}
          </div>
          <div style={{ background: "#0f172a", border: "1px solid #f59e0b40", borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#f59e0b", marginBottom: 10 }}>Total general</div>
            <SRow label="Alumnos" val={data.length} />
            <SRow label="Al día" val={data.filter(r => getStatus(r).label === "Al día").length} color="#22c55e" />
            <SRow label="Seña pagada" val={data.filter(r => getStatus(r).label === "Seña pagada").length} color="#f97316" />
            <SRow label="Sin pagar" val={data.filter(r => getStatus(r).label === "Sin pagar").length} color="#ef4444" />
            <SRow label="Total señas" val={fmt(data.reduce((s, r) => s + (Number(r.seña) || 0), 0))} color="#8b5cf6" />
            <SRow label="Total saldos" val={fmt(data.reduce((s, r) => s + (Number(r.saldo) || 0), 0))} color="#10b981" />
            <SRow label="Total recaudado" val={fmt(data.reduce((s, r) => s + (Number(r.seña) || 0) + (Number(r.saldo) || 0), 0))} color="#f59e0b" />
          </div>
        </Modal>
      )}

      {/* MODAL NUEVO ALUMNO */}
      {showAddRow && (
        <Modal onClose={() => setShowAddRow(false)} title="Nuevo alumno">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[{k:"nombre",l:"Nombre y Apellido",full:true},{k:"torneo",l:"Torneo"},{k:"fecha_seña",l:"Fecha Seña"},{k:"seña",l:"Seña $"},{k:"fecha_saldo",l:"Fecha Saldo"},{k:"saldo",l:"Saldo $"},{k:"observacion",l:"Observación",full:true}].map(f => (
              <div key={f.k} style={{ gridColumn: f.full ? "1 / -1" : "auto" }}>
                <label style={{ display: "block", fontSize: 10, color: "#64748b", marginBottom: 3, textTransform: "uppercase", letterSpacing: 1 }}>{f.l}</label>
                <input value={newRow[f.k] ?? ""} onChange={e => setNewRow(p => ({ ...p, [f.k]: e.target.value }))}
                  style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 6, padding: "7px 10px", color: "#e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <ActionBtn onClick={() => setShowAddRow(false)} secondary>Cancelar</ActionBtn>
            <ActionBtn onClick={addRow} color="#3b82f6">Guardar</ActionBtn>
          </div>
        </Modal>
      )}

      {/* MODAL NUEVA COLUMNA */}
      {showAddCol && (
        <Modal onClose={() => setShowAddCol(false)} title="Nueva columna">
          <input placeholder="Nombre de la columna" value={newColName} onChange={e => setNewColName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addColumn()} autoFocus
            style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 6, padding: "8px 10px", color: "#e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <ActionBtn onClick={() => setShowAddCol(false)} secondary>Cancelar</ActionBtn>
            <ActionBtn onClick={addColumn} color="#3b82f6">Agregar</ActionBtn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function PayField({ label, amount, date, editing, onAmountChange, onDateChange, color }) {
  return (
    <div style={{ background: "#0f172a", borderRadius: 7, padding: "8px 10px", border: "1px solid #1e293b" }}>
      <div style={{ fontSize: 10, color: color, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{label}</div>
      {editing ? (
        <>
          <input value={amount ?? ""} onChange={e => onAmountChange(e.target.value === "" ? null : Number(e.target.value))} placeholder="Monto"
            style={{ width: "100%", background: "#1e293b", border: "1px solid #334155", borderRadius: 4, padding: "3px 6px", color: "#f1f5f9", fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 4 }} />
          <input value={date ?? ""} onChange={e => onDateChange(e.target.value)} placeholder="Fecha"
            style={{ width: "100%", background: "#1e293b", border: "1px solid #334155", borderRadius: 4, padding: "3px 6px", color: "#94a3b8", fontSize: 11, outline: "none", boxSizing: "border-box" }} />
        </>
      ) : (
        <>
          <div style={{ fontSize: 15, fontWeight: 700, color: amount ? color : "#334155" }}>{amount ? `$${Number(amount).toLocaleString("es-AR")}` : "—"}</div>
          <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>{date || ""}</div>
        </>
      )}
    </div>
  );
}

function StatPill({ label, value, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
      <span style={{ fontSize: 11, color: "#64748b" }}>{label}:</span>
      <span style={{ fontSize: 12, fontWeight: 600, color }}>{value}</span>
    </div>
  );
}

function Btn({ icon, label, onClick, color }) {
  return (
    <button onClick={onClick} style={{ background: color, border: "none", color: "#fff", borderRadius: 7, padding: "6px 12px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontWeight: 500 }}
      onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
      onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
      {icon} {label}
    </button>
  );
}

function ActionBtn({ children, onClick, color, textColor, secondary }) {
  return (
    <button onClick={onClick} style={{ background: secondary ? "#0f172a" : (color || "#3b82f6"), border: secondary ? "1px solid #334155" : "none", color: secondary ? "#64748b" : (textColor || "#fff"), borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontWeight: 500 }}>
      {children}
    </button>
  );
}

function Modal({ children, onClose, title }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
      <div style={{ background: "#1e293b", borderRadius: 12, border: "1px solid #334155", padding: 22, width: "100%", maxWidth: 540, maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#f1f5f9" }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 18 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SRow({ label, val, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid #1e293b" }}>
      <span style={{ fontSize: 11, color: "#64748b" }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: color || "#e2e8f0" }}>{val}</span>
    </div>
  );
}