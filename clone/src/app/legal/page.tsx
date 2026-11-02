import Link from 'next/link';
import { PlainPage } from '@/components/Shell';

export default function Legal() {
  return <PlainPage title="About and disclosures" back="/settings">
    <section className="card"><h2 className="h2">What this app is</h2><p style={{ margin: 0 }}>A private practice tool for learning how automated investing works. All money is simulated. All investments are fictional and their prices are generated for practice.</p></section>
    <section className="card"><h2 className="h2">What it is not</h2><p style={{ margin: 0 }}>It does not hold money, place real trades, link bank accounts or give investment, tax or legal advice. The sample portfolios and Allie's answers are educational examples only.</p></section>
    <section className="card"><h2 className="h2">Estimates</h2><p style={{ margin: 0 }}>Projections use a growth rate you choose and are hypothetical. Simulated history shows how a mix could behave and does not predict anything.</p></section>
    <section className="card"><h2 className="h2">Your data</h2><p style={{ margin: 0 }}>Everything is stored on this device. You can erase it any time from Settings.</p></section>
    <Link className="btn btn-secondary" href="/settings">Back to Settings</Link>
  </PlainPage>;
}
