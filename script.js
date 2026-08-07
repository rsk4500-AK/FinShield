document.getElementById('year').textContent = new Date().getFullYear();

const API_BASE_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const getApiKey = () => (window.__FINSHIELD_API_KEY__ || '');

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

        <label for="income-certificate-file">Income Certificate Attachment</label>
        <input id="income-certificate-file" name="incomeCertificateFile" type="file" />

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
  const annualIncome = Number(formData.get('annualIncome'));
  const fullName = formData.get('fullName').toString().trim();

  const isEligible = requestedAmount <= annualIncome * 0.4 && currentMonthlyEmi / Math.max(monthlyNetSalary, 1) <= 0.45 && monthlyNetSalary > 0;
  const resultText = document.getElementById('eligibility-result');

  try {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error('Missing API key.');
    }

    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        model: 'meta/llama-3.1-8b-instruct',
        messages: [
          {
            role: 'system',
            content: 'You are a lending risk analyst. Respond with JSON containing riskLevel, score, and explanation only.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              fullName,
              requestedLoanAmount: requestedAmount,
              monthlyNetSalary,
              currentMonthlyEmi,
              annualIncome,
              incomeRatio: monthlyNetSalary > 0 ? currentMonthlyEmi / monthlyNetSalary : null,
              requestedToIncomeRatio: annualIncome > 0 ? requestedAmount / annualIncome : null,
              ruleBasedEligible: isEligible,
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const payload = await response.json();
    const rawContent = payload?.choices?.[0]?.message?.content || '';
    let assessment = null;

    try {
      assessment = JSON.parse(rawContent);
    } catch {
      assessment = null;
    }

    const riskLevel = assessment?.riskLevel || 'unknown';
    const score = assessment?.score || 'n/a';
    const explanation = assessment?.explanation || 'No detailed assessment returned.';

    if (resultText) {
      resultText.textContent = isEligible
        ? `${fullName || 'Applicant'} appears eligible for the requested loan amount based on the provided income and EMI details. Risk level: ${riskLevel}. Score: ${score}. ${explanation}`
        : `${fullName || 'Applicant'} does not meet the current eligibility threshold. Please review income, EMI, or requested amount. Risk level: ${riskLevel}. Score: ${score}. ${explanation}`;
    }
  } catch (error) {
    if (resultText) {
      resultText.textContent = isEligible
        ? `${fullName || 'Applicant'} appears eligible for the requested loan amount based on the provided income and EMI details. API connectivity could not be confirmed.`
        : `${fullName || 'Applicant'} does not meet the current eligibility threshold. Please review income, EMI, or requested amount. API connectivity could not be confirmed.`;
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
})();

renderLoginView();
