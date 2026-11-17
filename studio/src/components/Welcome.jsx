import React, { useState } from 'react';
import Icon from './Icon';
const STORAGE = 'formworks-studio-intro-v1';
const tour = [
  {
    title: 'Choose a design',
    text: 'Start with a real printable design. The catalog will grow as more generators are added.',
  },
  {
    title: 'Make it yours',
    text: 'Preview the full build, click components, and enter the measurements that matter.',
  },
  {
    title: 'Print with a plan',
    text: 'Review individual pieces and quantities, then download a ZIP with STLs and build details.',
  },
];
export default function Welcome({ onClose }) {
  const [step, setStep] = useState(0);
  const done = () => {
    localStorage.setItem(STORAGE, 'seen');
    onClose();
  };
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="welcome" role="dialog" aria-modal="true" aria-labelledby="welcomeTitle">
        <button className="icon-button modal-close" onClick={done} aria-label="Skip walkthrough">
          <Icon name="close" />
        </button>
        <span className="kicker">WELCOME TO FORMWORKS</span>
        <div className="welcome-symbol">
          <Icon name={step === 2 ? 'download' : step === 1 ? 'cube' : 'grid'} />
        </div>
        <h2 id="welcomeTitle">{tour[step].title}</h2>
        <p>{tour[step].text}</p>
        <div className="tour-dots">
          {tour.map((_, i) => (
            <span key={i} className={i === step ? 'active' : ''} />
          ))}
        </div>
        <div className="welcome-actions">
          <button className="quiet-button" onClick={done}>
            Skip tour
          </button>
          <button
            className="primary-button"
            onClick={() => (step === tour.length - 1 ? done() : setStep(step + 1))}
          >
            {step === tour.length - 1 ? 'Start designing' : 'Next'} <Icon name="arrow" />
          </button>
        </div>
      </div>
    </div>
  );
}
