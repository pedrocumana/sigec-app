import React, { useEffect, useState } from 'react';
import { Receipt, Plus } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import Topbar from '../components/topbar';
import Modal from '../components/Modal';
import { formatDate } from '../lib/dateUtils';

const METODOS_PAGO = ['Pago Móvil', 'Zelle', 'Efectivo USD', 'Efectivo Bs', 'Transferencia', 'Exonerado'];

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
  const { profile } = useAuth();
  const [pagos, setPagos] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

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
