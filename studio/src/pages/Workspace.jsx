import React, { useState } from 'react';
import Icon from '../components/Icon';

const steps = [
  ['Measure', 'Enter the clear window opening and sash dimensions.'],
  ['Design', 'Click modules to choose fans, solid panels, rails, and insulation.'],
  ['Review', 'Inspect the full build and the quantity for each component.'],
  ['Export', 'Download printable STLs and a build list from the designer.'],
];

export default function Workspace({ design }) {
  const [noticeVisible, setNoticeVisible] = useState(true);
  const [guideVisible, setGuideVisible] = useState(true);
  return (
    <main className="workspace">
      <div className="workspace-bar">
        <div>
          <a href="#/" className="back-link">
            ← All designs
          </a>
          <h1>{design.name}</h1>
          <p>{design.description}</p>
        </div>
        <div className="workspace-status">
          <span className="live-dot" /> GENERATOR READY
        </div>
      </div>
      {noticeVisible && (
        <div className="notice">
          <Icon name="info" />
          <div>
            <strong>Your printable kit updates with your measurements.</strong>
            <span>
              {' '}
              Use Design mode to click parts. Open Full settings for every dimension and the print
              list.
            </span>
          </div>
          <button
            className="icon-button"
            onClick={() => setNoticeVisible(false)}
            aria-label="Dismiss tip"
          >
            <Icon name="close" />
          </button>
        </div>
      )}
      <div className="workspace-body">
        <section className="designer-frame" aria-label={`${design.name} designer`}>
          <iframe title={`${design.name} interactive designer`} src={design.route} />
        </section>
        <aside className="workspace-guide">
          <div className="guide-head">
            <span className="kicker">PROJECT GUIDE</span>
            <button
              className="icon-button"
              onClick={() => setGuideVisible(!guideVisible)}
              aria-label={guideVisible ? 'Collapse guide' : 'Expand guide'}
            >
              {guideVisible ? '−' : '+'}
            </button>
          </div>
          {guideVisible && (
            <>
              <h2>From opening to print kit</h2>
              <ol>
                {steps.map(([name, description]) => (
                  <li key={name}>
                    <b>{name}</b>
                    <span>{description}</span>
                  </li>
                ))}
              </ol>
              <div className="guide-output">
                <span>INCLUDED OUTPUTS</span>
                {design.outputs.map((output) => (
                  <div key={output}>
                    <Icon name="check" />
                    {output}
                  </div>
                ))}
              </div>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}
