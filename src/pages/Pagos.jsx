import React, { useEffect, useState } from 'react';
import { Receipt, Plus, Printer, FileText } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import Topbar from '../components/topbar';
import Modal from '../components/Modal';
import { formatDate } from '../lib/dateUtils';

const METODOS_PAGO = ['Pago Móvil', 'Zelle', 'Efectivo USD', 'Efectivo Bs', 'Transferencia', 'Exonerado'];
const TODAY = new Date().toISOString().split('T')[0];

const formatMoney = (amount) => `$${Number(amount || 0).toFixed(2)}`;

const EMPTY_FORM = {
  paciente_id: '',
  paciente_nombre: '',
  metodo_pago: 'Pago Móvil',
  monto: 0,
  fecha: new Date().toISOString().split('T')[0],
  descripcion: '',
  referencia: ''
};

export default function Pagos() {
  const { profile, isMedico } = useAuth();
  const [pagos, setPagos] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [fechaInicio, setFechaInicio] = useState(TODAY);
  const [fechaFin, setFechaFin] = useState(TODAY);
  const [reportePagos, setReportePagos] = useState([]);
  const [hasGeneratedReport, setHasGeneratedReport] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportError, setReportError] = useState('');

  useEffect(() => {
    fetchPagos();
    fetchPacientes();
  }, []);

  async function fetchPagos() {
    const { data, error: fetchError } = await supabase
      .from('pagos')
      .select('*')
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Error cargando pagos:', fetchError);
      setError(fetchError.message);
      return;
    }

    setPagos(data || []);
  }

  async function fetchPacientes() {
    const { data } = await supabase
      .from('pacientes')
      .select('id, nombres')
      .order('nombres', { ascending: true });
    setPacientes(data || []);
  }

  async function generarReporte() {
    if (!isMedico) return;
    setReportError('');
    if (!fechaInicio || !fechaFin || fechaInicio > fechaFin) {
      setReportError('Indica un período válido: la fecha inicial debe ser anterior o igual a la fecha final.');
      return;
    }

    setIsGeneratingReport(true);
    const { data, error: reportFetchError } = await supabase
      .from('pagos')
      .select('id, fecha, paciente_nombre, metodo_pago, monto, descripcion, referencia')
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin)
      .order('fecha', { ascending: true })
      .order('created_at', { ascending: true });

    if (reportFetchError) {
      console.error('Error generando informe contable:', reportFetchError);
      setReportError('No se pudo generar el informe contable. Intenta nuevamente.');
    } else {
      setReportePagos(data || []);
      setHasGeneratedReport(true);
    }
    setIsGeneratingReport(false);
  }

  const resumenMetodos = METODOS_PAGO
    .map((metodo) => {
      const pagosMetodo = reportePagos.filter((pago) => pago.metodo_pago === metodo);
      return {
        metodo,
        operaciones: pagosMetodo.length,
        total: pagosMetodo.reduce((suma, pago) => suma + (Number(pago.monto) || 0), 0)
      };
    })
    .filter((item) => item.operaciones > 0);
  const totalReporte = reportePagos.reduce((suma, pago) => suma + (Number(pago.monto) || 0), 0);
  const periodoReporte = fechaInicio === fechaFin
    ? `Diario · ${formatDate(fechaInicio)}`
    : `Del ${formatDate(fechaInicio)} al ${formatDate(fechaFin)}`;

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function imprimirReporte() {
    if (!isMedico || !hasGeneratedReport) return;
    const printArea = document.createElement('div');
    printArea.id = 'print-contabilidad-area';
    const filas = reportePagos.map((pago) => `
      <tr>
        <td>${escapeHtml(formatDate(pago.fecha))}</td>
        <td>${escapeHtml(pago.paciente_nombre)}</td>
        <td>${escapeHtml(pago.descripcion)}</td>
        <td>${escapeHtml(pago.metodo_pago)}</td>
        <td class="amount">${formatMoney(pago.monto)}</td>
      </tr>
    `).join('');
    const filasResumen = resumenMetodos.map((item) => `
      <tr>
        <td>${escapeHtml(item.metodo)}</td>
        <td>${item.operaciones}</td>
        <td class="amount">${formatMoney(item.total)}</td>
      </tr>
    `).join('');

    printArea.innerHTML = `
      <header class="contabilidad-header">
        <img src="${window.location.origin}/logo_clinicasp26.jpg" alt="Logotipo Clínica San Pedro" />
        <div>
          <h1>CLÍNICA SAN PEDRO</h1>
          <div>Dr. Leonel Alex Fernández González</div>
          <div>Medicina Interna · Obesología · Ecografía Integral y Doppler Vascular</div>
          <div>Consultorio 7 · Ciudad Bolívar, Estado Bolívar · Telf. 0412-0864084 / 0416-3197560</div>
        </div>
      </header>
      <h2>INFORME CONTABLE · INGRESOS POR CONSULTAS</h2>
      <div class="contabilidad-periodo">Período: ${escapeHtml(periodoReporte)}</div>
      <table class="contabilidad-tabla">
        <thead><tr><th>Fecha</th><th>Paciente</th><th>Descripción</th><th>Tipo de pago</th><th class="amount">Monto</th></tr></thead>
        <tbody>${filas || '<tr><td colspan="5" class="empty">Sin pagos registrados para el período seleccionado.</td></tr>'}</tbody>
      </table>
      <section class="contabilidad-resumen">
        <h3>Resumen del período</h3>
        <table class="contabilidad-resumen-tabla">
          <thead><tr><th>Tipo de pago</th><th>Operaciones</th><th class="amount">Subtotal</th></tr></thead>
          <tbody>${filasResumen || '<tr><td colspan="3">Sin operaciones</td></tr>'}</tbody>
        </table>
        <div class="contabilidad-total">
          <span>Total de operaciones: <b>${reportePagos.length}</b></span>
          <strong>Total de ingresos: ${formatMoney(totalReporte)}</strong>
        </div>
      </section>
    `;

    document.body.appendChild(printArea);
    window.print();
    setTimeout(() => printArea.remove(), 500);
  }

  function openModal() {
    setError('');
    setForm({ ...EMPTY_FORM, fecha: new Date().toISOString().split('T')[0] });
    setIsModalOpen(true);
  }

  async function handleSave() {
    setError('');
    if (!form.paciente_nombre.trim() || !form.descripcion.trim()) {
      setError('Completa el paciente y la descripción del pago.');
      return;
    }
    if (form.metodo_pago !== 'Exonerado' && Number(form.monto) <= 0) {
      setError('El monto debe ser mayor que cero.');
      return;
    }

    setIsSaving(true);
    const { error: saveError } = await supabase.from('pagos').insert([{
      paciente_id: form.paciente_id || null,
      paciente_nombre: form.paciente_nombre.trim(),
      metodo_pago: form.metodo_pago,
      monto: form.metodo_pago === 'Exonerado' ? 0 : Number(form.monto),
      fecha: form.fecha,
      descripcion: form.descripcion.trim(),
      referencia: form.referencia.trim() || null,
      registrado_por: profile?.id || null
    }]);

    if (saveError) {
      console.error('Error registrando pago:', saveError);
      setError(saveError.message || 'No se pudo registrar el pago.');
    } else {
      setIsModalOpen(false);
      setForm(EMPTY_FORM);
      fetchPagos();
    }
    setIsSaving(false);
  }

  return (
    <>
      <Topbar
        title="Pagos e informes administrativos"
        actions={(
          <button className="btn btn-primary" onClick={openModal}>
            <Plus size={16} /> Registrar pago
          </button>
        )}
      />

      {isMedico && <div className="panel" style={{ marginBottom: '20px' }}>
        <div className="panel-head">
          <div>
            <h3>Informes contables de consultas</h3>
            <p style={{ color: 'var(--ink-soft)', fontSize: '13px', marginTop: '4px' }}>
              Genera el cierre diario o consulta ingresos entre dos fechas, agrupados por tipo de pago.
            </p>
          </div>
          <FileText size={22} color="var(--primary)" />
        </div>
        <div className="panel-body">
          <div className="form-grid" style={{ alignItems: 'end' }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="reporte-fecha-inicio">Desde</label>
              <input id="reporte-fecha-inicio" type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="reporte-fecha-fin">Hasta</label>
              <input id="reporte-fecha-fin" type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
            </div>
            <div className="span-2" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={generarReporte} disabled={isGeneratingReport}>
                <FileText size={16} /> {isGeneratingReport ? 'Generando...' : 'Generar informe'}
              </button>
              <button className="btn btn-ghost" onClick={imprimirReporte} disabled={!hasGeneratedReport}>
                <Printer size={16} /> Imprimir informe
              </button>
            </div>
          </div>
          {reportError && <div className="login-error" style={{ display: 'block', marginTop: '14px' }}>{reportError}</div>}
          {hasGeneratedReport && (
            <div className="reporte-preview" style={{ marginTop: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <b>{periodoReporte}</b>
                <span>{reportePagos.length} operación(es) · Ingresos: <b>{formatMoney(totalReporte)}</b></span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead><tr><th>Fecha</th><th>Paciente</th><th>Descripción</th><th>Tipo de pago</th><th>Monto</th></tr></thead>
                  <tbody>
                    {reportePagos.map((pago) => (
                      <tr key={pago.id}>
                        <td>{formatDate(pago.fecha)}</td>
                        <td>{pago.paciente_nombre}</td>
                        <td>{pago.descripcion}</td>
                        <td>{pago.metodo_pago}</td>
                        <td>{formatMoney(pago.monto)}</td>
                      </tr>
                    ))}
                    {!reportePagos.length && <tr><td colSpan="5">Sin pagos registrados para el período seleccionado.</td></tr>}
                  </tbody>
                </table>
              </div>
              <h4 style={{ margin: '18px 0 8px' }}>Resumen por tipo de pago</h4>
              <div className="table-scroll">
                <table>
                  <thead><tr><th>Tipo de pago</th><th>Operaciones</th><th>Subtotal</th></tr></thead>
                  <tbody>
                    {resumenMetodos.map((item) => (
                      <tr key={item.metodo}><td>{item.metodo}</td><td>{item.operaciones}</td><td>{formatMoney(item.total)}</td></tr>
                    ))}
                    {!resumenMetodos.length && <tr><td colSpan="3">Sin operaciones</td></tr>}
                  </tbody>
                </table>
              </div>
              <div style={{ textAlign: 'right', marginTop: '12px', fontWeight: 700 }}>
                Total de ingresos: {formatMoney(totalReporte)}
              </div>
            </div>
          )}
        </div>
      </div>}

      <div className="panel">
        <div className="panel-head">
          <div>
            <h3>Registro de pagos</h3>
            <p style={{ color: 'var(--ink-soft)', fontSize: '13px', marginTop: '4px' }}>
              Consulta los cobros registrados por fecha, método y referencia.
            </p>
          </div>
          <Receipt size={22} color="var(--primary)" />
        </div>
        <div className="panel-body" style={{ padding: 0 }}>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Paciente</th>
                  <th>Monto</th>
                  <th>Método</th>
                  <th>Descripción</th>
                  <th>Referencia</th>
                </tr>
              </thead>
              <tbody>
                {pagos.map((pago) => (
                  <tr key={pago.id}>
                    <td>{formatDate(pago.fecha)}</td>
                    <td><b>{pago.paciente_nombre}</b></td>
                    <td>{pago.metodo_pago === 'Exonerado' ? 'Exonerado' : `$${Number(pago.monto || 0).toFixed(2)}`}</td>
                    <td>{pago.metodo_pago}</td>
                    <td>{pago.descripcion}</td>
                    <td>{pago.referencia || '—'}</td>
                  </tr>
                ))}
                {!pagos.length && (
                  <tr><td colSpan="6">No hay pagos registrados.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Registrar pago"
        footer={(
          <>
            <button className="btn btn-ghost" onClick={() => setIsModalOpen(false)} disabled={isSaving}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Guardando...' : 'Guardar pago'}
            </button>
          </>
        )}
      >
        <div className="form-grid">
          <div className="field span-2">
            <label>Paciente *</label>
            <select
              value={form.paciente_id}
              onChange={(e) => {
                const paciente = pacientes.find((item) => item.id === e.target.value);
                setForm({ ...form, paciente_id: paciente?.id || '', paciente_nombre: paciente?.nombres || '' });
              }}
            >
              <option value="">Seleccionar paciente o escribir abajo</option>
              {pacientes.map((paciente) => <option key={paciente.id} value={paciente.id}>{paciente.nombres}</option>)}
            </select>
          </div>
          <div className="field span-2">
            <input
              type="text"
              value={form.paciente_nombre}
              placeholder="Nombre del paciente"
              onChange={(e) => setForm({ ...form, paciente_nombre: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Monto *</label>
            <input type="number" min="0" step="0.01" value={form.monto} disabled={form.metodo_pago === 'Exonerado'} onChange={(e) => setForm({ ...form, monto: e.target.value })} />
          </div>
          <div className="field">
            <label>Fecha *</label>
            <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
          </div>
          <div className="field span-2">
            <label>Método de pago *</label>
            <select value={form.metodo_pago} onChange={(e) => setForm({ ...form, metodo_pago: e.target.value })}>
              {METODOS_PAGO.map((metodo) => <option key={metodo} value={metodo}>{metodo}</option>)}
            </select>
          </div>
          <div className="field span-2">
            <label>Descripción del pago *</label>
            <textarea rows={3} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          </div>
          <div className="field span-2">
            <label>Referencia de pago</label>
            <input type="text" value={form.referencia} onChange={(e) => setForm({ ...form, referencia: e.target.value })} placeholder="Número de operación o comprobante" />
          </div>
          {error && <div className="login-error span-2" style={{ display: 'block' }}>{error}</div>}
        </div>
      </Modal>
    </>
  );
}
