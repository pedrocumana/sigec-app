import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/login';
import Dashboard from './pages/Dashboard';
import Pacientes from './pages/pacientes';
import PacienteDetalle from './pages/PacienteDetalle';
import Agenda from './pages/Agenda';
import Pagos from './pages/Pagos';
import Configuracion from './pages/Configuracion';
import Sidebar from './components/sidebar';

function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontWeight: 600, color: '#1B4B43' }}>Cargando...</div>;
  }

  return user ? <Navigate to="/" replace /> : children;
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontWeight: 600, color: '#1B4B43' }}>Cargando...</div>;
  }

  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route
            path="/*"
            element={
              <PrivateRoute>
                <div id="app-shell">
                  <Sidebar />
                  <div id="main-wrap">
                    <div id="main-content">
                      <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/pacientes" element={<Pacientes />} />
                        <Route path="/pacientes/:id" element={<PacienteDetalle />} />
                        <Route path="/agenda" element={<Agenda />} />
                        <Route path="/pagos" element={<Pagos />} />
                        <Route path="/configuracion" element={<Configuracion />} />
                      </Routes>
                    </div>
                  </div>
                </div>
              </PrivateRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}