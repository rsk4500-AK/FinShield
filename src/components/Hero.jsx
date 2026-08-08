export default function Hero() {
  return (
    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow">Unified underwriting engine</p>
        <h1>Protect customers before risk turns into default.</h1>
        <p className="hero-text">
          FinShield combines loan underwriting, insurance intelligence, fraud detection,
          and financial resilience scoring into one AI decision platform.
        </p>
        <div className="hero-actions">
          <a className="btn btn-primary" href="#contact">Book a demo</a>
          <a className="btn btn-secondary" href="#workflow">See the workflow</a>
        </div>
        <ul className="hero-points">
          <li>OCR + LLM document extraction</li>
          <li>Cross-impact risk forecasting</li>
          <li>Explainable recommendations</li>
        </ul>
      </div>

      <div className="hero-card" aria-label="FinShield decision dashboard preview">
        <div className="card-top">
          <span className="pill success">Approve</span>
          <span className="pill neutral">Risk 3-900</span>
        </div>
        <h3>Customer decision snapshot</h3>
        <div className="metric-row">
          <div>
            <strong>Income stability</strong>
            <p>High</p>
          </div>
          <div>
            <strong>Insurance adequacy</strong>
            <p>Needs upgrade</p>
          </div>
        </div>
        <div className="metric-row">
          <div>
            <strong>Fraud signal</strong>
            <p>Low</p>
          </div>
          <div>
            <strong>Default probability</strong>
            <p>Low</p>
          </div>
        </div>
        <div className="recommendation">
          <h4>Recommended action</h4>
          <p>Approve with a lower sanctioned amount and request stronger medical coverage.</p>
        </div>
      </div>
    </section>
  );
}
