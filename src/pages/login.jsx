import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LogoMark from '../components/LogoMark';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data, error } = await login(email, password);

    if (error) {
      setError(error.message || 'Error al iniciar sesión');
      setLoading(false);
      return;
    }

    if (data?.user) {
      navigate('/', { replace: true });
    }

    setLoading(false);
  };

  return (
    <div id="login-screen">
      <div className="login-brand">
        <div className="brand-mark login-brand-mark">
          <LogoMark />
        </div>
        <div className="login-quote">
          <h1>La historia clínica, el consultorio y la agenda, en un mismo lugar.</h1>
          <p>SIGEC Cloud: Control de historias, diagnósticos, evolución y caja bimoneda.</p>
        </div>
        <div className="login-foot">© 2026 Clínica San Pedro</div>
      </div>
      <div className="login-form-wrap">
        <div className="login-card">
          <h2>Iniciar sesión</h2>
          <p className="lede">Ingresa tus credenciales autorizadas.</p>
          {error && <div className="login-error" style={{ display: 'block' }}>{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Correo Electrónico</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="medico@sanpedro.com"
              />
            </div>
            <div className="field">
              <label>Contraseña</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }} disabled={loading}>
              {loading ? 'Accediendo...' : 'Entrar al sistema'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}