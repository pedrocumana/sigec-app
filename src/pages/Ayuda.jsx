import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LifeBuoy } from 'lucide-react';

export default function Ayuda() {
  const navigate = useNavigate();

  return (
    <section className="help-page" aria-labelledby="help-title">
      <header className="help-page-header">
        <div className="help-page-heading">
          <LifeBuoy size={24} aria-hidden="true" />
          <div>
            <h1 id="help-title">Manual de Usuario SIGEC</h1>
            <p>Guía paso a paso para utilizar el sistema.</p>
          </div>
        </div>
        <button className="btn btn-ghost" type="button" onClick={() => navigate('/', { replace: true })}>
          <ArrowLeft size={16} />
          Volver al Panel
        </button>
      </header>
      <iframe
        className="help-manual-frame"
        src="/Manual_de_Usuario_SIGEC.html"
        title="Manual de Usuario SIGEC"
      />
    </section>
  );
}
