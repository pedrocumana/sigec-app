import React from 'react';
import logoUrl from '../../logo_clinicasp26.jpg';

export default function LogoMark({ compact = false, className = '' }) {
  return (
    <div className={`brand-logo ${compact ? 'compact' : ''} ${className}`.trim()}>
      <img src={logoUrl} alt="Clínica San Pedro" />
      {!compact && <div className="brand-copy"> <span className="brand-name">Clínica San Pedro</span> </div>}
    </div>
  );
}
