import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import Topbar from '../components/topbar';
import Modal from '../components/Modal';
import { ArrowLeft, Plus, Printer } from 'lucide-react';
import { formatDate } from '../lib/dateUtils';
import logoUrl from '../../logo_clinicasp26.jpg';

function openPrintWindow({ title, orientation, content, styles }) {
  const printWindow = window.open('', '_blank');

  if (!printWindow) {
    alert('El navegador bloqueó la ventana de impresión. Permita las ventanas emergentes para este sitio e inténtelo nuevamente.');
    return;
  }

  const pageSize = orientation === 'landscape' ? '11in 8.5in' : '8.5in 11in';

  printWindow.onafterprint = () => {
    printWindow.close();
  };

  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title}</title>
        <style>
          @page { size: ${pageSize}; margin: 10mm; }
          * { box-sizing: border-box; }
          html, body { margin: 0; padding: 0; color: #000; font-family: Arial, sans-serif; }
          ${styles}
          @media print {
            html, body { width: 100%; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>${content}</body>
    </html>`);
  printWindow.document.close();

  Promise.all([
    printWindow.document.fonts?.ready,
    ...Array.from(printWindow.document.images, (image) => image.decode().catch(() => undefined))
  ]).then(() => {
    printWindow.focus();
    printWindow.print();
  });
}

const EXAMEN_FUNCIONAL_FIELDS = [
  ['motivo_consulta', 'Motivo de consulta'],
  ['enfermedad_actual', 'Enfermedad actual'],
  ['antecedentes_personales', 'Antecedentes personales'],
  ['antecedentes_familiares', 'Antecedentes familiares'],
  ['antecedentes_gineco_obstetricos', 'Antecedentes gineco-obstétricos'],
  ['habitos_psico_biologicos', 'Hábitos psico-biológicos'],
  ['observaciones', 'Observaciones']
];

const EXAMEN_FISICO_FIELDS = [
  ['general', 'General'],
  ['orl', 'ORL'],
  ['torax', 'Tórax'],
  ['abdomen', 'Abdomen'],
  ['extremidades', 'Extremidades'],
  ['ecg', 'ECG'],
  ['piel', 'Piel'],
  ['cuello', 'Cuello'],
  ['cardiopulmonar', 'Cardiopulmonar'],
  ['genitales_externos', 'Genitales externos'],
  ['neurologicos', 'Neurológicos'],
  ['laboratorios', 'Laboratorios']
];

const INFORME_HEADER = [
  'Dr. Leonel Alex Fernández González',
  'Medicina Interna-Obesología-Ecografía Integral y Doppler Vascular',
  'Consultorio 7 en la Clinica San Pedro, S.A.',
  'Avenida Mario Briceño Iragorri, cruce con Paseo Heres.',
  'Ciudad Bolívar - Estado Bolívar',
  'Telf. 0412-0864084/0416-3197560',
  'Licdo en Educación',
  'Especialista y Magister en Gerencia, Planificación y Evaluación',
  'Diplomado en Quiropraxia',
  'Criminólogo',
  'Miembro activo y agregado en la SCVMI, AVA, IAS, SCVO, FENADIABETES, AVESO'
];

const INFORME_FOOTER = [
  'Dr. Leonel Fernández',
  'Medicina Interna-Obesología-Ecografía Integral y Doppler Vascular',
  'MPPS: 70414-CMEB: 6459'
];

export default function PacienteDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isMedico, profile } = useAuth();
  const currentRole = typeof profile?.rol === 'string'
    ? profile.rol
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()
    : '';
  const canManageTemplates = isMedico || currentRole === 'medico';

  const [paciente, setPaciente] = useState(null);
  const [tab, setTab] = useState('general');
  const [evoluciones, setEvoluciones] = useState([]);
  const [informes, setInformes] = useState([]);
  const [isInformeModalOpen, setIsInformeModalOpen] = useState(false);
  const [informeForm, setInformeForm] = useState({
    fecha_emision: new Date().toISOString().split('T')[0],
    informe: ''
  });
  const [plantillas, setPlantillas] = useState([]);
  const [templateNombre, setTemplateNombre] = useState('');
  const [isEvModalOpen, setIsEvModalOpen] = useState(false);
  const [evForm, setEvForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    hora: new Date().toTimeString().slice(0,5),
    motivo: '',
    pa: '', fc: '', fr: '', temp: '', peso: '', talla: '',
    sintomas: '', examenBreve: '', diagnostico: '', plan: '', observaciones: ''
  });

  useEffect(() => {
    fetchPaciente();
    fetchEvoluciones();
    fetchInformes();
    fetchPlantillas();

    const channel = supabase
      .channel(`paciente-detalle-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pacientes', filter: `id=eq.${id}` }, fetchPaciente)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'evoluciones', filter: `paciente_id=eq.${id}` }, fetchEvoluciones)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'informes_medicos', filter: `paciente_id=eq.${id}` }, fetchInformes)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plantillas' }, fetchPlantillas)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  async function fetchPlantillas() {
    const { data, error } = await supabase
      .from('plantillas')
      .select('*')
      .eq('activo', true)
      .order('nombre', { ascending: true });

    if (!error) setPlantillas(data || []);
  }

  async function fetchPaciente() {
    const { data } = await supabase.from('pacientes').select('*').eq('id', id).single();
    if (data) setPaciente(data);
  }

  async function fetchEvoluciones() {
    const { data } = await supabase.from('evoluciones').select('*').eq('paciente_id', id).order('fecha', { ascending: false });
    if (data) setEvoluciones(data);
  }

  async function fetchInformes() {
    const { data, error } = await supabase
      .from('informes_medicos')
      .select('*')
      .eq('paciente_id', id)
      .order('fecha_emision', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error cargando informes médicos:', error);
      return;
    }

    setInformes(data || []);
  }

  async function handleSaveInforme() {
    if (!informeForm.informe.trim()) {
      alert('Escribe el contenido del informe médico.');
      return;
    }

    const { error } = await supabase.from('informes_medicos').insert([{
      paciente_id: id,
      paciente_nombre: paciente.nombres,
      paciente_cedula: paciente.cedula || null,
      fecha_emision: informeForm.fecha_emision,
      informe: informeForm.informe.trim(),
      created_by: profile?.id || null
    }]);

    if (error) {
      console.error('Error guardando informe médico:', error);
      alert('No se pudo guardar el informe médico.');
      return;
    }

    setInformeForm({
      fecha_emision: new Date().toISOString().split('T')[0],
      informe: ''
    });
    setIsInformeModalOpen(false);
    fetchInformes();
  }

  const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  function printInforme(informe) {
    const content = `
      <header class="informe-header">
        <img src="${logoUrl}" alt="Clínica San Pedro" />
        <div class="informe-header-copy">
          ${INFORME_HEADER.map((line) => `<div>${escapeHtml(line)}</div>`).join('')}
        </div>
      </header>
      <section class="informe-meta">
        <div><b>Paciente:</b> ${escapeHtml(informe.paciente_nombre)}</div>
        <div><b>Cédula:</b> ${escapeHtml(informe.paciente_cedula || '—')}</div>
        <div><b>Fecha:</b> ${escapeHtml(formatDate(informe.fecha_emision))}</div>
      </section>
      <h1>INFORME MEDICO</h1>
      <main class="informe-body">${escapeHtml(informe.informe).replace(/\n/g, '<br />')}</main>
      <footer class="informe-footer">
        ${INFORME_FOOTER.map((line) => `<div>${escapeHtml(line)}</div>`).join('')}
      </footer>
    `;

    openPrintWindow({
      title: 'Informe médico',
      orientation: 'portrait',
      content,
      styles: `
        .informe-header { display: flex !important; flex-direction: row !important; align-items: center !important; justify-content: flex-start !important; gap: 16px; padding-bottom: 8px; border-bottom: 1px solid #000; text-align: left !important; font-size: 8pt; line-height: 1.2; }
        .informe-header img { display: block; order: 0; flex: 0 0 110px; width: 110px; height: 110px; margin: 0; object-fit: contain; }
        .informe-header-copy { order: 1; flex: 1; min-width: 0; text-align: left !important; }
        .informe-meta { margin-top: 24px; line-height: 1.6; }
        h1 { margin: 28px 0 24px; text-align: center; font-size: 16pt; }
        .informe-body { min-height: 420px; text-align: justify; line-height: 1.6; }
        .informe-footer { margin-top: 8px; text-align: center; line-height: 1.3; break-inside: avoid; }
      `
    });
  }

  async function handleSaveGeneral() {
    await supabase.from('pacientes').update({
      nombres: paciente.nombres,
      cedula: paciente.cedula,
      telefono_principal: paciente.telefono_principal,
      telefono_secundario: paciente.telefono_secundario,
      correo: paciente.correo,
      ocupacion: paciente.ocupacion,
      direccion: paciente.direccion
    }).eq('id', id);
    alert('Datos actualizados');
  }

  async function handleSaveExamen(tipo) {
    const column = tipo === 'funcional' ? 'examen_funcional' : 'examen_fisico';
    const values = paciente[column] || {};
    const { error } = await supabase
      .from('pacientes')
      .update({ [column]: values })
      .eq('id', id);

    if (error) {
      console.error(`Error guardando examen ${tipo}:`, error);
      alert('No se pudo guardar el examen.');
      return;
    }

    alert(`Examen ${tipo} guardado correctamente`);
  }

  function updateExamenField(tipo, field, value) {
    const column = tipo === 'funcional' ? 'examen_funcional' : 'examen_fisico';
    setPaciente({
      ...paciente,
      [column]: {
        ...(paciente[column] || {}),
        [field]: value
      }
    });
  }

  async function handleSavePlanteamiento() {
    await supabase.from('pacientes').update({
      planteamiento: paciente.planteamiento
    }).eq('id', id);
    alert('Diagnóstico y tratamiento guardados');
  }

  function calculateAge(fechaNacimiento) {
    if (!fechaNacimiento) return '—';
    const birthDate = new Date(`${fechaNacimiento}T00:00:00`);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const birthdayNotReached = today.getMonth() < birthDate.getMonth()
      || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate());
    if (birthdayNotReached) age -= 1;
    return age >= 0 ? `${age} años` : '—';
  }

  async function handleSaveTemplate() {
    if (!canManageTemplates) {
      alert('Solo el médico puede guardar plantillas.');
      return;
    }

    const nombre = templateNombre.trim();
    const plan = paciente.planteamiento?.plan || '';
    const tratamiento = paciente.planteamiento?.tratamiento || '';

    if (!nombre) {
      alert('Escribe un nombre para la plantilla antes de guardarla.');
      return;
    }

    if (!plan && !tratamiento) {
      alert('Primero escribe un plan o tratamiento para guardar la plantilla.');
      return;
    }

    const { error } = await supabase.from('plantillas').insert([{
      nombre,
      plan,
      tratamiento,
      created_by: profile?.id
    }]);

    if (error) {
      console.error('Error guardando plantilla:', error);
      alert('No se pudo guardar la plantilla.');
      return;
    }

    setTemplateNombre('');
    fetchPlantillas();
    alert('Plantilla guardada correctamente.');
  }

  async function handleSaveEvolucion() {
    const signos_vitales = {
      pa: evForm.pa, fc: evForm.fc, fr: evForm.fr,
      temp: evForm.temp, peso: evForm.peso, talla: evForm.talla,
      imc: (evForm.peso && evForm.talla) ? (evForm.peso / Math.pow(evForm.talla/100, 2)).toFixed(1) : null
    };

    const { error } = await supabase.from('evoluciones').insert([{
      paciente_id: id,
      fecha: evForm.fecha,
      hora: evForm.hora,
      motivo: evForm.motivo,
      signos_vitales,
      sintomas: evForm.sintomas,
      examen_breve: evForm.examenBreve,
      diagnostico: evForm.diagnostico,
      plan: evForm.plan,
      observaciones: evForm.observaciones,
      created_by: profile.id
    }]);

    if (!error) {
      setIsEvModalOpen(false);
      fetchEvoluciones();
    }
  }

  const printRecipe = () => {
    const pl = paciente.planteamiento || {};
    const patientData = `
      <div class="recipe-patient"><b>Paciente:</b> ${escapeHtml(paciente.nombres)}</div>
      <div class="recipe-patient"><b>Cédula:</b> ${escapeHtml(paciente.cedula || '—')}</div>
      <div class="recipe-patient"><b>Edad:</b> ${escapeHtml(calculateAge(paciente.fecha_nacimiento))}</div>
      <div class="recipe-patient"><b>Fecha:</b> ${escapeHtml(formatDate(new Date().toISOString()))}</div>
      <div class="recipe-patient"><b>Próxima cita:</b> ${escapeHtml(pl.proxima_cita || '—')}</div>
    `;
    const recipeHeader = `
      <div class="recipe-header">
        <img src="${logoUrl}" alt="Clínica San Pedro" />
        <div>
          <div>Dr. LEONEL FERNANDEZ</div>
          <div>MEDICINA INTERNA - MEDICINA DE OBESIDAD</div>
          <div>ECOGRAFÍA INTEGRAL Y DOPPLER VASCULAR - QUIROPRÁCTICO</div>
          <div>CLINICA SAN PEDRO</div>
          <div>CONSULTORIO 7</div>
        </div>
      </div>
    `;
    const recipeFooter = '<div class="recipe-footer">telf: 0412-0864084 -- Instagram: dr.leoferinternista -- tiktok: leonelfernandezgonzalez1</div>';

    const content = `
      <table class="recipe-table">
        <thead>
          <tr>
            <th>
              ${recipeHeader}
              <h2>DIAGNÓSTICO</h2>
              ${patientData}
            </th>
            <th>
              ${recipeHeader}
              <h2>TRATAMIENTO</h2>
              ${patientData}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><div class="recipe-content">${escapeHtml(pl.plan || '—').replace(/\n/g, '<br />')}</div></td>
            <td><div class="recipe-content">${escapeHtml(pl.tratamiento || '—').replace(/\n/g, '<br />')}</div></td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td>${recipeFooter}</td>
            <td>${recipeFooter}</td>
          </tr>
        </tfoot>
      </table>
    `;

    openPrintWindow({
      title: 'Diagnóstico y Tratamiento',
      orientation: 'landscape',
      content,
      styles: `
        .recipe-table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 11pt; }
        .recipe-table thead { display: table-header-group; }
        .recipe-table tfoot { display: table-footer-group; }
        .recipe-table th, .recipe-table td { width: 50%; padding: 0 10px; vertical-align: top; text-align: left; font-weight: 400; }
        .recipe-table th + th, .recipe-table td + td { border-left: 1px solid #000; }
        .recipe-table tbody { display: table-row-group; }
        .recipe-table tbody tr, .recipe-table tbody td { break-inside: auto; page-break-inside: auto; }
        .recipe-header { display: flex !important; flex-direction: row !important; align-items: flex-start; gap: 8px; min-height: 54px; padding-bottom: 7px; border-bottom: 1px solid #000; text-align: center; font-size: 11pt; line-height: 1.25; }
        .recipe-header img { display: block; width: 48px; height: 48px; margin: 0; object-fit: contain; flex: 0 0 48px; }
        .recipe-header > div { flex: 1; }
        h2 { margin: 8px 0 6px; text-align: center; font-size: 10pt; }
        .recipe-patient { line-height: 1.4; }
        .recipe-content { margin-top: 8px; text-align: justify; white-space: normal; overflow-wrap: anywhere; font-size: 10pt; line-height: 1.4; }
        .recipe-footer { padding-top: 8px; border-top: 1px solid #000; text-align: center; font-size: 8pt; line-height: 1.2; }
      `
    });
  };

  if (!paciente) return <div style={{ padding: '20px' }}>Cargando expediente...</div>;

  return (
    <>
      <Topbar
        title={`Expediente: ${paciente.nombres}`}
        actions={
          <button className="btn btn-ghost" onClick={() => navigate('/pacientes')}>
            <ArrowLeft size={16} /> Volver
          </button>
        }
      />

      <div className="panel">
        <div className="tabs">
          <button className={`tab-btn ${tab === 'general' ? 'active' : ''}`} onClick={() => setTab('general')}>
            Datos generales
          </button>
          {isMedico && (
            <>
                  <button className={`tab-btn ${tab === 'funcional' ? 'active' : ''}`} onClick={() => setTab('funcional')}>
                    Examen funcional
                  </button>
                  <button className={`tab-btn ${tab === 'fisico' ? 'active' : ''}`} onClick={() => setTab('fisico')}>
                    Examen físico
                  </button>
              <button className={`tab-btn ${tab === 'evolucion' ? 'active' : ''}`} onClick={() => setTab('evolucion')}>
                Evolución médica ({evoluciones.length})
              </button>
                  <button className={`tab-btn ${tab === 'informes' ? 'active' : ''}`} onClick={() => setTab('informes')}>
                    Informes médicos ({informes.length})
                  </button>
              <button className={`tab-btn ${tab === 'diagnostico' ? 'active' : ''}`} onClick={() => setTab('diagnostico')}>
                Diagnóstico y Tratamiento
              </button>
            </>
          )}
        </div>

        <div className="panel-body">
          {tab === 'general' && (
            <div>
              <div className="form-grid">
                <div className="field">
                  <label>Historia</label>
                  <input type="text" value={paciente.historia} disabled />
                </div>
                <div className="field">
                  <label>Nombres y Apellidos</label>
                  <input
                    type="text"
                    value={paciente.nombres}
                    onChange={(e) => setPaciente({ ...paciente, nombres: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Cédula</label>
                  <input
                    type="text"
                    value={paciente.cedula || ''}
                    onChange={(e) => setPaciente({ ...paciente, cedula: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Teléfono</label>
                  <input
                    type="tel"
                    value={paciente.telefono_principal || ''}
                    onChange={(e) => setPaciente({ ...paciente, telefono_principal: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Teléfono Secundario</label>
                  <input
                    type="tel"
                    value={paciente.telefono_secundario || ''}
                    onChange={(e) => setPaciente({ ...paciente, telefono_secundario: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Correo</label>
                  <input
                    type="email"
                    value={paciente.correo || ''}
                    onChange={(e) => setPaciente({ ...paciente, correo: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Ocupación</label>
                  <input
                    type="text"
                    value={paciente.ocupacion || ''}
                    onChange={(e) => setPaciente({ ...paciente, ocupacion: e.target.value })}
                  />
                </div>
                <div className="field span-2">
                  <label>Dirección</label>
                  <input
                    type="text"
                    value={paciente.direccion || ''}
                    onChange={(e) => setPaciente({ ...paciente, direccion: e.target.value })}
                  />
                </div>
              </div>
              <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={handleSaveGeneral}>
                Guardar cambios
              </button>
            </div>
          )}

          {tab === 'funcional' && (
            <div>
              <div className="section-note">
                Registra la anamnesis y los antecedentes clínicos del paciente.
              </div>
              <div className="form-grid">
                {EXAMEN_FUNCIONAL_FIELDS.map(([field, label]) => (
                  <div className="field span-2" key={field}>
                    <label>{label}</label>
                    <textarea
                      rows={3}
                      value={paciente.examen_funcional?.[field] || ''}
                      onChange={(e) => updateExamenField('funcional', field, e.target.value)}
                    />
                  </div>
                ))}
              </div>
              <button className="btn btn-primary" style={{ marginTop: '4px' }} onClick={() => handleSaveExamen('funcional')}>
                Guardar examen funcional
              </button>
            </div>
          )}

          {tab === 'fisico' && (
            <div>
              <div className="section-note">
                Registra los hallazgos del examen físico y los resultados complementarios.
              </div>
              <div className="form-grid">
                {EXAMEN_FISICO_FIELDS.map(([field, label]) => (
                  <div className="field" key={field}>
                    <label>{label}</label>
                    <textarea
                      rows={3}
                      value={paciente.examen_fisico?.[field] || ''}
                      onChange={(e) => updateExamenField('fisico', field, e.target.value)}
                    />
                  </div>
                ))}
              </div>
              <button className="btn btn-primary" style={{ marginTop: '4px' }} onClick={() => handleSaveExamen('fisico')}>
                Guardar examen físico
              </button>
            </div>
          )}

          {tab === 'evolucion' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3>Historial de Consultas</h3>
                <button className="btn btn-primary" onClick={() => setIsEvModalOpen(true)}>
                  <Plus size={16} /> Nueva Evolución
                </button>
              </div>
              <div className="timeline">
                {evoluciones.map(ev => (
                  <div key={ev.id} className="timeline-item">
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <b>{formatDate(ev.fecha)} - {ev.hora}</b>
                      <span>{ev.motivo}</span>
                    </div>
                    {ev.signos_vitales && (
                      <div className="vital-grid">
                        <div className="vital-box"><div className="val">{ev.signos_vitales.pa || '—'}</div><div className="lbl">PA</div></div>
                        <div className="vital-box"><div className="val">{ev.signos_vitales.fc || '—'}</div><div className="lbl">FC</div></div>
                        <div className="vital-box"><div className="val">{ev.signos_vitales.temp ? `${ev.signos_vitales.temp}°C` : '—'}</div><div className="lbl">Temp</div></div>
                        <div className="vital-box"><div className="val">{ev.signos_vitales.peso ? `${ev.signos_vitales.peso}kg` : '—'}</div><div className="lbl">Peso</div></div>
                      </div>
                    )}
                    <p style={{ marginTop: '10px' }}><b>Diagnóstico:</b> {ev.diagnostico || '—'}</p>
                    <p><b>Plan:</b> {ev.plan || '—'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'informes' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px' }}>
                <div>
                  <h3>Histórico de informes médicos</h3>
                  <p style={{ color: 'var(--ink-soft)', fontSize: '13px', marginTop: '4px' }}>
                    Cada informe queda asociado al paciente y puede imprimirse con el membrete institucional.
                  </p>
                </div>
                <button className="btn btn-primary" onClick={() => setIsInformeModalOpen(true)}>
                  <Plus size={16} /> Nuevo informe
                </button>
              </div>
              <div className="timeline">
                {informes.map((informe) => (
                  <div key={informe.id} className="timeline-item">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
                      <b>{formatDate(informe.fecha_emision)}</b>
                      <span>{informe.paciente_cedula || 'Sin cédula'}</span>
                    </div>
                    <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{informe.informe}</p>
                    <button className="btn btn-accent btn-sm" style={{ marginTop: '14px' }} onClick={() => printInforme(informe)}>
                      <Printer size={14} /> Imprimir informe
                    </button>
                  </div>
                ))}
                {!informes.length && (
                  <div className="section-note">Este paciente todavía no tiene informes médicos.</div>
                )}
              </div>
            </div>
          )}

          {tab === 'diagnostico' && (
            <div>
              <div className="section-note" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span>Cargar plantilla:</span>
                <select value="" onChange={(e) => {
                  const tmpl = plantillas.find(item => item.id === e.target.value);
                  if (tmpl) {
                    setPaciente({
                      ...paciente,
                      planteamiento: { ...paciente.planteamiento, plan: tmpl.plan || '', tratamiento: tmpl.tratamiento || '' }
                    });
                  }
                }}>
                  <option value="">-- Seleccione --</option>
                  {plantillas.map((t) => (
                    <option key={t.id} value={t.id}>{t.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="section-note" style={{ display: 'grid', gap: '10px', marginTop: '16px' }}>
                <label style={{ fontWeight: 600 }}>Guardar plantilla actual</label>
                <input
                  type="text"
                  placeholder="Nombre de la plantilla"
                  value={templateNombre}
                  onChange={(e) => setTemplateNombre(e.target.value)}
                />
                <button className="btn btn-primary" style={{ width: 'fit-content' }} onClick={handleSaveTemplate}>
                  Guardar plantilla
                </button>
              </div>

              <div className="form-grid" style={{ marginTop: '16px' }}>
                <div className="field span-2">
                  <label>Plan / Indicaciones</label>
                  <textarea
                    rows={4}
                    value={paciente.planteamiento?.plan || ''}
                    onChange={(e) => setPaciente({
                      ...paciente,
                      planteamiento: { ...paciente.planteamiento, plan: e.target.value }
                    })}
                  />
                </div>
                <div className="field span-2">
                  <label>Tratamiento Prescrito (Récipe)</label>
                  <textarea
                    rows={4}
                    value={paciente.planteamiento?.tratamiento || ''}
                    onChange={(e) => setPaciente({
                      ...paciente,
                      planteamiento: { ...paciente.planteamiento, tratamiento: e.target.value }
                    })}
                  />
                </div>
                <div className="field">
                  <label>Fecha de próxima cita</label>
                  <input
                    type="date"
                    value={paciente.planteamiento?.proxima_cita || ''}
                    onChange={(e) => setPaciente({
                      ...paciente,
                      planteamiento: { ...paciente.planteamiento, proxima_cita: e.target.value }
                    })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button className="btn btn-primary" onClick={handleSavePlanteamiento}>Guardar Diagnóstico</button>
                <button className="btn btn-accent" onClick={printRecipe}><Printer size={16} /> Imprimir Récipe</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={isEvModalOpen}
        onClose={() => setIsEvModalOpen(false)}
        title="Registrar Consulta de Evolución"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setIsEvModalOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSaveEvolucion}>Guardar Evolución</button>
          </>
        }
      >
        <div className="form-grid">
          <div className="field">
            <label>Fecha</label>
            <input type="date" value={evForm.fecha} onChange={(e) => setEvForm({ ...evForm, fecha: e.target.value })} />
          </div>
          <div className="field">
            <label>Hora</label>
            <input type="time" value={evForm.hora} onChange={(e) => setEvForm({ ...evForm, hora: e.target.value })} />
          </div>
          <div className="field span-2">
            <label>Motivo de consulta</label>
            <input type="text" value={evForm.motivo} onChange={(e) => setEvForm({ ...evForm, motivo: e.target.value })} />
          </div>
          <div className="field">
            <label>PA (ej. 120/80)</label>
            <input type="text" value={evForm.pa} onChange={(e) => setEvForm({ ...evForm, pa: e.target.value })} />
          </div>
          <div className="field">
            <label>FC (lpm)</label>
            <input type="text" value={evForm.fc} onChange={(e) => setEvForm({ ...evForm, fc: e.target.value })} />
          </div>
          <div className="field">
            <label>Peso (kg)</label>
            <input type="number" value={evForm.peso} onChange={(e) => setEvForm({ ...evForm, peso: e.target.value })} />
          </div>
          <div className="field">
            <label>Talla (cm)</label>
            <input type="number" value={evForm.talla} onChange={(e) => setEvForm({ ...evForm, talla: e.target.value })} />
          </div>
          <div className="field span-2">
            <label>Diagnóstico</label>
            <textarea value={evForm.diagnostico} onChange={(e) => setEvForm({ ...evForm, diagnostico: e.target.value })} />
          </div>
          <div className="field span-2">
            <label>Plan</label>
            <textarea value={evForm.plan} onChange={(e) => setEvForm({ ...evForm, plan: e.target.value })} />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isInformeModalOpen}
        onClose={() => setIsInformeModalOpen(false)}
        title="Nuevo informe médico"
        footer={(
          <>
            <button className="btn btn-ghost" onClick={() => setIsInformeModalOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSaveInforme}>Guardar informe</button>
          </>
        )}
      >
        <div className="section-note">
          Paciente: <b>{paciente.nombres}</b> | Cédula: <b>{paciente.cedula || '—'}</b>
        </div>
        <div className="form-grid">
          <div className="field">
            <label>Fecha de emisión</label>
            <input
              type="date"
              value={informeForm.fecha_emision}
              onChange={(e) => setInformeForm({ ...informeForm, fecha_emision: e.target.value })}
            />
          </div>
          <div className="field span-2">
            <label>Informe *</label>
            <textarea
              rows={14}
              value={informeForm.informe}
              onChange={(e) => setInformeForm({ ...informeForm, informe: e.target.value })}
              placeholder="Escribe aquí el contenido del informe médico..."
            />
          </div>
        </div>
      </Modal>
    </>
  );
}