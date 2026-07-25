import React from 'react';

const RULES = [
  ['🏫', 'Meet in safe public areas on campus', 'Exchange items at well-lit, busy spots — the mess, library entrance, or hostel common areas.'],
  ['🔍', 'Inspect the item before completing the deal', 'Check condition, functionality and accessories thoroughly before agreeing.'],
  ['🔐', 'Exchange OTP only after physical handover', 'Your handover OTP is your proof. Share it only when the item is physically in front of you and you are satisfied.'],
  ['🙅', 'Never share account passwords', 'SoMart staff will never ask for your password. No one else should either.'],
  ['🚫', 'Never share login OTPs', 'Email verification and login codes are for you alone — transaction OTPs are the only codes you exchange, and only in person.'],
  ['✅', 'Verify the item condition before confirming', 'For rentals, agree on the condition at handover AND at return to avoid disputes.'],
  ['💵', 'The platform does not process or guarantee payments', 'All payments happen directly between students, in person. SoMart never asks for money and is not responsible for payment disputes.'],
];

export default function Safety() {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-extrabold text-center">Safety Guidelines</h1>
      <p className="text-center text-slate-500 mt-2">A few simple rules keep campus trading safe for everyone.</p>
      <div className="mt-8 space-y-4">
        {RULES.map(([icon, title, body]) => (
          <div key={title} className="card p-5 flex gap-4">
            <span className="text-3xl">{icon}</span>
            <div><h2 className="font-bold">{title}</h2><p className="text-sm text-slate-600 mt-0.5">{body}</p></div>
          </div>
        ))}
      </div>
      <div className="card p-5 mt-6 bg-amber-50 border-amber-200">
        <p className="text-sm text-amber-900"><b>Disclaimer:</b> SoMart only facilitates connections between students. All payments and settlements are handled directly between users. The platform does not process or guarantee payments and is not responsible for payment-related disputes.</p>
      </div>
    </div>
  );
}
