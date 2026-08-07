import { useState } from 'react';
import './styles.css';
import Hero from './components/Hero';
import Workflow from './components/Workflow';
import Impact from './components/Impact';
import Contact from './components/Contact';

const API_BASE_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

const getApiKey = () => import.meta.env.VITE_API_KEY || '';

const loadLogs = () => {
  if (typeof window === 'undefined') return [];

  try {
    return JSON.parse(window.localStorage.getItem('finshield-logs') || '[]');
  } catch {
    return [];
  }
};

export default function App() {
  const [employeeId, setEmployeeId] = useState('');
  const [email, setEmail] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [logs, setLogs] = useState(loadLogs);
  const [customerForm, setCustomerForm] = useState({
    customerName: '',
    aadhaar: '',
    dob: '',
    pan: '',
    address: '',
    incomeTaxFileName: '',
    annualIncome: '',
    incomeCertificateFileName: '',
  });
  const [eligibilityForm, setEligibilityForm] = useState({
    fullName: '',
    mobileNumber: '',
    requestedLoanAmount: '',
    monthlyNetSalary: '',
    currentMonthlyEmi: '',
    dateOfBirth: '',
    annualIncome: '',
    salarySlipFileName: '',
    bankStatementFileName: '',
    creditReportFileName: '',
    lifeInsurancePolicyFileName: '',
    healthInsurancePolicyFileName: '',
    vehicleInsurancePolicyFileName: '',
    insuranceClaimDocumentFileName: '',
    loanApplicationFileName: '',
    previousLoanNocFileName: '',
    documentFileName: '',
  });
  const [feedback, setFeedback] = useState('');
  const [eligibilityResult, setEligibilityResult] = useState('');

  const appendLog = (type, employeeIdValue, detail) => {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      employeeId: employeeIdValue || 'Unknown',
      type,
      timestamp: new Date().toISOString(),
      detail,
    };

    setLogs((prev) => {
      const updated = [...prev, entry];
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('finshield-logs', JSON.stringify(updated));
      }
      return updated;
    });
  };

  const handleLogin = (event) => {
    event.preventDefault();

    const trimmedEmployeeId = employeeId.trim();
    const trimmedEmail = email.trim();
    const employeeValid = /^EMP-\d+$/.test(trimmedEmployeeId);
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);

    if (!employeeValid || !emailValid) {
      setLoginError('Please enter a valid employee ID and email.');
      appendLog('Failed login attempt', trimmedEmployeeId || 'Unknown', 'Invalid employee ID or email format.');
      return;
    }

    setIsLoggedIn(true);
    setLoginError('');
    setShowLoginModal(false);
    appendLog('Login success', trimmedEmployeeId, `Authenticated ${trimmedEmail}.`);
  };

  const handleLogout = () => {
    const currentEmployeeId = employeeId.trim() || 'Unknown';
    setIsLoggedIn(false);
    setEmployeeId('');
    setEmail('');
    appendLog('Logout', currentEmployeeId, 'User signed out.');
  };

  const handleCustomerInput = (event) => {
    const { name, value } = event.target;
    setCustomerForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleEligibilityInput = (event) => {
    const { name, value } = event.target;
    setEligibilityForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleEligibilityFile = (event) => {
    const { name } = event.target;
    const fileName = event.target.files?.[0]?.name || '';
    setEligibilityForm((prev) => ({ ...prev, [name]: fileName }));
  };

  const handleCustomerFile = (event) => {
    const { name } = event.target;
    const fileName = event.target.files?.[0]?.name || '';
    setCustomerForm((prev) => ({ ...prev, [name]: fileName }));
  };

  const handleCustomerSubmit = (event) => {
    event.preventDefault();

    const aadhaarValid = /^\d{12}$/.test(customerForm.aadhaar.replace(/\s/g, ''));
    const panValid = /^[A-Z]{5}\d{4}[A-Z]{1}$/.test(customerForm.pan.toUpperCase());

    if (!aadhaarValid || !panValid) {
      setFeedback('Please enter a valid Aadhaar number and PAN format.');
      return;
    }

    setFeedback(`Customer profile prepared for ${customerForm.customerName || 'the applicant'}.`);
  };

  const handleEligibilitySubmit = async (event) => {
    event.preventDefault();

    const requestedAmount = Number(eligibilityForm.requestedLoanAmount);
    const monthlyNet = Number(eligibilityForm.monthlyNetSalary);
    const monthlyEmi = Number(eligibilityForm.currentMonthlyEmi);
    const annualIncome = Number(eligibilityForm.annualIncome);

    const salaryRatio = monthlyEmi / Math.max(monthlyNet, 1);
    const isEligible = requestedAmount <= annualIncome * 0.4 && salaryRatio <= 0.45 && monthlyNet > 0;

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
                fullName: eligibilityForm.fullName,
                mobileNumber: eligibilityForm.mobileNumber,
                requestedLoanAmount: eligibilityForm.requestedLoanAmount,
                monthlyNetSalary: eligibilityForm.monthlyNetSalary,
                currentMonthlyEmi: eligibilityForm.currentMonthlyEmi,
                dateOfBirth: eligibilityForm.dateOfBirth,
                annualIncome: eligibilityForm.annualIncome,
                incomeRatio: monthlyNet > 0 ? monthlyEmi / monthlyNet : null,
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

      setEligibilityResult(
        isEligible
          ? `${eligibilityForm.fullName || 'Applicant'} appears eligible for the requested loan amount based on the provided income and EMI details. Risk level: ${riskLevel}. Score: ${score}. ${explanation}`
          : `${eligibilityForm.fullName || 'Applicant'} does not meet the current eligibility threshold. Please review income, EMI, or requested amount. Risk level: ${riskLevel}. Score: ${score}. ${explanation}`
      );
    } catch (error) {
      setEligibilityResult(
        isEligible
          ? `${eligibilityForm.fullName || 'Applicant'} appears eligible for the requested loan amount based on the provided income and EMI details. API connectivity could not be confirmed.`
          : `${eligibilityForm.fullName || 'Applicant'} does not meet the current eligibility threshold. Please review income, EMI, or requested amount. API connectivity could not be confirmed.`
      );
    }
  };

  return (
    <>
      <header className="topbar">
        <a className="brand" href="#home">
          <span className="brand-mark">F</span>
          <span>FinShield</span>
        </a>
        <nav className="nav-links">
          <a href="#workflow">Workflow</a>
          <a href="#impact">Impact</a>
          <a href="#contact">Contact</a>
          <button className="nav-login" type="button" onClick={() => setShowLoginModal(true)}>Login</button>
        </nav>
      </header>

      <main id="home">
        {showLoginModal ? (
          <div className="login-modal" role="dialog" aria-modal="true">
            <div className="login-modal-card">
              <div className="login-modal-header">
                <h2>Employee Login</h2>
                <button className="btn btn-secondary" type="button" onClick={() => setShowLoginModal(false)}>Close</button>
              </div>
              <p className="auth-help">Enter your Employee ID and Email to access the customer onboarding workspace. Each login, logout, and failed attempt is recorded with an exact date and time stamp.</p>
              {!isLoggedIn ? (
                <form className="auth-form" onSubmit={handleLogin} noValidate>
                  <label htmlFor="employeeId">Employee ID</label>
                  <input
                    id="employeeId"
                    name="employeeId"
                    value={employeeId}
                    onChange={(event) => setEmployeeId(event.target.value)}
                    placeholder="EMP-1001"
                    required
                  />

                  <label htmlFor="employeeEmail">Email</label>
                  <input
                    id="employeeEmail"
                    name="email"
                    type="text"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@company.com"
                    required
                  />

                  {loginError ? <p className="auth-error">{loginError}</p> : null}
                  <button className="btn btn-primary" type="submit">Login</button>
                </form>
              ) : null}
            </div>
          </div>
        ) : null}

        {!isLoggedIn ? null : (
          <section id="login-panel" className="auth-panel" aria-label="Employee login section">
            <h2>Employee Login</h2>
            <p className="auth-help">Enter your Employee ID and Email to access the customer onboarding workspace. Each login, logout, and failed attempt is recorded with an exact date and time stamp.</p>
            <div className="dashboard-panel">
              <div className="dashboard-header">
                <div>
                  <p className="eyebrow">Secure workspace</p>
                  <h2>Customer Onboarding Dashboard</h2>
                </div>
                <button className="btn btn-secondary" type="button" onClick={handleLogout}>
                  Logout
                </button>
              </div>

              <form className="customer-form" onSubmit={handleCustomerSubmit}>
                <label htmlFor="customerName">Customer Name</label>
                <input id="customerName" name="customerName" value={customerForm.customerName} onChange={handleCustomerInput} required />

                <label htmlFor="aadhaar">Aadhaar Card Number</label>
                <input id="aadhaar" name="aadhaar" value={customerForm.aadhaar} onChange={handleCustomerInput} placeholder="1234 5678 9012" maxLength="14" required />

                <label htmlFor="dob">Date of Birth</label>
                <input id="dob" name="dob" type="date" value={customerForm.dob} onChange={handleCustomerInput} required />

                <label htmlFor="pan">PAN Card Number</label>
                <input id="pan" name="pan" value={customerForm.pan} onChange={handleCustomerInput} placeholder="ABCDE1234F" maxLength="10" required />

                <label htmlFor="address">Address</label>
                <textarea id="address" name="address" value={customerForm.address} onChange={handleCustomerInput} rows="3" required />

                <label htmlFor="incomeTaxFile">Income Tax Certificate</label>
                <input id="incomeTaxFile" name="incomeTaxFileName" type="file" onChange={handleCustomerFile} />

                <label htmlFor="annualIncome">Income Certificate (Annual)</label>
                <input id="annualIncome" name="annualIncome" type="number" min="0" step="0.01" value={customerForm.annualIncome} onChange={handleCustomerInput} required />

                <label htmlFor="incomeCertificateFile">Income Certificate Attachment</label>
                <input id="incomeCertificateFile" name="incomeCertificateFileName" type="file" onChange={handleCustomerFile} />

                {feedback ? <p className="feedback">{feedback}</p> : null}
                <button className="btn btn-primary" type="submit">Submit Customer</button>
              </form>

              <div className="logs-panel">
                <h3>Activity Log</h3>
                <ul>
                  {logs.slice(-5).reverse().map((entry) => (
                    <li key={entry.id}>
                      <strong>{entry.type}</strong> — {entry.employeeId} <span>{entry.timestamp}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}

        <Hero />
        <section className="eligibility-card" aria-label="Customer eligibility check">
          <div className="dashboard-header">
            <div>
              <p className="eyebrow">Eligibility check</p>
              <h2>Customer Eligibility Check</h2>
            </div>
          </div>
          <form className="customer-form" onSubmit={handleEligibilitySubmit}>
            <label htmlFor="fullName">Full name of customer</label>
            <input id="fullName" name="fullName" value={eligibilityForm.fullName} onChange={handleEligibilityInput} required />

            <label htmlFor="mobileNumber">Mobile number</label>
            <input id="mobileNumber" name="mobileNumber" type="tel" value={eligibilityForm.mobileNumber} onChange={handleEligibilityInput} placeholder="9876543210" required />

            <label htmlFor="requestedLoanAmount">Requested loan amount</label>
            <input id="requestedLoanAmount" name="requestedLoanAmount" type="number" min="0" step="1000" value={eligibilityForm.requestedLoanAmount} onChange={handleEligibilityInput} required />

            <label htmlFor="monthlyNetSalary">Monthly net salary</label>
            <input id="monthlyNetSalary" name="monthlyNetSalary" type="number" min="0" step="100" value={eligibilityForm.monthlyNetSalary} onChange={handleEligibilityInput} required />

            <label htmlFor="currentMonthlyEmi">Current monthly EMI</label>
            <input id="currentMonthlyEmi" name="currentMonthlyEmi" type="number" min="0" step="100" value={eligibilityForm.currentMonthlyEmi} onChange={handleEligibilityInput} required />

            <label htmlFor="dateOfBirth">Date of birth</label>
            <input id="dateOfBirth" name="dateOfBirth" type="date" value={eligibilityForm.dateOfBirth} onChange={handleEligibilityInput} required />

            <label htmlFor="incomeCertificate">Income certificate</label>
            <input id="incomeCertificate" name="incomeCertificate" type="file" onChange={handleEligibilityFile} />

            <label htmlFor="salarySlipUpload">Salary slip (proof of monthly income)</label>
            <input id="salarySlipUpload" name="salarySlipFileName" type="file" onChange={handleEligibilityFile} />

            <label htmlFor="bankStatementUpload">Bank statement (at least 3 months)</label>
            <input id="bankStatementUpload" name="bankStatementFileName" type="file" onChange={handleEligibilityFile} />

            <label htmlFor="creditReportUpload">Credit report</label>
            <input id="creditReportUpload" name="creditReportFileName" type="file" onChange={handleEligibilityFile} />

            <label htmlFor="lifeInsurancePolicyUpload">Life insurance policy</label>
            <input id="lifeInsurancePolicyUpload" name="lifeInsurancePolicyFileName" type="file" onChange={handleEligibilityFile} />

            <label htmlFor="healthInsurancePolicyUpload">Health insurance policy</label>
            <input id="healthInsurancePolicyUpload" name="healthInsurancePolicyFileName" type="file" onChange={handleEligibilityFile} />

            <label htmlFor="vehicleInsurancePolicyUpload">Vehicle insurance policy</label>
            <input id="vehicleInsurancePolicyUpload" name="vehicleInsurancePolicyFileName" type="file" onChange={handleEligibilityFile} />

            <label htmlFor="insuranceClaimUpload">Insurance claim documents</label>
            <input id="insuranceClaimUpload" name="insuranceClaimDocumentFileName" type="file" onChange={handleEligibilityFile} />

            <label htmlFor="loanApplicationUpload">Loan application</label>
            <input id="loanApplicationUpload" name="loanApplicationFileName" type="file" onChange={handleEligibilityFile} />

            <label htmlFor="previousLoanNocUpload">NOC of previous loans</label>
            <input id="previousLoanNocUpload" name="previousLoanNocFileName" type="file" onChange={handleEligibilityFile} />

            {eligibilityResult ? <p className="feedback">{eligibilityResult}</p> : null}
            <button className="btn btn-primary" type="submit">Check eligibility</button>
          </form>
        </section>
        <Workflow />
        <Impact />
        <Contact />
      </main>

      <footer>
        <p>© {new Date().getFullYear()} FinShield. Built for smarter financial protection.</p>
      </footer>
    </>
  );
}
