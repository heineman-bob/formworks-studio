import React, { useEffect, useState } from 'react';
import { getDesign } from './designs';
import Icon from './components/Icon';
import Welcome from './components/Welcome';
import Catalog from './pages/Catalog';
import Workspace from './pages/Workspace';

function routeDesignId() {
  return location.hash.startsWith('#/design/') ? location.hash.split('/')[2] : null;
}

export default function App() {
  const [designId, setDesignId] = useState(routeDesignId);
  const [showTour, setShowTour] = useState(!localStorage.getItem('formworks-studio-intro-v1'));
  const design = getDesign(designId);
  useEffect(() => {
    const sync = () => setDesignId(routeDesignId());
    addEventListener('hashchange', sync);
    return () => removeEventListener('hashchange', sync);
  }, []);
  return (
    <>
      <div className="app-shell">
        <header className="site-header">
          <a className="brand" href="#/" aria-label="Formworks Studio home">
            <span className="brand-icon">
              F<span>·</span>
            </span>
            <span>
              FORMWORKS <b>STUDIO</b>
            </span>
          </a>
          <nav>
            <a href="#/" className={!design ? 'active' : ''}>
              Designs
            </a>
            {design && <span className="crumb">/ &nbsp; {design.name}</span>}
          </nav>
          <button className="help-button" onClick={() => setShowTour(true)}>
            <Icon name="info" /> How it works
          </button>
        </header>
        {design ? <Workspace design={design} /> : <Catalog />}
        <footer>
          FORMWORKS STUDIO <span>Measure precisely. Print confidently.</span>
        </footer>
      </div>
      {showTour && <Welcome onClose={() => setShowTour(false)} />}
    </>
  );
}
