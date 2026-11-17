import React from 'react';
import { designs } from '../designs';
import Icon from '../components/Icon';
import DesignIllustration from '../components/DesignIllustration';

function DesignCard({ design }) {
  return (
    <article className="design-card">
      <DesignIllustration compact />
      <div className="card-body">
        <div className="card-meta">
          <span>{design.category}</span>
          <span className="ready">
            <i /> {design.status}
          </span>
        </div>
        <h3>{design.name}</h3>
        <p>{design.description}</p>
        <div className="capabilities">
          {design.capabilities.map((capability) => (
            <span key={capability}>{capability}</span>
          ))}
        </div>
        <a className="card-link" href={`#/design/${design.id}`}>
          Open designer <Icon name="arrow" />
        </a>
      </div>
    </article>
  );
}

export default function Catalog() {
  return (
    <main className="catalog">
      <section className="hero">
        <div className="hero-copy">
          <span className="kicker">PARAMETRIC DESIGN PLATFORM</span>
          <h1>
            Make a design
            <br />
            <em>fit your world.</em>
          </h1>
          <p>
            Explore printable designs, adjust them to your space, preview every piece, and download
            a complete kit made for your measurements.
          </p>
          <a className="primary-button" href="#designs">
            Explore designs <Icon name="arrow" />
          </a>
          <div className="hero-facts">
            <span>
              <b>01</b> Measure
            </span>
            <span>
              <b>02</b> Customize
            </span>
            <span>
              <b>03</b> Print
            </span>
          </div>
        </div>
        <DesignIllustration />
      </section>
      <section id="designs" className="catalog-section">
        <div className="section-heading">
          <div>
            <span className="kicker">THE DESIGN LIBRARY</span>
            <h2>Choose your project</h2>
            <p>
              Every available design includes a live preview, fit controls, and a part-by-part print
              plan.
            </p>
          </div>
          <span className="count-pill">
            {designs.length} {designs.length === 1 ? 'DESIGN' : 'DESIGNS'} AVAILABLE
          </span>
        </div>
        <div className="design-grid">
          {designs.map((design) => (
            <DesignCard key={design.id} design={design} />
          ))}
        </div>
      </section>
    </main>
  );
}
