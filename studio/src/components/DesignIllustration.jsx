import React from 'react';
export default function DesignIllustration({ compact = false }) {
  return (
    <div className={`design-art ${compact ? 'compact' : ''}`} aria-hidden="true">
      <div className="window-shape">
        <div className="window-glass" />
        <div className="fan-array">
          {Array.from({ length: 6 }, (_, i) => (
            <div className="fan-tile" key={i}>
              <span className="fan-ring">
                <i />
                <i />
                <i />
              </span>
            </div>
          ))}
        </div>
        <div className="window-sill" />
      </div>
      <span className="art-note top">SASH FIT</span>
      <span className="art-note bottom">MODULAR · INSULATED</span>
    </div>
  );
}
