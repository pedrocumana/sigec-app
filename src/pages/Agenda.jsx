import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import Topbar from '../components/topbar';
import Modal from '../components/Modal';
import { Plus, Receipt } from 'lucide-react';
import { formatDate } from '../lib/dateUtils';

const ESTADOS = ['Pendiente', 'En sala de espera', 'Confirmada', 'Completada', 'Cancelada', 'No asistió'];
const METODOS_PAGO = ['Pendiente de Pago', 'Pago Móvil', 'Zelle', 'Efectivo USD', 'Efectivo Bs', 'Transferencia', 'Exonerado'];

export default function Agenda() {
  const [citas, setCitas] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPagoModalOpen, setIsPagoModalOpen] = useState(false);
  const [vista, setVista] = useState('citas');
  const [pagoError, setPagoError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formData, setFormData] = useState({
    paciente_id: '',
    paciente_nombre: '',
    paciente_telefono_secundario: '',
    paciente_correo: '',
    paciente_ocupacion: '',
    fecha: new Date().toISOString().split('T')[0],
    hora: '08:00',
    motivo: '',
    monto_usd: 40,
    metodo_pago: 'Pendiente de Pago',
    estatus: 'Pendiente'
  });
  const [pagoForm, setPagoForm] = useState({
    cita_id: '',
    paciente_id: '',
    paciente_nombre: '',
    metodo_pago: 'Pago Móvil',
    monto: 0,
    fecha: new Date().toISOString().split('T')[0],
    descripcion: '',
    referencia: ''
  });

  useEffect(() => {
    fetchCitas();
    fetchPagos();
    fetchPacientes();

    const channel = supabase
      .channel('agenda-live-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'citas' }, fetchCitas)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagos' }, fetchPagos)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pacientes' }, fetchPacientes)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchCitas() {
    const { data } = await supabase.from('citas').select('*').order('fecha', { ascending: true });
    if (data) setCitas(data);
  }

  async function fetchPagos() {
    const { data } = await supabase.from('pagos').select('*').order('fecha', { ascending: false }).order('created_at', { ascending: false });
    if (data) setPagos(data);
  }

  async function fetchPacientes() {
    const { data } = await supabase.from('pacientes').select('id, nombres, historia, telefono_secundario, correo, ocupacion');
    if (data) setPacientes(data);
  }

  async function handleCreateCita() {
    setFormError('');

    if (!formData.paciente_nombre.trim() || !formData.motivo.trim()) {
      setFormError('Completa el nombre del paciente y el motivo de la visita.');
      return;
    }

    setIsSaving(true);
    const isExonerado = formData.metodo_pago === 'Exonerado';
    const cita = {
      paciente_id: formData.paciente_id || null,
      paciente_nombre: formData.paciente_nombre,
      paciente_telefono_secundario: formData.paciente_telefono_secundario,
      paciente_correo: formData.paciente_correo,
      paciente_ocupacion: formData.paciente_ocupacion,
      fecha: formData.fecha,
      hora: formData.hora,
      motivo: formData.motivo,
      metodo_pago: formData.metodo_pago,
      monto_usd: isExonerado ? 0 : formData.monto_usd,
      estatus: formData.estatus,
      exonerado: isExonerado
    };
    let { error } = await supabase.from('citas').insert([cita]);

    const schemaError = error?.message?.toLowerCase() || '';
    if (schemaError.includes('could not find the') && schemaError.includes('column')) {
      const { paciente_telefono_secundario, paciente_correo, paciente_ocupacion, ...citaBasica } = cita;
      ({ error } = await supabase.from('citas').insert([citaBasica]));
    }

    if (!error) {
      setIsModalOpen(false);
      setFormData({
        paciente_id: '',
        paciente_nombre: '',
        paciente_telefono_secundario: '',
        paciente_correo: '',
        paciente_ocupacion: '',
        fecha: new Date().toISOString().split('T')[0],
        hora: '08:00',
        motivo: '',
        monto_usd: 40,
        metodo_pago: 'Pendiente de Pago',
        estatus: 'Pendiente'
      });
      fetchCitas();
    } else {
      console.error('Error al agendar cita:', error);
      setFormError(error.message || 'No se pudo agendar la cita.');
    }

    setIsSaving(false);
  }

  async function handleStatusChange(citaId, newStatus) {
    await supabase.from('citas').update({ estatus: newStatus }).eq('id', citaId);
    fetchCitas();
  }

  function openPagoModal(cita = null) {
    setPagoError('');
    setPagoForm({
      cita_id: cita?.id || '',
      paciente_id: cita?.paciente_id || '',
      paciente_nombre: cita?.paciente_nombre || '',
      metodo_pago: cita?.exonerado ? 'Exonerado' : (cita?.metodo_pago === 'Pendiente de Pago' ? 'Pago Móvil' : cita?.metodo_pago || 'Pago Móvil'),
      monto: cita?.exonerado ? 0 : (cita?.monto_usd || 0),
      fecha: new Date().toISOString().split('T')[0],
      descripcion: cita?.motivo ? `Pago por ${cita.motivo}` : '',
      referencia: ''
    });
    setIsPagoModalOpen(true);
  }

  async function handleCreatePago() {
    setPagoError('');
    if (!pagoForm.paciente_nombre.trim() || !pagoForm.descripcion.trim()) {
      setPagoError('Completa el paciente y la descripción del pago.');
      return;
    }
    if (pagoForm.metodo_pago !== 'Exonerado' && Number(pagoForm.monto) <= 0) {
      setPagoError('El monto debe ser mayor que cero.');
      return;
    }

    setIsSaving(true);
    const { error } = await supabase.from('pagos').insert([{
      ...pagoForm,
      monto: pagoForm.metodo_pago === 'Exonerado' ? 0 : Number(pagoForm.monto)
    }]);

    if (error) {
      console.error('Error registrando pago:', error);
      setPagoError(error.message || 'No se pudo registrar el pago.');
    } else {
      setIsPagoModalOpen(false);
      fetchPagos();
    }
    setIsSaving(false);
  }

  return (
    <>
      <Topbar
        title="Agenda y Caja Bimoneda"
        actions={
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-ghost" onClick={() => openPagoModal()}>
              <Receipt size={16} /> Registrar pago
            </button>
            <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
              <Plus size={16} /> Nueva cita
            </button>
          </div>
        }
      />
      <div className="tabs" style={{ marginBottom: '16px', padding: 0 }}>
        <button className={`tab-btn ${vista === 'citas' ? 'active' : ''}`} onClick={() => setVista('citas')}>
          Citas
        </button>
        <button className={`tab-btn ${vista === 'pagos' ? 'active' : ''}`} onClick={() => setVista('pagos')}>
          Pagos registrados ({pagos.length})
        </button>
      </div>
      {vista === 'pagos' && (
        <div className="panel" style={{ marginBottom: '20px' }}>
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
      )}
      {vista === 'citas' && (
      <div className="panel">
        <div className="panel-body" style={{ padding: 0 }}>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Hora</th>
                  <th>Paciente</th>
                  <th>Motivo</th>
                  <th>Pago</th>
                  <th>Registrar pago</th>
                  <th>Estatus</th>
                </tr>
              </thead>
              <tbody>
                {citas.map(c => (
                  <tr key={c.id}>
                    <td>{formatDate(c.fecha)}</td>
                    <td><b>{c.hora}</b></td>
                    <td><b>{c.paciente_nombre}</b></td>
                    <td>{c.motivo || '—'}</td>
                    <td>
                      {c.exonerado ? (
                        <span className="pill pill-exonerado">Exonerado</span>
                      ) : (
                        <span>${c.monto_usd} ({c.metodo_pago})</span>
                      )}
                    </td>
                    <td>
                      <button className="btn btn-sm btn-ghost" onClick={() => openPagoModal(c)}>
                        <Receipt size={14} /> Registrar
                      </button>
                    </td>
                    <td>
                      <select
                        value={c.estatus}
                        onChange={(e) => handleStatusChange(c.id, e.target.value)}
                        style={{ padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--border)' }}
                      >
                        {ESTADOS.map(st => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setFormError('');
          setIsModalOpen(false);
        }}
        title="Nueva Cita Médica"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setIsModalOpen(false)} disabled={isSaving}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleCreateCita} disabled={isSaving}>
              {isSaving ? 'Agendando...' : 'Agendar'}
            </button>
          </>
        }
      >
        <div className="form-grid">
          <div className="field span-2">
            <label>Paciente registrado</label>
            <select
              value={formData.paciente_id}
              onChange={(e) => {
                const p = pacientes.find(x => x.id === e.target.value);
                setFormData({
                  ...formData,
                  paciente_id: p ? p.id : '',
                  paciente_nombre: p ? p.nombres : formData.paciente_nombre,
                  paciente_telefono_secundario: p ? (p.telefono_secundario || '') : formData.paciente_telefono_secundario,
                  paciente_correo: p ? (p.correo || '') : formData.paciente_correo,
                  paciente_ocupacion: p ? (p.ocupacion || '') : formData.paciente_ocupacion
                });
              }}
            >
              <option value="">-- Seleccionar o escribir libremente abajo --</option>
              {pacientes.map(p => (
                <option key={p.id} value={p.id}>{p.nombres} ({p.historia})</option>
              ))}
            </select>
          </div>
          <div className="field span-2">
            <label>Nombre del Paciente</label>
            <input
              type="text"
              required
              value={formData.paciente_nombre}
              onChange={(e) => setFormData({ ...formData, paciente_nombre: e.target.value })}
            />
          </div>
          <div className="field span-2">
            <label>Motivo de la visita *</label>
            <textarea
              required
              rows={3}
              value={formData.motivo}
              onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
              placeholder="Ej. Control de tensión arterial, consulta general..."
            />
          </div>
          <div className="field">
            <label>Teléfono Secundario</label>
            <input
              type="tel"
              value={formData.paciente_telefono_secundario}
              onChange={(e) => setFormData({ ...formData, paciente_telefono_secundario: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Correo</label>
            <input
              type="email"
              value={formData.paciente_correo}
              onChange={(e) => setFormData({ ...formData, paciente_correo: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Ocupación</label>
            <input
              type="text"
              value={formData.paciente_ocupacion}
              onChange={(e) => setFormData({ ...formData, paciente_ocupacion: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Fecha</label>
            <input
              type="date"
              value={formData.fecha}
              onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Hora</label>
            <input
              type="time"
              value={formData.hora}
              onChange={(e) => setFormData({ ...formData, hora: e.target.value })}
            />
          </div>
          <div className="field span-2">
            <label>Método de Pago</label>
            <select
              value={formData.metodo_pago}
              onChange={(e) => setFormData({ ...formData, metodo_pago: e.target.value })}
            >
              {METODOS_PAGO.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          {formData.metodo_pago !== 'Exonerado' && (
            <div className="field">
              <label>Monto USD ($)</label>
              <input
                type="number"
                value={formData.monto_usd}
                onChange={(e) => setFormData({ ...formData, monto_usd: parseFloat(e.target.value) || 0 })}
              />
            </div>
          )}
          {formError && <div className="login-error span-2" style={{ display: 'block' }}>{formError}</div>}
        </div>
      </Modal>

      <Modal
        isOpen={isPagoModalOpen}
        onClose={() => {
          setPagoError('');
          setIsPagoModalOpen(false);
        }}
        title="Registrar pago"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setIsPagoModalOpen(false)} disabled={isSaving}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleCreatePago} disabled={isSaving}>
              {isSaving ? 'Guardando...' : 'Guardar pago'}
            </button>
          </>
        }
      >
        <div className="form-grid">
          <div className="field span-2">
            <label>Paciente *</label>
            <input
              type="text"
              value={pagoForm.paciente_nombre}
              onChange={(e) => setPagoForm({ ...pagoForm, paciente_nombre: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Monto *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={pagoForm.monto}
              disabled={pagoForm.metodo_pago === 'Exonerado'}
              onChange={(e) => setPagoForm({ ...pagoForm, monto: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Fecha *</label>
            <input type="date" value={pagoForm.fecha} onChange={(e) => setPagoForm({ ...pagoForm, fecha: e.target.value })} />
          </div>
          <div className="field span-2">
            <label>Método de pago *</label>
            <select value={pagoForm.metodo_pago} onChange={(e) => setPagoForm({ ...pagoForm, metodo_pago: e.target.value })}>
              {METODOS_PAGO.filter((metodo) => metodo !== 'Pendiente de Pago').map((metodo) => (
                <option key={metodo} value={metodo}>{metodo}</option>
              ))}
            </select>
          </div>
          <div className="field span-2">
            <label>Descripción del pago *</label>
            <textarea rows={3} value={pagoForm.descripcion} onChange={(e) => setPagoForm({ ...pagoForm, descripcion: e.target.value })} />
          </div>
          <div className="field span-2">
            <label>Referencia de pago</label>
            <input type="text" value={pagoForm.referencia} onChange={(e) => setPagoForm({ ...pagoForm, referencia: e.target.value })} placeholder="Número de operación, comprobante o referencia" />
          </div>
          {pagoError && <div className="login-error span-2" style={{ display: 'block' }}>{pagoError}</div>}
        </div>
      </Modal>
    </>
  );
}