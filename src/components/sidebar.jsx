import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Calendar, Receipt, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import LogoMark from './LogoMark';

export default function Sidebar() {
  const { profile, logout, isMedico, roleLabel } = useAuth();
  const navigate = useNavigate();

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  };

  return (
    <aside id="sidebar">
      <div className="brand-mark">
        <LogoMark compact />
        <div>
          <div className="name">Clínica San Pedro</div>
          <div style={{ fontSize: '9px', letterSpacing: '2px', color: 'rgba(243,239,228,.6)' }}>GESTIÓN CLÍNICA</div>
        </div>
      </div>

      <nav className="nav-list">
        <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
          <LayoutDashboard size={18} />
          <span>Panel</span>
        </NavLink>
        <NavLink to="/pacientes" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Users size={18} />
          <span>Pacientes</span>
        </NavLink>
        <NavLink to="/agenda" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Calendar size={18} />
          <span>Agenda</span>
        </NavLink>
        <NavLink to="/pagos" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Receipt size={18} />
          <span>Pagos y caja</span>
        </NavLink>
        {isMedico && (
          <NavLink to="/configuracion" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Settings size={18} />
            <span>Configuración</span>
          </NavLink>
        )}
      </nav>

      <div className="sidebar-foot">
        <div className="user-chip">
          <div className="user-avatar">{getInitials(profile?.nombre)}</div>
          <div>
            <div className="n">{profile?.nombre || 'Usuario'}</div>
            <div className="r">{roleLabel}</div>
          </div>
        </div>
        <button
          className="logout-btn"
          onClick={async () => {
            await logout();
            navigate('/login', { replace: true });
          }}
        >
          <LogOut size={16} />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}