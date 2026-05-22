import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";

const SUPABASE_URL = "https://qoxkhxodvurxlnsokonl.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFveGtoeG9kdnVyeGxuc29rb25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NzA4MzksImV4cCI6MjA5NTA0NjgzOX0.wUwCVJ19wg5YPQWJzO4kc_az1_UVOHNOfcSnmhoOlE8";

const api = async (path, method = "GET", body = null) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
    },
    body: body ? JSON.stringify(body) : null,
  });
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return text ? JSON.parse(text) : [];
};

const BASE_COLUMNS = [
  { key: "torneo", label: "Torneo", width: "120px" },
  { key: "nombre", label: "Nombre y Apellido", width: "200px" },
  { key: "fecha_seña", label: "Fecha Seña", width: "110px" },
  { key: "seña", label: "Seña", width: "100px", numeric: true },
  { key: "fecha_saldo", label: "Fecha Saldo", width: "110px" },
  { key: "saldo", label: "Saldo", width: "100px", numeric: true },
  { key: "observacion", label: "Observación", width: "160px" },
];

export default function GimnasiaTorneos() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [columns, setColumns] = useState(BASE_COLUMNS);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [filterTorneo, setFilterTorneo] = useState("Todos");
  const [search, setSearch] = useState("");
  const [newColName, setNewColName] = useState("");
  const [showAddCol, setShowAddCol] = useState(false);
  const [showAddRow, setShowAddRow] = useState(false);
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
      setError("Error al cargar datos: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const torneos = ["Todos", ...Array.from(new Set(data.map(r => r.torneo).filter(Boolean)))];

  const filtered = data
    .filter(r => filterTorneo === "Todos" || r.torneo === filterTorneo)
    .filter(r => {
      if (!search) return true;
      return columns.some(c => String(r[c.key] ?? "").toLowerCase().includes(search.toLowerCase()));
    })
    .sort((a, b) => {
      if (!sortConfig) return 0;
      const av = a[sortConfig.key] ?? "";
      const bv = b[sortConfig.key] ?? "";
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortConfig.dir === "asc" ? cmp : -cmp;
    });

  const startEdit = (id, key, val) => {
    setEditingCell({ id, key });
    setEditValue(String(val ?? ""));
    setTimeout(() => inputRef.current?.focus(), 50);
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
      setError("Error al guardar: " + e.message);
      loadData();
    } finally {
      setSaving(false);
    }
  };

  const deleteRow = async (id) => {
    if (!confirm("¿Eliminar esta fila?")) return;
    setData(prev => prev.filter(r => r.id !== id));
    setSaving(true);
    try {
      await api(`torneos?id=eq.${id}`, "DELETE");
    } catch (e) {
      setError("Error al eliminar: " + e.message);
      loadData();
    } finally {
      setSaving(false);
    }
  };

  const addRow = async () => {
    const row = { torneo: "", nombre: "", fecha_seña: "", seña: null, fecha_saldo: "", saldo: null, observacion: "", ...newRow };
    setSaving(true);
    try {
      const [created] = await api("torneos", "POST", row);
      setData(prev => [...prev, created]);
      setNewRow({});
      setShowAddRow(false);
    } catch (e) {
      setError("Error al agregar: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const addColumn = () => {
    if (!newColName.trim()) return;
    const key = newColName.trim().toLowerCase().replace(/\s+/g, "_");
    setColumns(prev => [...prev, { key, label: newColName.trim(), width: "130px" }]);
    setNewColName("");
    setShowAddCol(false);
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

  const totalSeña = filtered.reduce((s, r) => s + (Number(r["seña"]) || 0), 0);
  const totalSaldo = filtered.reduce((s, r) => s + (Number(r["saldo"]) || 0), 0);
  const pendientes = filtered.filter(r => !r.saldo).length;

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"#f5f0eb", fontFamily:"Georgia,serif", fontSize:18, color:"#555" }}>
      Cargando datos...
    </div>
  );

  return (
    <div style={{ fontFamily:"'Georgia',serif", background:"#f5f0eb", minHeight:"100vh" }}>
      <div style={{ background:"linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%)", color:"#e8d5b7", padding:"28px 32px 20px", borderBottom:"3px solid #e8a020" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12 }}>
          <div>
            <div style={{ fontSize:11, letterSpacing:4, textTransform:"uppercase", color:"#e8a020", marginBottom:4 }}>Club de Gimnasia</div>
            <h1 style={{ margin:0, fontSize:28, fontWeight:"normal", letterSpacing:1 }}>Planillas Campo Gimnástico</h1>
            <div style={{ fontSize:11, color:"#8899bb", marginTop:4 }}>{saving ? "⏳ Guardando..." : "✓ Sincronizado con base de datos"}</div>
          </div>
          <div style={{ display:"flex", gap:20, flexWrap:"wrap" }}>
            <Stat label="Alumnos" value={filtered.length} />
            <Stat label="Total Señas" value={`$${totalSeña.toLocaleString("es-AR")}`} />
            <Stat label="Total Saldos" value={`$${totalSaldo.toLocaleString("es-AR")}`} />
            <Stat label="Sin saldo" value={pendientes} accent />
          </div>
        </div>
      </div>

      {error && (
        <div style={{ background:"#fff0f0", borderLeft:"4px solid #e53e3e", padding:"10px 20px", fontSize:13, color:"#c53030", display:"flex", justifyContent:"space-between" }}>
          {error}
          <button onClick={() => setError(null)} style={{ background:"none", border:"none", cursor:"pointer", color:"#c53030" }}>✕</button>
        </div>
      )}

      <div style={{ background:"#fff", borderBottom:"1px solid #ddd", padding:"12px 32px", display:"flex", gap:12, flexWrap:"wrap", alignItems:"center" }}>
        <input placeholder="🔍 Buscar..." value={search} onChange={e => setSearch(e.target.value)} style={inputStyle} />
        <select value={filterTorneo} onChange={e => setFilterTorneo(e.target.value)} style={inputStyle}>
          {torneos.map(t => <option key={t}>{t}</option>)}
        </select>
        <button onClick={loadData} style={{ background:"#555", color:"#fff", border:"none", borderRadius:5, padding:"7px 12px", fontSize:14, cursor:"pointer" }} title="Recargar">↻</button>
        <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
          <Btn onClick={() => setShowAddRow(true)} color="#0f3460">+ Alumno</Btn>
          <Btn onClick={() => setShowAddCol(true)} color="#555">+ Columna</Btn>
          <Btn onClick={exportToExcel} color="#2d7a2d">↓ Excel</Btn>
        </div>
      </div>

      {showAddCol && (
        <div style={modalOverlay}>
          <div style={modalBox}>
            <h3 style={{ margin:"0 0 16px", color:"#1a1a2e" }}>Nueva columna</h3>
            <input placeholder="Nombre de la columna" value={newColName} onChange={e => setNewColName(e.target.value)}
              onKeyDown={e => e.key==="Enter" && addColumn()} style={{ ...inputStyle, width:"100%", marginBottom:12 }} autoFocus />
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <Btn onClick={() => setShowAddCol(false)} color="#999">Cancelar</Btn>
              <Btn onClick={addColumn} color="#0f3460">Agregar</Btn>
            </div>
          </div>
        </div>
      )}

      {showAddRow && (
        <div style={modalOverlay}>
          <div style={{ ...modalBox, maxWidth:500, maxHeight:"80vh", overflowY:"auto" }}>
            <h3 style={{ margin:"0 0 16px", color:"#1a1a2e" }}>Nuevo alumno</h3>
            {BASE_COLUMNS.map(c => (
              <div key={c.key} style={{ marginBottom:8 }}>
                <label style={{ display:"block", fontSize:11, color:"#666", marginBottom:2, textTransform:"uppercase", letterSpacing:1 }}>{c.label}</label>
                <input value={newRow[c.key] ?? ""} onChange={e => setNewRow(p => ({ ...p, [c.key]: e.target.value }))} style={{ ...inputStyle, width:"100%" }} />
              </div>
            ))}
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:12 }}>
              <Btn onClick={() => setShowAddRow(false)} color="#999">Cancelar</Btn>
              <Btn onClick={addRow} color="#0f3460">Guardar</Btn>
            </div>
          </div>
        </div>
      )}

      <div style={{ overflowX:"auto", padding:"20px 32px" }}>
        <table style={{ borderCollapse:"collapse", width:"100%", background:"#fff", boxShadow:"0 2px 12px rgba(0,0,0,0.08)", borderRadius:8, overflow:"hidden" }}>
          <thead>
            <tr style={{ background:"#1a1a2e", color:"#e8d5b7" }}>
              {columns.map(c => (
                <th key={c.key} onClick={() => handleSort(c.key)}
                  style={{ padding:"12px 14px", textAlign:"left", fontSize:11, letterSpacing:2, textTransform:"uppercase", cursor:"pointer", whiteSpace:"nowrap", userSelect:"none", borderRight:"1px solid #2a2a4e" }}>
                  {c.label}{sortConfig?.key===c.key ? (sortConfig.dir==="asc" ? " ↑" : " ↓") : ""}
                </th>
              ))}
              <th style={{ padding:"12px 10px", width:40 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr key={row.id}
                style={{ background: i%2===0 ? "#fff" : "#faf8f5", borderBottom:"1px solid #ece8e2" }}
                onMouseEnter={e => e.currentTarget.style.background="#fef3e2"}
                onMouseLeave={e => e.currentTarget.style.background= i%2===0 ? "#fff" : "#faf8f5"}>
                {columns.map(c => (
                  <td key={c.key} onClick={() => startEdit(row.id, c.key, row[c.key])}
                    style={{ padding:"10px 14px", fontSize:13, color: c.numeric ? "#1a6e1a" : "#222", fontWeight: c.key==="nombre" ? "600" : "normal", cursor:"text", borderRight:"1px solid #f0ece6", minWidth:c.width, maxWidth:c.width, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:
