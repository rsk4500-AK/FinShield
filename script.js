document.getElementById('year').textContent = new Date().getFullYear();

const API_BASE_URL = 'http://localhost:3100/api/eligibility';
const HERO_METRICS_ENDPOINT = 'http://localhost:3100/api/eligibility/latest';

function renderHeroMetrics(metrics = {}) {
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = value;
    }
  };

  const decisionLabel = metrics.decisionLabel || 'Pending';
  setText('hero-decision-label', decisionLabel);
  setText('hero-risk-score', metrics.riskScore || 'Risk N/A');
  setText('income-stability', metrics.incomeStability || 'Pending');
  setText('insurance-adequacy', metrics.insuranceAdequacy || 'Pending');
  setText('fraud-signal', metrics.fraudSignal || 'Pending');
  setText('default-probability', metrics.defaultProbability || 'Pending');
  setText('hero-recommendation-text', metrics.recommendation || 'Complete eligibility check to update decision metrics.');

  updateHeroDecisionState(decisionLabel.toLowerCase() === 'approve' ? 'approve' : decisionLabel.toLowerCase() === 'denied' ? 'deny' : 'pending');
}

function updateHeroDecisionState(state) {
  const pill = document.getElementById('hero-decision-label');
  if (!pill) return;

  pill.textContent = state === 'approve' ? 'Approve' : 'Denied';
  pill.classList.remove('success', 'neutral', 'deny');
  pill.classList.add(state === 'approve' ? 'success' : 'deny');
}

function getMaxDobFor18Plus() {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 18);
  return date.toISOString().slice(0, 10);
}

function isAdult(dateString) {
  const dob = new Date(dateString);
  if (!dateString || Number.isNaN(dob.getTime())) {
    return false;
  }

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }

  return age >= 18;
}

function setEligibilityDobMax() {
  const dobInput = document.getElementById('dob');
  if (dobInput) {
    dobInput.max = getMaxDobFor18Plus();
  }
}

function initDecisionButtons() {
  const approveButton = document.getElementById('decision-approve-button');
  const denyButton = document.getElementById('decision-deny-button');

  if (approveButton) {
    approveButton.addEventListener('click', () => updateHeroDecisionState('approve'));
  }

  if (denyButton) {
    denyButton.addEventListener('click', () => updateHeroDecisionState('deny'));
  }
}

function mapEligibilityResponseToHeroMetrics(data = {}) {
  let assessment = data.assessment || {};
  if (typeof assessment === 'string') {
    try {
      assessment = JSON.parse(assessment);
    } catch {
      const start = assessment.indexOf('{');
      const end = assessment.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        try {
          assessment = JSON.parse(assessment.substring(start, end + 1));
        } catch {
          assessment = {};
        }
      } else {
        assessment = {};
      }
    }
  }

  const riskLevel = String((assessment && assessment.riskLevel) || 'Unknown');
  const normalizedRiskLevel = riskLevel.trim().toLowerCase();
  const rawScore = assessment.score;
  const scoreText = Number.isFinite(rawScore) ? `Risk ${rawScore}` : rawScore ? `Risk ${rawScore}` : 'Risk 3-900';
  const salaryRatio = typeof data.salaryRatio === 'number' ? data.salaryRatio : null;
  const annualIncome = data.annualIncome != null ? data.annualIncome : null;
  const ruleBasedEligible = data.ruleBasedEligible === true;

  const incomeStability = normalizedRiskLevel === 'low'
    ? 'Stable'
    : normalizedRiskLevel === 'high'
      ? 'Unstable'
      : normalizedRiskLevel === 'medium'
        ? 'Moderate'
        : 'Pending';
  const insuranceAdequacy = normalizedRiskLevel === 'low'
    ? 'Adequate'
    : normalizedRiskLevel === 'high'
      ? 'Needs upgrade'
      : normalizedRiskLevel === 'medium'
        ? 'Needs review'
        : 'Pending';
  const fraudSignal = normalizedRiskLevel === 'low'
    ? 'Low'
    : normalizedRiskLevel === 'high'
      ? 'Elevated'
      : normalizedRiskLevel === 'medium'
        ? 'Moderate'
        : 'Pending';
  const defaultProbability = normalizedRiskLevel === 'low'
    ? 'Low'
    : normalizedRiskLevel === 'high'
      ? 'High'
      : 'Unknown';
  const recommendation = ruleBasedEligible
    ? 'Approve with document verification and monitor repayment.'
    : 'Review income and debt profile before decision.';

  return {
    decisionLabel: ruleBasedEligible ? 'Approve' : 'Review',
    riskScore: scoreText,
    incomeStability,
    insuranceAdequacy,
    fraudSignal,
    defaultProbability,
    recommendation,
  };
}

async function fetchHeroMetrics() {
  try {
    const response = await fetch(HERO_METRICS_ENDPOINT);
    if (!response.ok) return;
    const data = await response.json();
    if (data.ok && data.record) {
      renderHeroMetrics(mapEligibilityResponseToHeroMetrics(data.record));
    }
  } catch {
    // ignore fetch failure for hero metrics
  }
}

const loginModal = document.getElementById('login-modal');
const openLoginBtn = document.getElementById('open-login-btn');
const closeLoginBtn = document.getElementById('close-login-btn');
const loginFormArea = document.getElementById('login-form-area');

const loginState = {
  isLoggedIn: false,
  employeeId: '',
  email: '',
  password: '',
  error: '',
  feedback: '',
  logs: loadLogs(),
};

function loadLogs() {
  try {
    return JSON.parse(localStorage.getItem('finshield-logs') || '[]');
  } catch {
    return [];
  }
}

function saveLogs() {
  localStorage.setItem('finshield-logs', JSON.stringify(loginState.logs));
}

function appendLog(type, employeeIdValue, detail) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    employeeId: employeeIdValue || 'Unknown',
    type,
    timestamp: new Date().toLocaleString(),
    detail,
  };

  loginState.logs = [...loginState.logs, entry];
  saveLogs();
}

function openLoginModal() {
  loginModal.classList.remove('hidden');
  renderLoginView();
}

function closeLoginModal() {
  loginModal.classList.add('hidden');
}

function renderLoginView() {
  if (!loginState.isLoggedIn) {
    loginFormArea.innerHTML = `
      <form id="login-form" class="login-form">
        <label for="employee-id">Employee ID</label>
        <input id="employee-id" name="employeeId" placeholder="EMP-1001" required />

        <label for="employee-email">Email</label>
        <input id="employee-email" name="email" type="email" placeholder="name@company.com" required />

        <label for="employee-password">Password</label>
        <input id="employee-password" name="password" type="password" placeholder="Enter password" required />

        ${loginState.error ? `<p class="auth-error">${loginState.error}</p>` : ''}
        <button class="btn btn-primary" type="submit">Login</button>
      </form>
    `;

    document.getElementById('login-form').addEventListener('submit', handleLogin);
    return;
  }

  loginFormArea.innerHTML = `
    <div class="dashboard-panel">
      <div class="dashboard-header">
        <div>
          <p class="eyebrow">Secure workspace</p>
          <h3>Customer Onboarding</h3>
        </div>
        <button class="btn btn-secondary" id="logout-btn" type="button">Logout</button>
      </div>

      <form id="customer-form" class="customer-form">
        <label for="customer-name">Customer Name</label>
        <input id="customer-name" name="customerName" required />

        <label for="aadhaar-number">Aadhaar Card Number</label>
        <input id="aadhaar-number" name="aadhaar" maxlength="14" placeholder="1234 5678 9012" required />

        <label for="dob">Date of Birth</label>
        <input id="dob" name="dob" type="date" required />

        <label for="pan-number">PAN Card Number</label>
        <input id="pan-number" name="pan" maxlength="10" placeholder="ABCDE1234F" required />

        <label for="customer-address">Address</label>
        <textarea id="customer-address" name="address" rows="3" required></textarea>

        <label for="income-tax-file">Income Tax Certificate</label>
        <input id="income-tax-file" name="incomeTaxFile" type="file" />

        <label for="annual-income">Income Certificate (Annual)</label>
        <input id="annual-income" name="annualIncome" type="number" min="0" step="0.01" required />

        ${loginState.feedback ? `<p class="feedback">${loginState.feedback}</p>` : ''}
        <button class="btn btn-primary" type="submit">Submit Customer</button>
      </form>

      <div class="logs-panel">
        <h3>Activity Log</h3>
        <ul>
          ${loginState.logs.slice(-5).reverse().map((entry) => `
            <li>
              <strong>${entry.type}</strong> — ${entry.employeeId}
              <div><span>${entry.timestamp}</span></div>
            </li>
          `).join('')}
        </ul>
      </div>
    </div>
  `;

  document.getElementById('customer-form').addEventListener('submit', handleCustomerSubmit);
  document.getElementById('logout-btn').addEventListener('click', handleLogout);
}

function handleLogin(event) {
  event.preventDefault();

  const employeeId = document.getElementById('employee-id').value.trim();
  const email = document.getElementById('employee-email').value.trim();
  const password = document.getElementById('employee-password').value.trim();

  const employeeValid = /^EMP-\d+$/.test(employeeId);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const passwordValid = password.length >= 4;

  if (!employeeValid || !emailValid || !passwordValid) {
    loginState.error = 'Please enter a valid Employee ID, Email, and Password.';
    appendLog('Failed login attempt', employeeId || 'Unknown', 'Invalid credentials.');
    renderLoginView();
    return;
  }

  loginState.isLoggedIn = true;
  loginState.employeeId = employeeId;
  loginState.email = email;
  loginState.password = password;
  loginState.error = '';
  loginState.feedback = '';
  appendLog('Login success', employeeId, `Authenticated ${email}.`);
  renderLoginView();
}

function handleLogout() {
  appendLog('Logout', loginState.employeeId || 'Unknown', 'User signed out.');
  loginState.isLoggedIn = false;
  loginState.employeeId = '';
  loginState.email = '';
  loginState.password = '';
  loginState.error = '';
  loginState.feedback = '';
  renderLoginView();
}

function handleCustomerSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const formData = new FormData(form);
  const customerName = formData.get('customerName').toString().trim();
  const aadhaar = formData.get('aadhaar').toString().replace(/\s/g, '');
  const pan = formData.get('pan').toString().toUpperCase();

  if (!customerName) {
    loginState.feedback = 'Please enter the customer name.';
    renderLoginView();
    return;
  }

  if (!/^\d{12}$/.test(aadhaar)) {
    loginState.feedback = 'Please enter a valid 12-digit Aadhaar number.';
    renderLoginView();
    return;
  }

  if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) {
    loginState.feedback = 'Please enter a valid PAN number.';
    renderLoginView();
    return;
  }

  loginState.feedback = `Customer profile prepared for ${customerName}.`;
  renderLoginView();
}

async function handleEligibilitySubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const formData = new FormData(form);
  const requestedAmount = Number(formData.get('requestedLoanAmount'));
  const monthlyNetSalary = Number(formData.get('monthlyNetSalary'));
  const currentMonthlyEmi = Number(formData.get('currentMonthlyEmi'));
  const annualIncomeValue = formData.get('annualIncome');
  const annualIncome = annualIncomeValue ? Number(annualIncomeValue) : NaN;
  const fullName = String(formData.get('fullName') || '').trim();
  const dateOfBirth = String(formData.get('dateOfBirth') || '').trim();
  const mobileNumber = String(formData.get('mobileNumber') || '').trim();
  const salarySlipFile = formData.get('salarySlipFile');
  const bankStatementFile = formData.get('bankStatementFile');
  const governmentIdFile = formData.get('governmentIdFile');
  const creditReportFile = formData.get('creditReportFile');
  const insuranceClaimDocumentFile = formData.get('insuranceClaimDocumentFile');
  const loanApplicationFile = formData.get('loanApplicationFile');
  const resultText = document.getElementById('eligibility-result');

  if (resultText) {
    resultText.textContent = 'Checking eligibility...';
  }

  if (!dateOfBirth || !isAdult(dateOfBirth)) {
    if (resultText) {
      resultText.textContent = 'Applicant must be at least 18 years old to be eligible.';
    }
    return;
  }

  const hasAnnualIncome = !Number.isNaN(annualIncome) && annualIncome > 0;
  const salaryRatio = monthlyNetSalary > 0 ? currentMonthlyEmi / monthlyNetSalary : null;
  const ruleBasedEligible = monthlyNetSalary > 0 && salaryRatio !== null && salaryRatio <= 0.45 && (hasAnnualIncome ? requestedAmount <= annualIncome * 0.4 : true);

  if (!salarySlipFile || !(salarySlipFile instanceof File) || !bankStatementFile || !(bankStatementFile instanceof File) || !governmentIdFile || !(governmentIdFile instanceof File) || !creditReportFile || !(creditReportFile instanceof File) || !loanApplicationFile || !(loanApplicationFile instanceof File)) {
    if (resultText) {
      resultText.textContent = 'Please upload all required documents before checking eligibility.';
    }
    return;
  }

  const payload = {
    fullName,
    mobileNumber,
    requestedLoanAmount: requestedAmount,
    monthlyNetSalary,
    currentMonthlyEmi,
    dateOfBirth,
    annualIncome: hasAnnualIncome ? annualIncome : null,
    salarySlipFileName: salarySlipFile instanceof File ? salarySlipFile.name : '',
    bankStatementFileName: bankStatementFile instanceof File ? bankStatementFile.name : '',
    governmentIdFileName: governmentIdFile instanceof File ? governmentIdFile.name : '',
    creditReportFileName: creditReportFile instanceof File ? creditReportFile.name : '',
    insuranceClaimDocumentFileName: insuranceClaimDocumentFile instanceof File ? insuranceClaimDocumentFile.name : '',
    loanApplicationFileName: loanApplicationFile instanceof File ? loanApplicationFile.name : '',
    ruleBasedEligible,
  };

  try {
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      const message = (errorBody && (errorBody.error || errorBody.message)) || 'Unexpected server error.';
      throw new Error(message);
    }

    const result = await response.json();

    if (!result.ok) {
      throw new Error(result.error || 'AI eligibility check failed.');
    }

    let assessment = result.assessment;

// If the backend returned a JSON string, parse it.
if (typeof assessment === "string") {
    try {
        assessment = JSON.parse(assessment);
    } catch {
        const start = assessment.indexOf("{");
        const end = assessment.lastIndexOf("}");

        if (start !== -1 && end !== -1) {
            try {
                assessment = JSON.parse(
                    assessment.substring(start, end + 1)
                );
            } catch {
                assessment = {};
            }
        } else {
            assessment = {};
        }
    }
}

assessment = assessment || {};
const heroMetrics = mapEligibilityResponseToHeroMetrics(result);
renderHeroMetrics(heroMetrics);

const riskLevel = (assessment.riskLevel || "Unknown").toLowerCase();
const displayRiskLevel = assessment.riskLevel || "Unknown";
const score = assessment.score ?? "N/A";
const explanation = assessment.explanation || "No explanation returned.";

const warnings = [
    ...(assessment.warnings || []),
    ...(result.warnings || [])
];

const warningMessage = warnings.length
    ? "\n\nWarnings:\n• " + warnings.join("\n• ")
    : "";

const eligibilityLabel = riskLevel === 'high'
    ? 'Not Eligible'
    : riskLevel === 'low'
      ? 'Eligible'
      : ruleBasedEligible
        ? 'Eligible'
        : 'Not Eligible';

  if (resultText) {
    resultText.classList.toggle('error', eligibilityLabel === 'Not Eligible');
    resultText.innerHTML = `
<b>Eligibility:</b> ${eligibilityLabel}<br><br>

<b>Risk Level:</b> ${displayRiskLevel}<br>

<b>Score:</b> ${score}<br><br>

<b>Explanation:</b><br>
${explanation}<br><br>

<b>Warnings:</b><br>
${warnings.length ? warnings.join("<br>") : "None"}
`;
}
  } catch (error) {
    if (resultText) {
      resultText.textContent = error.message || 'AI service is unavailable. Please try again later.';
    }
  }
}

const eligibilityForm = document.getElementById('eligibility-form');
if (eligibilityForm) {
  eligibilityForm.addEventListener('submit', handleEligibilitySubmit);
}

openLoginBtn.addEventListener('click', openLoginModal);
closeLoginBtn.addEventListener('click', closeLoginModal);
loginModal.addEventListener('click', (event) => {
  if (event.target === loginModal) {
    closeLoginModal();
  }
});

async function loadComponent(elementId, filePath) {
  const container = document.getElementById(elementId);
  if (!container) return;

  const response = await fetch(filePath);
  if (!response.ok) {
    container.innerHTML = '<p>Component could not be loaded.</p>';
    return;
  }

  container.innerHTML = await response.text();
}

(async () => {
  await loadComponent('hero-section', 'components/hero.html');
  await loadComponent('workflow-section', 'components/workflow.html');
  await loadComponent('impact-section', 'components/impact.html');
  await loadComponent('contact-section', 'components/contact.html');
  await fetchHeroMetrics();
  initDecisionButtons();
})();

renderLoginView();
