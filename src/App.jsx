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

const getStatus = (pago, monto) => {
  const seña = Number(pago?.seña) || 0;
  const saldo = Number(pago?.saldo) || 0;
  const pagado = seña + saldo;
  if (seña === 0 && saldo === 0) return { color: "#ef4444", label: "Sin pagar", bg: "#1c0505" };
  if (monto > 0 && pagado >= monto) return { color: "#22c55e", label: "Al día", bg: "#052e16" };
  return { color: "#f97316", label: "Seña pagada", bg: "#1c0a00" };
};

export default function App() {
  const [alumnos, setAlumnos] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [eventoActivo, setEventoActivo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [search, setSearch] = useState("");
  const [showStats, setShowStats] = useState(false);
  const [showNuevoEvento, setShowNuevoEvento] = useState(false);
  const [showNuevoAlumno, setShowNuevoAlumno] = useState(false);
  const [showHistorial, setShowHistorial] = useState(false);
  const [showAlumnos, setShowAlumnos] = useState(false);
  const [nuevoEvento, setNuevoEvento] = useState({ nombre: "", fecha: "", monto: "", fecha_cierre: "", notas: "" });
  const [nuevoAlumno, setNuevoAlumno] = useState({ nombre: "", categoria: "", nivel: "", responsable: "", telefono: "" });
  const [editingPago, setEditingPago] = useState(null);
  const [editData, setEditData] = useState({});
  const [editingMonto, setEditingMonto] = useState(false);
  const [montoTemp, setMontoTemp] = useState("");
  const [editingCierre, setEditingCierre] = useState(false);
  const [cierreTemp, setCierreTemp] = useState("");
  const [editingNotas, setEditingNotas] = useState(false);
  const [notasTemp, setNotasTemp] = useState("");
  const [viewMode, setViewMode] = useState("cards"); // "cards" o "table"

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [als, evs, pgs] = await Promise.all([
        api("alumnos?order=nombre.asc&select=*"),
        api("eventos?order=created_at.desc&select=*"),
        api("pagos?select=*"),
      ]);
      setAlumnos(als);
      setEventos(evs);
      setPagos(pgs);
      if (evs.length > 0 && !eventoActivo) setEventoActivo(evs[0]);
    } catch (e) {
      setError("Error al cargar: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const getPago = (alumnoId) => pagos.find(p => p.alumno_id === alumnoId && p.evento_id === eventoActivo?.id) || {};

  const crearEvento = async () => {
    if (!nuevoEvento.nombre.trim()) return;
    setSaving(true);
    try {
      const [ev] = await api("eventos", "POST", {
        nombre: nuevoEvento.nombre.trim(),
        fecha: nuevoEvento.fecha,
        monto: Number(nuevoEvento.monto) || 0,
        fecha_cierre: nuevoEvento.fecha_cierre || "",
        notas: nuevoEvento.notas || "",
      });
      // crear pagos vacíos para todos los alumnos
      const pagosNuevos = alumnos.filter(a => a.activo).map(a => ({
        alumno_id: a.id, evento_id: ev.id,
        fecha_seña: "", seña: null, fecha_saldo: "", saldo: null, observacion: ""
      }));
      if (pagosNuevos.length > 0) {
        const nuevos = await api("pagos", "POST", pagosNuevos);
        setPagos(prev => [...prev, ...nuevos]);
      }
      setEventos(prev => [ev, ...prev]);
      setEventoActivo(ev);
      setNuevoEvento({ nombre: "", fecha: "", monto: "", fecha_cierre: "", notas: "" });
      setShowNuevoEvento(false);
    } catch (e) { setError("Error al crear evento: " + e.message); }
    finally { setSaving(false); }
  };

  const crearAlumno = async () => {
    if (!nuevoAlumno.nombre.trim()) return;
    setSaving(true);
    try {
      const [al] = await api("alumnos", "POST", { nombre: nuevoAlumno.nombre.trim(), categoria: nuevoAlumno.categoria, nivel: nuevoAlumno.nivel || "", responsable: nuevoAlumno.responsable || "", telefono: nuevoAlumno.telefono || "" });
      setAlumnos(prev => [...prev, al].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      // crear pago vacío para el alumno en el evento activo
      if (eventoActivo) {
        const [pg] = await api("pagos", "POST", {
          alumno_id: al.id, evento_id: eventoActivo.id,
          fecha_seña: "", seña: null, fecha_saldo: "", saldo: null, observacion: ""
        });
        setPagos(prev => [...prev, pg]);
      }
      setNuevoAlumno({ nombre: "", categoria: "" });
      setShowNuevoAlumno(false);
    } catch (e) { setError("Error al agregar alumno: " + e.message); }
    finally { setSaving(false); }
  };

  const savePago = async (alumnoId) => {
    setSaving(true);
    const pago = getPago(alumnoId);
    try {
      if (pago.id) {
        await api(`pagos?id=eq.${pago.id}`, "PATCH", editData);
        setPagos(prev => prev.map(p => p.id === pago.id ? { ...p, ...editData } : p));
      } else {
        const [created] = await api("pagos", "POST", {
          alumno_id: alumnoId, evento_id: eventoActivo.id,
          fecha_seña: "", seña: null, fecha_saldo: "", saldo: null, observacion: "", ...editData
        });
        setPagos(prev => [...prev, created]);
      }
      setEditingPago(null); setEditData({});
    } catch (e) { setError("Error al guardar"); }
    finally { setSaving(false); }
  };

  const saveMonto = async () => {
    const monto = Number(montoTemp) || 0;
    setEventos(prev => prev.map(e => e.id === eventoActivo.id ? { ...e, monto } : e));
    setEventoActivo(prev => ({ ...prev, monto }));
    setEditingMonto(false);
    try { await api(`eventos?id=eq.${eventoActivo.id}`, "PATCH", { monto }); }
    catch (e) { setError("Error al guardar monto"); }
  };

  const saveCierre = async () => {
    setEventos(prev => prev.map(e => e.id === eventoActivo.id ? { ...e, fecha_cierre: cierreTemp } : e));
    setEventoActivo(prev => ({ ...prev, fecha_cierre: cierreTemp }));
    setEditingCierre(false);
    try { await api(`eventos?id=eq.${eventoActivo.id}`, "PATCH", { fecha_cierre: cierreTemp }); }
    catch (e) { setError("Error al guardar fecha de cierre"); }
  };

  const saveNotas = async () => {
    setEventos(prev => prev.map(e => e.id === eventoActivo.id ? { ...e, notas: notasTemp } : e));
    setEventoActivo(prev => ({ ...prev, notas: notasTemp }));
    setEditingNotas(false);
    try { await api(`eventos?id=eq.${eventoActivo.id}`, "PATCH", { notas: notasTemp }); }
    catch (e) { setError("Error al guardar notas"); }
  };

  const deleteEvento = async (ev, e) => {
    e.stopPropagation();
    if (!confirm(`¿Eliminar el evento "${ev.nombre}"? Se borrarán todos los pagos asociados.`)) return;
    setSaving(true);
    try {
      await api(`pagos?evento_id=eq.${ev.id}`, "DELETE");
      await api(`eventos?id=eq.${ev.id}`, "DELETE");
      setEventos(prev => prev.filter(x => x.id !== ev.id));
      setPagos(prev => prev.filter(p => p.evento_id !== ev.id));
      if (eventoActivo?.id === ev.id) {
        const remaining = eventos.filter(x => x.id !== ev.id);
        setEventoActivo(remaining.length > 0 ? remaining[0] : null);
      }
      setShowHistorial(false);
    } catch (e) { setError("Error al eliminar evento"); }
    finally { setSaving(false); }
  };

  const toggleActivo = async (alumno) => {
    const newActivo = !alumno.activo;
    setAlumnos(prev => prev.map(a => a.id === alumno.id ? { ...a, activo: newActivo } : a));
    try { await api(`alumnos?id=eq.${alumno.id}`, "PATCH", { activo: newActivo }); }
    catch (e) { setError("Error al actualizar"); loadData(); }
  };

  const deleteAlumno = async (id) => {
    if (!confirm("¿Eliminar este alumno de todos los eventos?")) return;
    setAlumnos(prev => prev.filter(a => a.id !== id));
    setPagos(prev => prev.filter(p => p.alumno_id !== id));
    try { await api(`alumnos?id=eq.${id}`, "DELETE"); }
    catch (e) { setError("Error al eliminar"); loadData(); }
  };

  const monto = eventoActivo?.monto || 0;

  const getDiasRestantes = () => {
    if (!eventoActivo?.fecha_cierre) return null;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const parts = eventoActivo.fecha_cierre.split("/");
    let cierre;
    if (parts.length === 3) {
      cierre = new Date(parts[2], parts[1] - 1, parts[0]);
    } else {
      cierre = new Date(eventoActivo.fecha_cierre);
    }
    const diff = Math.ceil((cierre - hoy) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const diasRestantes = getDiasRestantes();

  const filteredAlumnos = alumnos.filter(a => {
    if (!eventoActivo) return false;
    const pago = getPago(a.id);
    const status = getStatus(pago, monto);
    if (filterStatus !== "Todos" && status.label !== filterStatus) return false;
    if (search && !a.nombre.toLowerCase().includes(search.toLowerCase()) && !a.categoria?.toLowerCase().includes(search.toLowerCase()) && !a.nivel?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const alDia = filteredAlumnos.filter(a => getStatus(getPago(a.id), monto).label === "Al día").length;
  const conSeña = filteredAlumnos.filter(a => getStatus(getPago(a.id), monto).label === "Seña pagada").length;
  const sinPagar = filteredAlumnos.filter(a => getStatus(getPago(a.id), monto).label === "Sin pagar").length;
  const totalSeña = filteredAlumnos.reduce((s, a) => s + (Number(getPago(a.id).seña) || 0), 0);
  const totalSaldo = filteredAlumnos.reduce((s, a) => s + (Number(getPago(a.id).saldo) || 0), 0);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0f172a", color: "#94a3b8", fontFamily: "system-ui", fontSize: 16 }}>
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
            <div style={{ fontSize: 10, color: saving ? "#f59e0b" : "#10b981" }}>{saving ? "⏳ Guardando..." : "● Sincronizado"}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          <Btn icon="👥" label="Alumnos" onClick={() => setShowAlumnos(true)} color="#0d9488" />
          <Btn icon="🆕" label="Nuevo Evento" onClick={() => setShowNuevoEvento(true)} color="#8b5cf6" />
          <Btn icon="📋" label="Eventos" onClick={() => setShowHistorial(true)} color="#0ea5e9" />
          <Btn icon="📊" label="Estadísticas" onClick={() => setShowStats(true)} color="#6366f1" />
          <Btn icon="⬇" label="Excel" onClick={() => exportToExcel(filteredAlumnos, getPago, monto, eventoActivo)} color="#10b981" />
          <Btn icon="+" label="Alumno" onClick={() => setShowNuevoAlumno(true)} color="#3b82f6" />
          <button onClick={() => setViewMode(v => v === "cards" ? "table" : "cards")}
            title={viewMode === "cards" ? "Ver como tabla" : "Ver como tarjetas"}
            style={{ background: "#334155", border: "none", color: "#94a3b8", borderRadius: 7, padding: "7px 10px", cursor: "pointer", fontSize: 15 }}>
            {viewMode === "cards" ? "☰" : "⊞"}
          </button>
          <button onClick={loadData} title="Recargar" style={{ background: "#334155", border: "none", color: "#94a3b8", borderRadius: 7, padding: "7px 10px", cursor: "pointer", fontSize: 15 }}>↻</button>
        </div>
      </div>

      {/* EVENTO ACTIVO BAR */}
      {eventoActivo && (
        <div style={{ background: "#1a1f35", borderBottom: "1px solid #334155", padding: "8px 20px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>Evento activo:</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>{eventoActivo.nombre}</div>
          {eventoActivo.fecha && <div style={{ fontSize: 11, color: "#64748b" }}>📅 {eventoActivo.fecha}</div>}
          {eventoActivo.fecha_cierre || true ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: "#64748b" }}>Cierre:</span>
              {editingCierre ? (
                <>
                  <input value={cierreTemp} onChange={e => setCierreTemp(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") saveCierre(); if (e.key === "Escape") setEditingCierre(false); }}
                    placeholder="dd/mm/aaaa" autoFocus
                    style={{ background: "#0f172a", border: "1px solid #3b82f6", borderRadius: 5, padding: "2px 8px", color: "#f1f5f9", fontSize: 13, width: 120, outline: "none" }} />
                  <ActionBtn onClick={saveCierre} color="#3b82f6">✓</ActionBtn>
                  <ActionBtn onClick={() => setEditingCierre(false)} secondary>✕</ActionBtn>
                </>
              ) : (
                <button onClick={() => { setEditingCierre(true); setCierreTemp(eventoActivo.fecha_cierre || ""); }}
                  style={{
                    background: diasRestantes !== null && diasRestantes <= 3 ? "#1c0a00" : "#1e293b",
                    border: `1px solid ${diasRestantes !== null && diasRestantes <= 3 ? "#f97316" : "#334155"}`,
                    borderRadius: 6, padding: "2px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6
                  }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: !eventoActivo.fecha_cierre ? "#f97316" : diasRestantes <= 0 ? "#ef4444" : diasRestantes <= 3 ? "#f97316" : "#22c55e" }}>
                    {eventoActivo.fecha_cierre || "Definir cierre ✏️"}
                  </span>
                  {diasRestantes !== null && eventoActivo.fecha_cierre && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: diasRestantes <= 0 ? "#ef4444" : diasRestantes <= 3 ? "#f97316" : "#22c55e" }}>
                      {diasRestantes <= 0 ? "⚠️ Vencido" : diasRestantes === 1 ? "⚠️ 1 día" : `⏳ ${diasRestantes} días`}
                    </span>
                  )}
                </button>
              )}
            </div>
          ) : null}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: "#64748b" }}>Monto:</span>
            {editingMonto ? (
              <>
                <input value={montoTemp} onChange={e => setMontoTemp(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveMonto(); if (e.key === "Escape") setEditingMonto(false); }}
                  autoFocus style={{ background: "#0f172a", border: "1px solid #3b82f6", borderRadius: 5, padding: "2px 8px", color: "#f1f5f9", fontSize: 13, width: 100, outline: "none" }} />
                <ActionBtn onClick={saveMonto} color="#3b82f6">✓</ActionBtn>
                <ActionBtn onClick={() => setEditingMonto(false)} secondary>✕</ActionBtn>
              </>
            ) : (
              <button onClick={() => { setEditingMonto(true); setMontoTemp(String(monto || "")); }}
                style={{ background: monto > 0 ? "#1e293b" : "#1c0a00", border: `1px solid ${monto > 0 ? "#334155" : "#f97316"}`, borderRadius: 6, padding: "2px 10px", color: monto > 0 ? "#f1f5f9" : "#f97316", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
                {monto > 0 ? fmt(monto) : "Definir monto ✏️"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* NOTAS DEL EVENTO */}
      {eventoActivo && (
        <div style={{ background: "#0f172a", borderBottom: "1px solid #1e293b", padding: "8px 20px", display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, whiteSpace: "nowrap", paddingTop: 2 }}>📝 Notas:</span>
          {editingNotas ? (
            <div style={{ flex: 1, display: "flex", gap: 6, alignItems: "flex-start" }}>
              <textarea value={notasTemp} onChange={e => setNotasTemp(e.target.value)} autoFocus rows={3}
                placeholder="Ej: Lugar: Polideportivo Norte. Horario: 9hs. Traer ropa de competencia."
                style={{ flex: 1, background: "#1e293b", border: "1px solid #3b82f6", borderRadius: 6, padding: "6px 10px", color: "#e2e8f0", fontSize: 12, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <ActionBtn onClick={saveNotas} color="#3b82f6">✓</ActionBtn>
                <ActionBtn onClick={() => setEditingNotas(false)} secondary>✕</ActionBtn>
              </div>
            </div>
          ) : (
            <button onClick={() => { setEditingNotas(true); setNotasTemp(eventoActivo.notas || ""); }}
              style={{ flex: 1, background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
              <span style={{ fontSize: 12, color: eventoActivo.notas ? "#94a3b8" : "#475569", fontStyle: eventoActivo.notas ? "normal" : "italic" }}>
                {eventoActivo.notas || "Agregar notas del evento (lugar, horario, requisitos...) ✏️"}
              </span>
            </button>
          )}
        </div>
      )}

      {/* STATS BAR */}
      <div style={{ background: "#162032", borderBottom: "1px solid #1e293b", padding: "8px 20px", display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
        <StatPill label="Total" value={filteredAlumnos.length} color="#64748b" />
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
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 7, padding: "7px 12px", color: "#e2e8f0", fontSize: 13, outline: "none" }}>
          {["Todos", "Al día", "Seña pagada", "Sin pagar"].map(s => <option key={s}>{s}</option>)}
        </select>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#475569" }}>{filteredAlumnos.length} alumnos</span>
      </div>

      {/* CARDS */}
      {viewMode === "cards" && (
      <div style={{ padding: "0 20px 32px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        {filteredAlumnos.map(alumno => {
          const pago = getPago(alumno.id);
          const status = getStatus(pago, monto);
          const isEditing = editingPago === alumno.id;
          const pagado = (Number(pago.seña) || 0) + (Number(pago.saldo) || 0);
          const progreso = monto > 0 ? Math.min((pagado / monto) * 100, 100) : 0;
          return (
            <div key={alumno.id} style={{ background: "#1e293b", borderRadius: 10, overflow: "hidden", border: "1px solid #334155" }}>
              <div style={{ height: 4, background: status.color }} />
              <div style={{ padding: "14px 14px 10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                  {isEditing ? (
                    <input value={editData._nombre ?? alumno.nombre} onChange={e => setEditData(p => ({ ...p, _nombre: e.target.value }))}
                      style={{ background: "#0f172a", border: "1px solid #3b82f6", borderRadius: 5, padding: "4px 8px", color: "#f1f5f9", fontSize: 14, fontWeight: 600, width: "70%", outline: "none" }} autoFocus />
                  ) : (
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9" }}>{alumno.nombre}</div>
                  )}
                  <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {diasRestantes !== null && diasRestantes <= 3 && status.label !== "Al día" && (
                      <span style={{ fontSize: 10, fontWeight: 600, color: "#f97316", background: "#1c0a00", padding: "2px 6px", borderRadius: 20 }}>
                        {diasRestantes <= 0 ? "⚠️ Vencido" : `⚠️ ${diasRestantes}d`}
                      </span>
                    )}
                    <span style={{ fontSize: 10, fontWeight: 600, color: status.color, background: status.bg, padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>{status.label}</span>
                  </div>
                </div>

                {!isEditing && (
                  <div style={{ marginBottom: 8, display: "flex", flexDirection: "column", gap: 3 }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <div style={{ fontSize: 11, color: alumno.categoria ? "#64748b" : "#334155", textTransform: "uppercase", letterSpacing: 1 }}>Cat: {alumno.categoria || "—"}</div>
                      <div style={{ fontSize: 11, color: alumno.nivel ? "#64748b" : "#334155", textTransform: "uppercase", letterSpacing: 1 }}>Niv: {alumno.nivel || "—"}</div>
                    </div>
                    {alumno.responsable && <div style={{ fontSize: 12, color: "#94a3b8" }}>👤 {alumno.responsable}</div>}
                    {alumno.telefono && (
                      <div style={{ display: "flex", gap: 6 }}>
                        <a href={`tel:${alumno.telefono}`} style={{ fontSize: 12, color: "#3b82f6", textDecoration: "none" }}>📞 {alumno.telefono}</a>
                        <a href={`https://wa.me/${alumno.telefono.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                          style={{ fontSize: 12, color: "#22c55e", textDecoration: "none" }}>💬 WhatsApp</a>
                      </div>
                    )}
                  </div>
                )}
                {isEditing && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
                    {[{k:"_categoria",l:"Categoría",v:alumno.categoria},{k:"_nivel",l:"Nivel",v:alumno.nivel},{k:"_responsable",l:"Responsable",v:alumno.responsable},{k:"_telefono",l:"Teléfono/WhatsApp",v:alumno.telefono}].map(f => (
                      <div key={f.k}>
                        <label style={{ display: "block", fontSize: 9, color: "#64748b", marginBottom: 2, textTransform: "uppercase", letterSpacing: 1 }}>{f.l}</label>
                        <input value={editData[f.k] ?? f.v ?? ""} onChange={e => setEditData(p => ({ ...p, [f.k]: e.target.value }))}
                          style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 4, padding: "3px 8px", color: "#94a3b8", fontSize: 12, width: "100%", outline: "none", boxSizing: "border-box" }} />
                      </div>
                    ))}
                  </div>
                )}

                {monto > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ height: 5, background: "#0f172a", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${progreso}%`, background: status.color, borderRadius: 3, transition: "width 0.3s" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
                      <span style={{ fontSize: 10, color: "#475569" }}>{fmt(pagado) || "$0"} pagado</span>
                      <span style={{ fontSize: 10, color: "#475569" }}>{fmt(monto)} total</span>
                    </div>
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                  <PayField label="Seña" amount={isEditing ? editData.seña ?? pago.seña : pago.seña}
                    date={isEditing ? editData.fecha_seña ?? pago.fecha_seña : pago.fecha_seña}
                    editing={isEditing} onAmountChange={v => setEditData(p => ({ ...p, seña: v }))}
                    onDateChange={v => setEditData(p => ({ ...p, fecha_seña: v }))} color="#8b5cf6" />
                  <PayField label="Saldo" amount={isEditing ? editData.saldo ?? pago.saldo : pago.saldo}
                    date={isEditing ? editData.fecha_saldo ?? pago.fecha_saldo : pago.fecha_saldo}
                    editing={isEditing} onAmountChange={v => setEditData(p => ({ ...p, saldo: v }))}
                    onDateChange={v => setEditData(p => ({ ...p, fecha_saldo: v }))} color="#10b981" />
                </div>

                {!isEditing && pago.observacion ? <div style={{ fontSize: 12, marginBottom: 10 }}><span style={{ color: "#94a3b8" }}>💬 {pago.observacion}</span></div> : null}
                {isEditing && (
                  <div style={{ fontSize: 12, marginBottom: 10 }}>
                    <input value={editData.observacion ?? pago.observacion ?? ""} onChange={e => setEditData(p => ({ ...p, observacion: e.target.value }))}
                      placeholder="Observación..."
                      style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 4, padding: "4px 8px", color: "#94a3b8", fontSize: 12, width: "100%", outline: "none", boxSizing: "border-box" }} />
                  </div>
                )}

                {/* WHATSAPP BUTTON - solo si tiene deuda y tiene teléfono */}
                {!isEditing && status.label !== "Al día" && alumno.telefono && (() => {
                  const pagado = (Number(pago.seña) || 0) + (Number(pago.saldo) || 0);
                  const debe = monto > 0 ? monto - pagado : null;
                  const responsable = alumno.responsable ? `Hola ${alumno.responsable}!` : "Hola!";
                  const montoMsg = debe && debe > 0 ? ` Saldo pendiente: $${Number(debe).toLocaleString("es-AR")}.` : monto > 0 ? ` Monto total: $${Number(monto).toLocaleString("es-AR")}.` : "";
                  const cierreMsg = eventoActivo?.fecha_cierre ? ` Fecha límite: ${eventoActivo.fecha_cierre}.` : "";
                  const msg = `${responsable} Te recordamos que ${alumno.nombre} tiene pendiente el pago del torneo ${eventoActivo?.nombre || ""}.${montoMsg}${cierreMsg} Gracias!`;
                  const url = `https://wa.me/${alumno.telefono.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`;
                  return (
                    <a href={url} target="_blank" rel="noreferrer"
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "#052e16", border: "1px solid #22c55e", borderRadius: 7, padding: "7px 12px", color: "#22c55e", textDecoration: "none", fontSize: 12, fontWeight: 600, marginBottom: 10 }}>
                      📲 Enviar recordatorio por WhatsApp
                    </a>
                  );
                })()}

                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  {isEditing ? (
                    <>
                      <ActionBtn onClick={() => { setEditingPago(null); setEditData({}); }} secondary>Cancelar</ActionBtn>
                      <ActionBtn onClick={async () => {
                        const alumnoUpdate = {};
                        if (editData._nombre !== undefined && editData._nombre !== alumno.nombre) alumnoUpdate.nombre = editData._nombre;
                        if (editData._categoria !== undefined) alumnoUpdate.categoria = editData._categoria;
                        if (editData._nivel !== undefined) alumnoUpdate.nivel = editData._nivel;
                        if (editData._responsable !== undefined) alumnoUpdate.responsable = editData._responsable;
                        if (editData._telefono !== undefined) alumnoUpdate.telefono = editData._telefono;
                        if (Object.keys(alumnoUpdate).length > 0) {
                          await api(`alumnos?id=eq.${alumno.id}`, "PATCH", alumnoUpdate);
                          setAlumnos(prev => prev.map(a => a.id === alumno.id ? { ...a, ...alumnoUpdate } : a));
                        }
                        const pagoData = {};
                        if (editData.seña !== undefined) pagoData.seña = editData.seña;
                        if (editData.fecha_seña !== undefined) pagoData.fecha_seña = editData.fecha_seña;
                        if (editData.saldo !== undefined) pagoData.saldo = editData.saldo;
                        if (editData.fecha_saldo !== undefined) pagoData.fecha_saldo = editData.fecha_saldo;
                        if (editData.observacion !== undefined) pagoData.observacion = editData.observacion;
                        if (Object.keys(pagoData).length > 0) await savePago(alumno.id);
                        else { setEditingPago(null); setEditData({}); }
                      }} color="#3b82f6">Guardar</ActionBtn>
                    </>
                  ) : (
                    <>
                      <ActionBtn onClick={() => deleteAlumno(alumno.id)} color="#ef444420" textColor="#ef4444">Eliminar</ActionBtn>
                      <ActionBtn onClick={() => { setEditingPago(alumno.id); setEditData({}); }} color="#3b82f620" textColor="#3b82f6">Editar</ActionBtn>
                    </>
                  )}
                </div>
              </div>
              <div style={{ height: 5, background: status.color, opacity: 0.6 }} />
            </div>
          );
        })}
      </div>
      )}

      {/* TABLE VIEW */}
      {viewMode === "table" && (
        <div style={{ padding: "0 20px 32px", overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 700 }}>
            <thead>
              <tr style={{ background: "#1e293b" }}>
                {["Nombre","Categoría","Nivel","Responsable","Teléfono","Seña","F. Seña","Saldo","F. Saldo","Estado","Observación",""].map(h => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: "#64748b", borderBottom: "1px solid #334155", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredAlumnos.map((alumno, i) => {
                const pago = getPago(alumno.id);
                const status = getStatus(pago, monto);
                const pagado2 = (Number(pago.seña) || 0) + (Number(pago.saldo) || 0);
                const isEditing = editingPago === alumno.id;
                return (
                  <tr key={alumno.id} style={{ borderBottom: "1px solid #1e293b", background: i % 2 === 0 ? "#0f172a" : "#111827" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#1e293b"}
                    onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "#0f172a" : "#111827"}>
                    <td style={{ padding: "8px 12px" }}>
                      {isEditing ? <input value={editData._nombre ?? alumno.nombre} onChange={e => setEditData(p => ({ ...p, _nombre: e.target.value }))} style={{ background: "#0f172a", border: "1px solid #3b82f6", borderRadius: 4, padding: "3px 6px", color: "#f1f5f9", fontSize: 13, outline: "none", width: 140 }} />
                        : <span style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>{alumno.nombre}</span>}
                    </td>
                    <td style={{ padding: "8px 12px", fontSize: 12, color: "#64748b" }}>
                      {isEditing ? <input value={editData._categoria ?? alumno.categoria ?? ""} onChange={e => setEditData(p => ({ ...p, _categoria: e.target.value }))} style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 4, padding: "3px 6px", color: "#94a3b8", fontSize: 12, outline: "none", width: 90 }} />
                        : alumno.categoria}
                    </td>
                    <td style={{ padding: "8px 12px", fontSize: 12, color: "#64748b" }}>
                      {isEditing ? <input value={editData._nivel ?? alumno.nivel ?? ""} onChange={e => setEditData(p => ({ ...p, _nivel: e.target.value }))} style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 4, padding: "3px 6px", color: "#94a3b8", fontSize: 12, outline: "none", width: 80 }} />
                        : alumno.nivel}
                    </td>
                    <td style={{ padding: "8px 12px", fontSize: 12, color: "#94a3b8" }}>
                      {isEditing ? <input value={editData._responsable ?? alumno.responsable ?? ""} onChange={e => setEditData(p => ({ ...p, _responsable: e.target.value }))} style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 4, padding: "3px 6px", color: "#94a3b8", fontSize: 12, outline: "none", width: 110 }} />
                        : alumno.responsable}
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      {isEditing ? <input value={editData._telefono ?? alumno.telefono ?? ""} onChange={e => setEditData(p => ({ ...p, _telefono: e.target.value }))} style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 4, padding: "3px 6px", color: "#94a3b8", fontSize: 12, outline: "none", width: 100 }} />
                        : alumno.telefono ? <a href={`tel:${alumno.telefono}`} style={{ fontSize: 12, color: "#3b82f6", textDecoration: "none" }}>{alumno.telefono}</a> : <span style={{ color: "#334155", fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      {isEditing ? <input value={editData.seña ?? pago.seña ?? ""} onChange={e => setEditData(p => ({ ...p, seña: e.target.value === "" ? null : Number(e.target.value) }))} style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 4, padding: "3px 6px", color: "#8b5cf6", fontSize: 13, outline: "none", width: 80 }} />
                        : <span style={{ fontSize: 13, fontWeight: 600, color: pago.seña ? "#8b5cf6" : "#334155" }}>{pago.seña ? fmt(pago.seña) : "—"}</span>}
                    </td>
                    <td style={{ padding: "8px 12px", fontSize: 12, color: "#475569" }}>
                      {isEditing ? <input value={editData.fecha_seña ?? pago.fecha_seña ?? ""} onChange={e => setEditData(p => ({ ...p, fecha_seña: e.target.value }))} style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 4, padding: "3px 6px", color: "#94a3b8", fontSize: 12, outline: "none", width: 70 }} />
                        : pago.fecha_seña || "—"}
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      {isEditing ? <input value={editData.saldo ?? pago.saldo ?? ""} onChange={e => setEditData(p => ({ ...p, saldo: e.target.value === "" ? null : Number(e.target.value) }))} style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 4, padding: "3px 6px", color: "#10b981", fontSize: 13, outline: "none", width: 80 }} />
                        : <span style={{ fontSize: 13, fontWeight: 600, color: pago.saldo ? "#10b981" : "#334155" }}>{pago.saldo ? fmt(pago.saldo) : "—"}</span>}
                    </td>
                    <td style={{ padding: "8px 12px", fontSize: 12, color: "#475569" }}>
                      {isEditing ? <input value={editData.fecha_saldo ?? pago.fecha_saldo ?? ""} onChange={e => setEditData(p => ({ ...p, fecha_saldo: e.target.value }))} style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 4, padding: "3px 6px", color: "#94a3b8", fontSize: 12, outline: "none", width: 70 }} />
                        : pago.fecha_saldo || "—"}
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: status.color, background: status.bg, padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>{status.label}</span>
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      {isEditing ? <input value={editData.observacion ?? pago.observacion ?? ""} onChange={e => setEditData(p => ({ ...p, observacion: e.target.value }))} style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 4, padding: "3px 6px", color: "#94a3b8", fontSize: 12, outline: "none", width: 120 }} />
                        : <span style={{ fontSize: 12, color: "#64748b" }}>{pago.observacion || ""}</span>}
                    </td>
                    <td style={{ padding: "8px 8px", whiteSpace: "nowrap" }}>
                      {isEditing ? (
                        <div style={{ display: "flex", gap: 4 }}>
                          <ActionBtn onClick={() => { setEditingPago(null); setEditData({}); }} secondary>✕</ActionBtn>
                          <ActionBtn onClick={async () => {
                            const alumnoUpdate = {};
                            if (editData._nombre !== undefined && editData._nombre !== alumno.nombre) alumnoUpdate.nombre = editData._nombre;
                            if (editData._categoria !== undefined) alumnoUpdate.categoria = editData._categoria;
                            if (editData._nivel !== undefined) alumnoUpdate.nivel = editData._nivel;
                            if (editData._responsable !== undefined) alumnoUpdate.responsable = editData._responsable;
                            if (editData._telefono !== undefined) alumnoUpdate.telefono = editData._telefono;
                            if (Object.keys(alumnoUpdate).length > 0) {
                              await api(`alumnos?id=eq.${alumno.id}`, "PATCH", alumnoUpdate);
                              setAlumnos(prev => prev.map(a => a.id === alumno.id ? { ...a, ...alumnoUpdate } : a));
                            }
                            const pagoData = {};
                            if (editData.seña !== undefined) pagoData.seña = editData.seña;
                            if (editData.fecha_seña !== undefined) pagoData.fecha_seña = editData.fecha_seña;
                            if (editData.saldo !== undefined) pagoData.saldo = editData.saldo;
                            if (editData.fecha_saldo !== undefined) pagoData.fecha_saldo = editData.fecha_saldo;
                            if (editData.observacion !== undefined) pagoData.observacion = editData.observacion;
                            if (Object.keys(pagoData).length > 0) await savePago(alumno.id);
                            else { setEditingPago(null); setEditData({}); }
                          }} color="#3b82f6">✓</ActionBtn>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 4 }}>
                          {status.label !== "Al día" && alumno.telefono && (() => {
                            const debe2 = monto > 0 ? monto - pagado2 : null;
                            const responsable = alumno.responsable ? `Hola ${alumno.responsable}!` : "Hola!";
                            const montoMsg = debe2 && debe2 > 0 ? ` Saldo pendiente: $${Number(debe2).toLocaleString("es-AR")}.` : monto > 0 ? ` Monto total: $${Number(monto).toLocaleString("es-AR")}.` : "";
                            const cierreMsg = eventoActivo?.fecha_cierre ? ` Fecha límite: ${eventoActivo.fecha_cierre}.` : "";
                            const msg = `${responsable} Te recordamos que ${alumno.nombre} tiene pendiente el pago del torneo ${eventoActivo?.nombre || ""}.${montoMsg}${cierreMsg} Gracias!`;
                            const url = `https://wa.me/${alumno.telefono.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`;
                            return <a key="wa" href={url} target="_blank" rel="noreferrer" style={{ fontSize: 16, textDecoration: "none" }} title="Enviar recordatorio">📲</a>;
                          })()}
                          <ActionBtn onClick={() => { setEditingPago(alumno.id); setEditData({}); }} color="#3b82f620" textColor="#3b82f6">Editar</ActionBtn>
                          <ActionBtn onClick={() => deleteAlumno(alumno.id)} color="#ef444420" textColor="#ef4444">✕</ActionBtn>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ marginTop: 10, fontSize: 12, color: "#475569", textAlign: "right" }}>{filteredAlumnos.length} alumnos</div>
        </div>
      )}

      {/* MODAL ALUMNOS */}
      {showAlumnos && (
        <Modal onClose={() => setShowAlumnos(false)} title="👥 Base de Alumnos">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              {alumnos.filter(a => a.activo).length} activos · {alumnos.filter(a => !a.activo).length} inactivos · {alumnos.length} total
            </div>
            <ActionBtn onClick={() => { setShowAlumnos(false); setShowNuevoAlumno(true); }} color="#3b82f6">+ Nuevo alumno</ActionBtn>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "60vh", overflowY: "auto" }}>
            {[...alumnos].sort((a, b) => {
              if (a.activo && !b.activo) return -1;
              if (!a.activo && b.activo) return 1;
              return a.nombre.localeCompare(b.nombre);
            }).map(alumno => (
              <div key={alumno.id} style={{
                background: alumno.activo ? "#0f172a" : "#0a0a0f",
                border: `1px solid ${alumno.activo ? "#334155" : "#1e293b"}`,
                borderRadius: 8, padding: "10px 14px",
                display: "flex", alignItems: "center", gap: 10,
                opacity: alumno.activo ? 1 : 0.5
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: alumno.activo ? "#f1f5f9" : "#64748b" }}>{alumno.nombre}</div>
                  <div style={{ display: "flex", gap: 10, marginTop: 2 }}>
                    {alumno.categoria && <span style={{ fontSize: 11, color: "#475569" }}>Cat: {alumno.categoria}</span>}
                    {alumno.nivel && <span style={{ fontSize: 11, color: "#475569" }}>Niv: {alumno.nivel}</span>}
                    {alumno.responsable && <span style={{ fontSize: 11, color: "#475569" }}>👤 {alumno.responsable}</span>}
                    {alumno.telefono && <span style={{ fontSize: 11, color: "#475569" }}>📞 {alumno.telefono}</span>}
                  </div>
                </div>
                <button
                  onClick={() => toggleActivo(alumno)}
                  style={{
                    background: alumno.activo ? "#052e16" : "#1e293b",
                    border: `1px solid ${alumno.activo ? "#22c55e" : "#334155"}`,
                    borderRadius: 20, padding: "3px 10px", cursor: "pointer",
                    fontSize: 11, fontWeight: 600,
                    color: alumno.activo ? "#22c55e" : "#64748b",
                    whiteSpace: "nowrap"
                  }}>
                  {alumno.activo ? "✓ Activo" : "Inactivo"}
                </button>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: "#475569", fontStyle: "italic" }}>
            Los alumnos inactivos no se incluyen en nuevos eventos pero se mantienen en la base.
          </div>
        </Modal>
      )}

      {/* MODAL NUEVO EVENTO */}
      {showNuevoEvento && (
        <Modal onClose={() => setShowNuevoEvento(false)} title="🆕 Nuevo Evento">
          <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 14px" }}>Se crearán pagos en blanco para todos los alumnos actuales. Los datos del evento anterior quedan guardados.</p>
          {[{k:"nombre",l:"Nombre del evento"},{k:"fecha",l:"Fecha del evento"},{k:"fecha_cierre",l:"Fecha cierre de pagos"},{k:"monto",l:"Monto total ($)"}].map(f => (
            <div key={f.k} style={{ marginBottom: 10 }}>
              <label style={{ display: "block", fontSize: 10, color: "#64748b", marginBottom: 3, textTransform: "uppercase", letterSpacing: 1 }}>{f.l}</label>
              <input value={nuevoEvento[f.k]} onChange={e => setNuevoEvento(p => ({ ...p, [f.k]: e.target.value }))}
                style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 6, padding: "8px 10px", color: "#e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>
          ))}
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", fontSize: 10, color: "#64748b", marginBottom: 3, textTransform: "uppercase", letterSpacing: 1 }}>Notas (lugar, horario, requisitos...)</label>
            <textarea value={nuevoEvento.notas} onChange={e => setNuevoEvento(p => ({ ...p, notas: e.target.value }))} rows={3}
              placeholder="Ej: Polideportivo Norte, 9hs, ropa de competencia obligatoria"
              style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 6, padding: "8px 10px", color: "#e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <ActionBtn onClick={() => setShowNuevoEvento(false)} secondary>Cancelar</ActionBtn>
            <ActionBtn onClick={crearEvento} color="#8b5cf6">Crear Evento</ActionBtn>
          </div>
        </Modal>
      )}

      {/* MODAL HISTORIAL */}
      {showHistorial && (
        <Modal onClose={() => setShowHistorial(false)} title="📋 Eventos">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {eventos.map(ev => (
              <div key={ev.id} onClick={() => { setEventoActivo(ev); setShowHistorial(false); }}
                style={{ background: ev.id === eventoActivo?.id ? "#1a2744" : "#0f172a", border: `1px solid ${ev.id === eventoActivo?.id ? "#3b82f6" : "#334155"}`, borderRadius: 8, padding: "12px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9" }}>{ev.nombre}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{ev.fecha || "Sin fecha"} · {fmt(ev.monto) || "Sin monto"}</div>
                  {ev.notas && <div style={{ fontSize: 11, color: "#475569", marginTop: 3 }}>📝 {ev.notas}</div>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {ev.id === eventoActivo?.id && <span style={{ fontSize: 11, color: "#3b82f6", fontWeight: 600 }}>ACTIVO</span>}
                  <button onClick={(e) => deleteEvento(ev, e)}
                    style={{ background: "none", border: "1px solid #334155", borderRadius: 5, color: "#64748b", cursor: "pointer", fontSize: 12, padding: "3px 8px" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "#ef4444"; e.currentTarget.style.color = "#ef4444"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "#334155"; e.currentTarget.style.color = "#64748b"; }}>
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* MODAL NUEVO ALUMNO */}
      {showNuevoAlumno && (
        <Modal onClose={() => setShowNuevoAlumno(false)} title="Nuevo Alumno">
          {[{k:"nombre",l:"Nombre y Apellido"},{k:"categoria",l:"Categoría"},{k:"nivel",l:"Nivel"},{k:"responsable",l:"Responsable (padre/madre)"},{k:"telefono",l:"Teléfono/WhatsApp"}].map(f => (
            <div key={f.k} style={{ marginBottom: 10 }}>
              <label style={{ display: "block", fontSize: 10, color: "#64748b", marginBottom: 3, textTransform: "uppercase", letterSpacing: 1 }}>{f.l}</label>
              <input value={nuevoAlumno[f.k]} onChange={e => setNuevoAlumno(p => ({ ...p, [f.k]: e.target.value }))}
                style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 6, padding: "8px 10px", color: "#e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <ActionBtn onClick={() => setShowNuevoAlumno(false)} secondary>Cancelar</ActionBtn>
            <ActionBtn onClick={crearAlumno} color="#3b82f6">Guardar</ActionBtn>
          </div>
        </Modal>
      )}

      {/* MODAL ESTADÍSTICAS */}
      {showStats && (
        <Modal onClose={() => setShowStats(false)} title="Estadísticas">
          {(() => {
            const total = filteredAlumnos.length;
            if (total === 0) return <div style={{ color: "#64748b", fontSize: 13 }}>Sin datos para mostrar.</div>;
            const slices = [
              { label: "Al día", value: alDia, color: "#22c55e" },
              { label: "Seña pagada", value: conSeña, color: "#f97316" },
              { label: "Sin pagar", value: sinPagar, color: "#ef4444" },
            ].filter(s => s.value > 0);
            const size = 160;
            const cx = size / 2, cy = size / 2, r = size / 2 - 10;
            let startAngle = -Math.PI / 2;
            const paths = slices.map(s => {
              const angle = (s.value / total) * 2 * Math.PI;
              const endAngle = startAngle + angle;
              const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle);
              const x2 = cx + r * Math.cos(endAngle), y2 = cy + r * Math.sin(endAngle);
              const largeArc = angle > Math.PI ? 1 : 0;
              const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
              const mid = startAngle + angle / 2;
              const lx = cx + r * 0.65 * Math.cos(mid), ly = cy + r * 0.65 * Math.sin(mid);
              startAngle = endAngle;
              return { ...s, d, lx, ly, pct: Math.round((s.value / total) * 100) };
            });
            return (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 18, background: "#0f172a", borderRadius: 10, padding: 16 }}>
                  <svg width={size} height={size} style={{ flexShrink: 0 }}>
                    {paths.map((p, i) => (
                      <g key={i}>
                        <path d={p.d} fill={p.color} stroke="#0f172a" strokeWidth={2} />
                        {p.pct > 8 && <text x={p.lx} y={p.ly} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize={11} fontWeight={700}>{p.pct}%</text>}
                      </g>
                    ))}
                  </svg>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {slices.map(s => (
                      <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 12, height: 12, borderRadius: 3, background: s.color }} />
                        <div>
                          <div style={{ fontSize: 12, color: "#f1f5f9", fontWeight: 600 }}>{s.label}</div>
                          <div style={{ fontSize: 11, color: "#64748b" }}>{s.value} alumnos ({Math.round((s.value / total) * 100)}%)</div>
                        </div>
                      </div>
                    ))}
                    <div style={{ paddingTop: 8, borderTop: "1px solid #1e293b" }}>
                      <div style={{ fontSize: 11, color: "#64748b" }}>Total: <span style={{ color: "#f1f5f9", fontWeight: 600 }}>{total} alumnos</span></div>
                    </div>
                  </div>
                </div>
                <div style={{ background: "#0f172a", borderRadius: 8, border: "1px solid #f59e0b40", padding: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#f59e0b", marginBottom: 10 }}>Resumen financiero — {eventoActivo?.nombre}</div>
                  <SRow label="Monto por alumno" val={fmt(monto) || "Sin definir"} color="#f59e0b" />
                  <SRow label="Total señas cobradas" val={fmt(totalSeña)} color="#8b5cf6" />
                  <SRow label="Total saldos cobrados" val={fmt(totalSaldo)} color="#10b981" />
                  <SRow label="Total recaudado" val={fmt(totalSeña + totalSaldo)} color="#f59e0b" />
                  {monto > 0 && <SRow label="Total esperado" val={fmt(monto * filteredAlumnos.length)} color="#64748b" />}
                </div>
              </>
            );
          })()}
        </Modal>
      )}
    </div>
  );
}

function exportToExcel(alumnos, getPago, monto, evento) {
  const rows = alumnos.map(a => {
    const p = getPago(a.id);
    const pagado = (Number(p.seña) || 0) + (Number(p.saldo) || 0);
    const status = getStatus(p, monto);
    return {
      Nombre: a.nombre, Categoría: a.categoria || "",
      "Fecha Seña": p.fecha_seña || "", Seña: p.seña || "",
      "Fecha Saldo": p.fecha_saldo || "", Saldo: p.saldo || "",
      "Total Pagado": pagado, "Monto Total": monto,
      Estado: status.label, Observación: p.observacion || "",
    };
  });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [25,15,12,12,12,12,12,12,14,20].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, evento?.nombre || "Evento");
  XLSX.writeFile(wb, `${evento?.nombre || "planillas"}.xlsx`);
}

function PayField({ label, amount, date, editing, onAmountChange, onDateChange, color }) {
  return (
    <div style={{ background: "#0f172a", borderRadius: 7, padding: "8px 10px", border: "1px solid #1e293b" }}>
      <div style={{ fontSize: 10, color, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{label}</div>
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
