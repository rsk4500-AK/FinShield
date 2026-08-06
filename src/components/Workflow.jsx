export default function Workflow() {
  return (
    <section id="workflow" className="workflow-section">
      <div className="section-heading">
        <p className="eyebrow">How it works</p>
        <h2>A complete AI workflow from document intake to human decision support.</h2>
      </div>
      <div className="workflow-grid">
        <article className="workflow-card">
          <h3>01. Intelligent extraction</h3>
          <p>OCR and LLMs extract income, expenses, EMIs, coverage terms, policy exclusions, and claim context.</p>
        </article>
        <article className="workflow-card">
          <h3>02. Unified risk analysis</h3>
          <p>The engine evaluates whether the person can stay financially stable through major life events.</p>
        </article>
        <article className="workflow-card">
          <h3>03. Claim intelligence</h3>
          <p>Each claim is checked for policy fit, waiting periods, missing documents, fraud patterns, and prior claims.</p>
        </article>
        <article className="workflow-card">
          <h3>04. Cross-impact engine</h3>
          <p>If a claim is denied, the platform predicts the likely effect on loan repayment and default risk.</p>
        </article>
      </div>
    </section>
  );
}
