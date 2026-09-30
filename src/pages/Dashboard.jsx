import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import logoUrl from '../../logo_clinicasp26.jpg';

export default function Dashboard() {
  const { isMedico } = useAuth();
  const [stats, setStats] = useState({ citasHoy: 0, enSala: 0, recaudado: 0 });
  const [citasHoy, setCitasHoy] = useState([]);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    fetchDashboardData();

    const channel = supabase
      .channel('dashboard-citas-live-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'citas' }, fetchDashboardData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagos' }, fetchDashboardData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchDashboardData() {
    const { data: citas } = await supabase
      .from('citas')
      .select('*, pacientes(historia)')
      .eq('fecha', today)
      .order('hora', { ascending: true });

    const { data: pagos } = await supabase
      .from('pagos')
      .select('monto, metodo_pago')
      .eq('fecha', today);

    if (citas) {
      setCitasHoy(citas);
      const enSala = citas.filter((c) => c.estatus === 'En sala de espera').length;
      const recaudado = (pagos || []).reduce((acc, pago) => acc + (parseFloat(pago.monto) || 0), 0);
      setStats({ citasHoy: citas.length, enSala, recaudado });
    }
  }

  async function atenderCita(citaId) {
    const { error } = await supabase
      .from('citas')
      .update({ estatus: 'Completada', atendida_en: new Date().toISOString() })
      .eq('id', citaId);

    if (!error) fetchDashboardData();
  }

  return (
    <div>
      <div className="dashboard-brand">
        <img src={logoUrl} alt="Clínica San Pedro" />
        <div>
          <h1>Clínica San Pedro</h1>
          <p>Panel de gestión clínica</p>
        </div>
      </div>
      <div className="grid-stats">
        <div className="stat-card">
          <div className="accent-bar"></div>
          <div className="num">{stats.citasHoy}</div>
          <div className="lbl">Citas para hoy</div>
        </div>
        <div className="stat-card">
          <div className="accent-bar"></div>
          <div className="num">{stats.enSala}</div>
          <div className="lbl">En sala de espera</div>
        </div>
        {isMedico && (
          <div className="stat-card">
            <div className="accent-bar"></div>
            <div className="num">${stats.recaudado.toFixed(2)}</div>
            <div className="lbl">Recaudación USD (Hoy)</div>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>Agenda del día</h3>
        </div>
        <div className="panel-body">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Paciente</th>
                  <th>Motivo</th>
                  <th>Estatus</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {citasHoy.map((c) => (
                  <tr key={c.id}>
                    <td><b>{c.hora}</b></td>
                    <td>{c.paciente_nombre}</td>
                    <td>{c.motivo}</td>
                    <td><span className="pill">{c.estatus}</span></td>
                    <td>
                      {isMedico && c.estatus !== 'Completada' && (
                        <button className="btn btn-sm btn-ok" onClick={() => atenderCita(c.id)}>
                          Atender
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}