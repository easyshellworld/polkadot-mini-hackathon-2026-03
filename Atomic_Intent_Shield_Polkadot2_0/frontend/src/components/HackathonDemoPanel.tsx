import React, { useEffect, useState } from 'react';

const FLOW_STEPS = [
  '1) Connect Polkadot wallet and prepare sender account.',
  '2) Enter recipient SS58 address and transfer amount in PAS.',
  '3) Submit transaction and wait until finalized.',
  '4) Show tx hash and sender/receiver balance updates as proof.',
];

const CHECKLIST = [
  'Polkadot wallet extension installed (SubWallet / Polkadot.js / Talisman).',
  'RPC status is connected in header.',
  'Sender wallet has enough PAS for transfer + fee.',
  'Recipient address format is valid SS58.',
  'Demo backup: keep one pre-funded account ready.',
];

const PITCH_POINTS = [
  'Intent-first UX: users express outcomes, not routing complexity.',
  'Private order flow path is compatible with client-side ZK proofs.',
  'Atomic settlement architecture is extensible from same-chain to cross-chain.',
];

const PITCH_SECONDS = 5 * 60;

const HackathonDemoPanel: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [checked, setChecked] = useState<boolean[]>(() => CHECKLIST.map(() => false));
  const [isRunning, setIsRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(PITCH_SECONDS);

  useEffect(() => {
    if (!isRunning) return;
    if (secondsLeft <= 0) {
      setIsRunning(false);
      return;
    }
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isRunning, secondsLeft]);

  const completedCount = checked.filter(Boolean).length;
  const progress = Math.round((completedCount / CHECKLIST.length) * 100);

  const nextStep = () => {
    setActiveStep((prev) => (prev < FLOW_STEPS.length - 1 ? prev + 1 : prev));
  };

  const resetFlow = () => {
    setActiveStep(0);
    setChecked(CHECKLIST.map(() => false));
    setIsRunning(false);
    setSecondsLeft(PITCH_SECONDS);
  };

  const toggleCheck = (index: number) => {
    setChecked((prev) => prev.map((value, i) => (i === index ? !value : value)));
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <section className="bg-gray-800 rounded-2xl p-6 shadow-xl border border-gray-700">
      <h2 className="text-xl font-bold mb-3">Hackathon Demo Console</h2>
      <p className="text-sm text-gray-400 mb-5">
        This panel gives your team a stable live-demo script while the broader intent layer keeps evolving.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="bg-gray-900/60 border border-gray-700 rounded-lg p-3">
          <div className="text-xs text-gray-400">Flow Step</div>
          <div className="text-lg font-semibold text-pink-400">{activeStep + 1} / {FLOW_STEPS.length}</div>
        </div>
        <div className="bg-gray-900/60 border border-gray-700 rounded-lg p-3">
          <div className="text-xs text-gray-400">Checklist Progress</div>
          <div className="text-lg font-semibold text-yellow-400">{completedCount} / {CHECKLIST.length} ({progress}%)</div>
        </div>
        <div className="bg-gray-900/60 border border-gray-700 rounded-lg p-3">
          <div className="text-xs text-gray-400">Pitch Timer</div>
          <div className="text-lg font-semibold text-cyan-400">{mm}:{ss}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={nextStep}
          className="px-3 py-2 bg-pink-600 hover:bg-pink-500 rounded-lg text-sm font-semibold"
        >
          Next Step
        </button>
        <button
          type="button"
          onClick={() => setIsRunning((prev) => !prev)}
          className="px-3 py-2 bg-cyan-700 hover:bg-cyan-600 rounded-lg text-sm font-semibold"
        >
          {isRunning ? 'Pause Timer' : 'Start Timer'}
        </button>
        <button
          type="button"
          onClick={resetFlow}
          className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-semibold"
        >
          Reset Demo
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-pink-400 mb-2">Live Demo Flow</h3>
          <ul className="space-y-2 text-sm text-gray-200 list-disc pl-5">
            {FLOW_STEPS.map((item, index) => (
              <li
                key={item}
                className={index === activeStep ? 'text-white font-semibold' : 'text-gray-300'}
              >
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-yellow-400 mb-2">Pre-Demo Checklist</h3>
          <ul className="space-y-2 text-sm text-gray-200">
            {CHECKLIST.map((item, index) => (
              <li key={item}>
                <label className="inline-flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked[index]}
                    onChange={() => toggleCheck(index)}
                    className="mt-0.5"
                  />
                  <span className={checked[index] ? 'line-through text-gray-400' : 'text-gray-200'}>{item}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-cyan-400 mb-2">Judge Pitch Anchors</h3>
          <ul className="space-y-2 text-sm text-gray-200 list-disc pl-5">
            {PITCH_POINTS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

export default HackathonDemoPanel;