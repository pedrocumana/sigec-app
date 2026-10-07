import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import Topbar from '../components/topbar';
import { formatDate } from '../lib/dateUtils';

const EMPTY_USER = { nombre: '', email: '', password: '', rol: 'secretaria' };
const EMPTY_CONFIG = {
  tasa_bcv: 36.5,
  medico_nombre: '',
  especialidad: '',
  mpps: '',
  colegio_medicos: '',
  rif: '',
  direccion_clinica: ''
};

export default function Configuracion() {
  const { isMedico } = useAuth();
  const [config, setConfig] = useState(EMPTY_CONFIG);
  const [usuarios, setUsuarios] = useState([]);
  const [newUser, setNewUser] = useState(EMPTY_USER);
  const [userError, setUserError] = useState('');
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState('');

  const updateConfigField = (field, value) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

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
    const { data, error } = await supabase
      .from('configuracion')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (error) {
      console.error('Error cargando configuración:', error);
      return;
    }

    if (data) {
      setConfig({
        ...EMPTY_CONFIG,
        ...data,
        tasa_bcv: Number(data.tasa_bcv ?? EMPTY_CONFIG.tasa_bcv)
      });
    }
  }

  async function fetchUsuarios() {
    const { data, error } = await supabase.from('profiles').select('id, nombre, rol, is_active, created_at').order('nombre', { ascending: true });
    if (error) {
      console.error('Error cargando usuarios:', error);
      return;
    }
    setUsuarios(data || []);
  }

  async function handleToggleUserAccess(usuario) {
    const nextActive = usuario.is_active === false;
    const actionLabel = nextActive ? 'habilitar' : 'inhabilitar';
    if (!window.confirm(`¿Confirmas ${actionLabel} el acceso de ${usuario.nombre}? Sus registros históricos se conservarán.`)) return;

    setUpdatingUserId(usuario.id);
    const { data, error } = await supabase.functions.invoke('manage-user-access', {
      body: { userId: usuario.id, active: nextActive }
    });

    if (error || data?.error) {
      console.error('Error actualizando acceso del usuario:', error || data.error);
      alert(data?.error || error?.message || 'No se pudo actualizar el acceso del usuario.');
    } else {
      await fetchUsuarios();
      alert(nextActive ? 'Acceso habilitado correctamente.' : 'Usuario inhabilitado. Su historial se conserva.');
    }
    setUpdatingUserId('');
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
    const tasaBCV = Number(config.tasa_bcv);

    if (!Number.isFinite(tasaBCV) || tasaBCV <= 0) {
      alert('La tasa BCV debe ser un valor numérico válido.');
      return;
    }

    setIsSavingConfig(true);

    const { error } = await supabase.from('configuracion').update({
      tasa_bcv: tasaBCV,
      medico_nombre: config.medico_nombre?.trim() || EMPTY_CONFIG.medico_nombre,
      especialidad: config.especialidad?.trim() || EMPTY_CONFIG.especialidad,
      mpps: config.mpps?.trim() || EMPTY_CONFIG.mpps,
      colegio_medicos: config.colegio_medicos?.trim() || EMPTY_CONFIG.colegio_medicos,
      rif: config.rif?.trim() || EMPTY_CONFIG.rif,
      direccion_clinica: config.direccion_clinica?.trim() || EMPTY_CONFIG.direccion_clinica,
      updated_at: new Date().toISOString()
    }).eq('id', 1);

    setIsSavingConfig(false);

    if (error) {
      console.error('Error actualizando configuración:', error);
      alert('No se pudo guardar la configuración.');
      return;
    }

    alert('Configuración actualizada correctamente.');
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
              onChange={(e) => updateConfigField('tasa_bcv', Number(e.target.value || 0))}
              disabled={!isMedico}
            />
          </div>
          {isMedico && (
            <button className="btn btn-primary" onClick={handleSave} disabled={isSavingConfig}>
              {isSavingConfig ? 'Guardando...' : 'Actualizar Tasa'}
            </button>
          )}
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
                <thead><tr><th>Nombre</th><th>Rol</th><th>Estado</th><th>Creado</th><th>Acceso</th></tr></thead>
                <tbody>
                  {usuarios.map((usuario) => (
                    <tr key={usuario.id}>
                      <td>{usuario.nombre}</td>
                      <td>{usuario.rol === 'medico' ? 'Médico' : 'Secretaria'}</td>
                      <td>{usuario.is_active === false ? 'Inhabilitado' : 'Activo'}</td>
                      <td>{formatDate(usuario.created_at)}</td>
                      <td>
                        <button
                          className={`btn btn-sm ${usuario.is_active === false ? 'btn-ok' : 'btn-ghost'}`}
                          onClick={() => handleToggleUserAccess(usuario)}
                          disabled={updatingUserId === usuario.id}
                        >
                          {updatingUserId === usuario.id ? 'Actualizando...' : usuario.is_active === false ? 'Habilitar' : 'Inhabilitar'}
                        </button>
                      </td>
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
              <input type="text" value={config.medico_nombre} onChange={(e) => updateConfigField('medico_nombre', e.target.value)} disabled={!isMedico} />
            </div>
            <div className="field">
              <label>Especialidad</label>
              <input type="text" value={config.especialidad} onChange={(e) => updateConfigField('especialidad', e.target.value)} disabled={!isMedico} />
            </div>
            <div className="field">
              <label>MPPS</label>
              <input type="text" value={config.mpps} onChange={(e) => updateConfigField('mpps', e.target.value)} disabled={!isMedico} />
            </div>
            <div className="field">
              <label>Colegio de Médicos</label>
              <input type="text" value={config.colegio_medicos} onChange={(e) => updateConfigField('colegio_medicos', e.target.value)} disabled={!isMedico} />
            </div>
            <div className="field">
              <label>RIF</label>
              <input type="text" value={config.rif} onChange={(e) => updateConfigField('rif', e.target.value)} disabled={!isMedico} />
            </div>
            <div className="field span-2">
              <label>Dirección</label>
              <textarea value={config.direccion_clinica} onChange={(e) => updateConfigField('direccion_clinica', e.target.value)} disabled={!isMedico} />
            </div>
          </div>

          {isMedico && (
            <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={handleSave} disabled={isSavingConfig}>
              {isSavingConfig ? 'Guardando cambios...' : 'Guardar configuración'}
            </button>
          )}
        </div>
      </div>
    </>
  );
}