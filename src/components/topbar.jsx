import React from 'react';
import { formatDate } from '../lib/dateUtils';

export default function Topbar({ title, actions }) {
  const today = formatDate(new Date().toISOString());

  return (
    <div id="topbar">
      <div>
        <h1>{title}</h1>
        <div style={{ fontSize: '12.5px', color: 'var(--ink-soft)', textTransform: 'capitalize', marginTop: '2px' }}>
          {today}
        </div>
      </div>
      <div>{actions}</div>
    </div>
  );
}