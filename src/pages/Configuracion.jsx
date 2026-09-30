import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import Topbar from '../components/topbar';
import { formatDate } from '../lib/dateUtils';

const EMPTY_USER = { nombre: '', email: '', password: '', rol: 'secretaria' };

export default function Configuracion() {
  const { isMedico } = useAuth();
  const [config, setConfig] = useState({
    tasa_bcv: 36.50,
    medico_nombre: '',
    especialidad: '',
    mpps: '',
    colegio_medicos: '',
    rif: '',
    direccion_clinica: ''
  });
  const [usuarios, setUsuarios] = useState([]);
  const [newUser, setNewUser] = useState(EMPTY_USER);
  const [userError, setUserError] = useState('');
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  useEffect(() => {
    fetchConfig();
    fetchUsuarios();

    const channel = supabase
      .channel('configuracion-live-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracion' }, fetchConfig)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchConfig() {
    const { data } = await supabase.from('configuracion').select('*').eq('id', 1).single();
    if (data) setConfig(data);
  }

  async function fetchUsuarios() {
    const { data, error } = await supabase.from('profiles').select('id, nombre, rol, created_at').order('nombre', { ascending: true });
    if (error) {
      console.error('Error cargando usuarios:', error);
      return;
    }
    setUsuarios(data || []);
  }

  async function handleCreateUser() {
    setUserError('');
    if (!newUser.nombre.trim() || !newUser.email.trim() || !newUser.password) {
      setUserError('Completa nombre, correo y contraseña.');
      return;
    }

    setIsCreatingUser(true);
    const { data, error } = await supabase.functions.invoke('create-user', {
      body: {
        nombre: newUser.nombre,
        email: newUser.email,
        password: newUser.password,
        rol: newUser.rol
      }
    });

    if (error || data?.error) {
      setUserError(error?.message || data?.error || 'No se pudo crear el usuario.');
    } else {
      setNewUser(EMPTY_USER);
      fetchUsuarios();
      alert('Usuario creado correctamente.');
    }
    setIsCreatingUser(false);
  }

  async function handleSave() {
    const { error } = await supabase.from('configuracion').update({
      tasa_bcv: config.tasa_bcv
    }).eq('id', 1);

    if (!error) alert('Tasa BCV actualizada correctamente.');
  }

  return (
    <>
      <Topbar title="Configuración y Sistema" />

      <div className="panel" style={{ marginBottom: '24px' }}>
        <div className="panel-head">
          <h3>Tasa Oficial Banco Central de Venezuela (BCV)</h3>
        </div>
        <div className="panel-body">
          <div className="field" style={{ maxWidth: '300px' }}>
            <label>Tasa BCV (Bs/$)</label>
            <input
              type="number"
              step="0.01"
              value={config.tasa_bcv}
              onChange={(e) => setConfig({ ...config, tasa_bcv: parseFloat(e.target.value) })}
            />
          </div>
          <button className="btn btn-primary" onClick={handleSave}>Actualizar Tasa</button>
        </div>
      </div>

      {isMedico && (
        <div className="panel" style={{ marginBottom: '24px' }}>
          <div className="panel-head">
            <h3>Usuarios y roles</h3>
          </div>
          <div className="panel-body">
            <p style={{ color: 'var(--ink-soft)', fontSize: '13px', marginBottom: '16px' }}>
              Crea usuarios y asígnales acceso de médico o secretaria.
            </p>
            <div className="form-grid">
              <div className="field">
                <label>Nombre completo</label>
                <input type="text" value={newUser.nombre} onChange={(e) => setNewUser({ ...newUser, nombre: e.target.value })} />
              </div>
              <div className="field">
                <label>Correo electrónico</label>
                <input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
              </div>
              <div className="field">
                <label>Contraseña temporal</label>
                <input type="password" minLength="6" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
              </div>
              <div className="field">
                <label>Rol</label>
                <select value={newUser.rol} onChange={(e) => setNewUser({ ...newUser, rol: e.target.value })}>
                  <option value="secretaria">Secretaria</option>
                  <option value="medico">Médico</option>
                </select>
              </div>
            </div>
            {userError && <div className="login-error" style={{ display: 'block', marginBottom: '16px' }}>{userError}</div>}
            <button className="btn btn-primary" onClick={handleCreateUser} disabled={isCreatingUser}>
              {isCreatingUser ? 'Creando usuario...' : 'Crear usuario'}
            </button>

            <div className="table-scroll" style={{ marginTop: '24px' }}>
              <table>
                <thead><tr><th>Nombre</th><th>Rol</th><th>Creado</th></tr></thead>
                <tbody>
                  {usuarios.map((usuario) => (
                    <tr key={usuario.id}>
                      <td>{usuario.nombre}</td>
                      <td>{usuario.rol === 'medico' ? 'Médico' : 'Secretaria'}</td>
                      <td>{formatDate(usuario.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <h3>Datos Institucionales del Médico</h3>
        </div>
        <div className="panel-body">
          <div className="form-grid">
            <div className="field">
              <label>Médico Titular</label>
              <input type="text" value={config.medico_nombre} disabled />
            </div>
            <div className="field">
              <label>Especialidad</label>
              <input type="text" value={config.especialidad} disabled />
            </div>
            <div className="field">
              <label>MPPS</label>
              <input type="text" value={config.mpps} disabled />
            </div>
            <div className="field">
              <label>Colegio de Médicos</label>
              <input type="text" value={config.colegio_medicos} disabled />
            </div>
            <div className="field span-2">
              <label>Dirección</label>
              <textarea value={config.direccion_clinica} disabled />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}