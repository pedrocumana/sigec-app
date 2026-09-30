import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import Topbar from '../components/topbar';
import Modal from '../components/Modal';
import { Plus, Search, Eye, Trash2 } from 'lucide-react';
import { formatDate } from '../lib/dateUtils';

export default function Pacientes() {
  const [pacientes, setPacientes] = useState([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    cedula_tipo: 'V-',
    cedula_num: '',
    nombres: '',
    fecha_nacimiento: '',
    fecha_primera_cita: new Date().toISOString().split('T')[0],
    telefono_principal: '',
    telefono_secundario: '',
    correo: '',
    ocupacion: '',
    direccion: ''
  });

  const { isMedico } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchPacientes();

    const channel = supabase
      .channel('pacientes-live-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pacientes' }, fetchPacientes)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchPacientes() {
    const { data } = await supabase.from('pacientes').select('*').order('nombres', { ascending: true });
    if (data) setPacientes(data);
  }

  async function handleCreate(e) {
    e.preventDefault();
    const cedula = formData.cedula_num ? `${formData.cedula_tipo}${formData.cedula_num}` : null;
    const { error } = await supabase.from('pacientes').insert([{
      nombres: formData.nombres,
      cedula,
      fecha_nacimiento: formData.fecha_nacimiento || null,
      fecha_primera_cita: formData.fecha_primera_cita || null,
      telefono_principal: formData.telefono_principal,
      telefono_secundario: formData.telefono_secundario,
      correo: formData.correo,
      ocupacion: formData.ocupacion,
      direccion: formData.direccion
    }]);

    if (!error) {
      setIsModalOpen(false);
      fetchPacientes();
      setFormData({
        cedula_tipo: 'V-',
        cedula_num: '',
        nombres: '',
        fecha_nacimiento: '',
        fecha_primera_cita: new Date().toISOString().split('T')[0],
        telefono_principal: '',
        telefono_secundario: '',
        correo: '',
        ocupacion: '',
        direccion: ''
      });
    }
  }

  async function handleDelete(id) {
    if (window.confirm('¿Seguro que deseas eliminar este paciente y todo su historial?')) {
      const { error } = await supabase.from('pacientes').delete().eq('id', id);
      if (!error) fetchPacientes();
    }
  }

  const filtered = pacientes.filter(p =>
    (p.nombres || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.cedula || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.historia || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <Topbar
        title="Pacientes y Expedientes"
        actions={
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={16} /> Nuevo paciente
          </button>
        }
      />
      <div className="panel">
        <div className="panel-head">
          <div className="field" style={{ margin: 0, width: '320px' }}>
            <input
              type="text"
              placeholder="Buscar por nombre, cédula o historia..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span style={{ fontSize: '12.5px', color: 'var(--ink-soft)' }}>
            {filtered.length} paciente(s)
          </span>
        </div>
        <div className="panel-body" style={{ padding: 0 }}>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Historia</th>
                  <th>Nombres</th>
                  <th>Cédula</th>
                  <th>Teléfono</th>
                  <th>1ª Cita</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td><span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 600 }}>{p.historia}</span></td>
                    <td><b>{p.nombres}</b></td>
                    <td>{p.cedula || '—'}</td>
                    <td>{p.telefono_principal || '—'}</td>
                    <td>{formatDate(p.fecha_primera_cita)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn-icon" onClick={() => navigate(`/pacientes/${p.id}`)}>
                          <Eye size={16} />
                        </button>
                        {isMedico && (
                          <button className="btn-icon" onClick={() => handleDelete(p.id)}>
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Nuevo Paciente"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleCreate}>Guardar paciente</button>
          </>
        }
      >
        <div className="form-grid">
          <div className="field">
            <label>Cédula</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <select
                style={{ width: '80px' }}
                value={formData.cedula_tipo}
                onChange={(e) => setFormData({ ...formData, cedula_tipo: e.target.value })}
              >
                <option value="V-">V-</option>
                <option value="E-">E-</option>
                <option value="J-">J-</option>
              </select>
              <input
                type="text"
                placeholder="12345678"
                value={formData.cedula_num}
                onChange={(e) => setFormData({ ...formData, cedula_num: e.target.value })}
              />
            </div>
          </div>
          <div className="field">
            <label>Nombres y Apellidos *</label>
            <input
              type="text"
              required
              value={formData.nombres}
              onChange={(e) => setFormData({ ...formData, nombres: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Fecha de Nacimiento</label>
            <input
              type="date"
              value={formData.fecha_nacimiento}
              onChange={(e) => setFormData({ ...formData, fecha_nacimiento: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Teléfono</label>
            <input
              type="tel"
              value={formData.telefono_principal}
              onChange={(e) => setFormData({ ...formData, telefono_principal: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Teléfono Secundario</label>
            <input
              type="tel"
              value={formData.telefono_secundario}
              onChange={(e) => setFormData({ ...formData, telefono_secundario: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Correo</label>
            <input
              type="email"
              value={formData.correo}
              onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Ocupación</label>
            <input
              type="text"
              value={formData.ocupacion}
              onChange={(e) => setFormData({ ...formData, ocupacion: e.target.value })}
            />
          </div>
          <div className="field span-2">
            <label>Dirección</label>
            <textarea
              value={formData.direccion}
              onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
            />
          </div>
        </div>
      </Modal>
    </>
  );
}