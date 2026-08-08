import { useState } from 'react';
import './styles.css';
import Hero from './components/Hero';
import Workflow from './components/Workflow';
import Impact from './components/Impact';
import Contact from './components/Contact';

const BACKEND_BASE_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:3100' : '';
const API_BASE_URL = `${BACKEND_BASE_URL}/api/eligibility`;

const loadLogs = () => {
  if (typeof window === 'undefined') return [];

  try {
    return JSON.parse(window.localStorage.getItem('finshield-logs') || '[]');
  } catch {
    return [];
  }
};

const loadCustomerProfiles = () => {
  if (typeof window === 'undefined') return [];

  try {
    return JSON.parse(window.localStorage.getItem('finshield-customer-profiles') || '[]');
  } catch {
    return [];
  }
};

const saveCustomerProfiles = (profiles) => {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem('finshield-customer-profiles', JSON.stringify(profiles));
};

const loadPendingSync = () => {
  if (typeof window === 'undefined') return [];

  try {
    return JSON.parse(window.localStorage.getItem('finshield-pending-sync') || '[]');
  } catch {
    return [];
  }
};

const savePendingSync = (items) => {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem('finshield-pending-sync', JSON.stringify(items));
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
    governmentIdFileName: '',
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
  const [eligibilityError, setEligibilityError] = useState(false);
  const [savedProfiles, setSavedProfiles] = useState(loadCustomerProfiles);
  const [pendingSync, setPendingSync] = useState(loadPendingSync);
  const [syncStatus, setSyncStatus] = useState('');

  const getMaxDobFor18Plus = () => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 18);
    return date.toISOString().slice(0, 10);
  };

  const getApplicantAge = (dateString) => {
    const dob = new Date(dateString);
    if (!dateString || Number.isNaN(dob.getTime())) {
      return null;
    }

    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age -= 1;
    }

    return age;
  };

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

    const profile = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      customerName: customerForm.customerName,
      aadhaar: customerForm.aadhaar,
      dob: customerForm.dob,
      pan: customerForm.pan,
      address: customerForm.address,
      annualIncome: customerForm.annualIncome,
      incomeTaxFileName: customerForm.incomeTaxFileName,
      createdAt: new Date().toISOString(),
      source: 'local-fallback',
    };

    const updatedProfiles = [profile, ...savedProfiles];
    setSavedProfiles(updatedProfiles);
    saveCustomerProfiles(updatedProfiles);

    const queued = [profile, ...pendingSync];
    setPendingSync(queued);
    savePendingSync(queued);

    setFeedback(`Customer profile prepared for ${customerForm.customerName || 'the applicant'}. Stored locally until the database is reachable.`);
  };

  const handleSyncToDatabase = async () => {
    if (pendingSync.length === 0) {
      setSyncStatus('No pending records to sync.');
      return;
    }

    try {
      const response = await fetch('http://localhost:3100/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ records: pendingSync }),
      });

      if (!response.ok) {
        throw new Error('Sync failed.');
      }

      setPendingSync([]);
      savePendingSync([]);
      setSyncStatus('Sync completed.');
      appendLog('Sync completed', employeeId.trim() || 'Unknown', `Synced ${pendingSync.length} record(s) to the database.`);
    } catch {
      setSyncStatus('Sync failed. Records remain queued for retry.');
      appendLog('Sync failed', employeeId.trim() || 'Unknown', 'Unable to reach the sync endpoint.');
    }
  };

  const handleEligibilitySubmit = async (event) => {
    event.preventDefault();

    const requestedAmount = Number(eligibilityForm.requestedLoanAmount);
    const monthlyNet = Number(eligibilityForm.monthlyNetSalary);
    const monthlyEmi = Number(eligibilityForm.currentMonthlyEmi);
    const annualIncome = eligibilityForm.annualIncome ? Number(eligibilityForm.annualIncome) : null;

    const applicantAge = getApplicantAge(eligibilityForm.dateOfBirth);
    if (applicantAge === null) {
      setEligibilityResult('Please enter a valid date of birth.');
      return;
    }

    if (applicantAge < 18) {
      setEligibilityResult('Applicant must be at least 18 years old to be eligible.');
      return;
    }

    const salaryRatio = monthlyNet > 0 ? monthlyEmi / monthlyNet : null;
    const ruleBasedEligible = monthlyNet > 0 && salaryRatio !== null && salaryRatio <= 0.45 && (annualIncome ? requestedAmount <= annualIncome * 0.4 : true);
    const warnings = [];

    if (!annualIncome) {
      warnings.push('Annual income not provided. AI assessment is based only on entered financial information.');
    }

    try {
      const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          fullName: eligibilityForm.fullName,
          mobileNumber: eligibilityForm.mobileNumber,
          requestedLoanAmount: requestedAmount,
          monthlyNetSalary: eligibilityForm.monthlyNetSalary,
          currentMonthlyEmi: eligibilityForm.currentMonthlyEmi,
          dateOfBirth: eligibilityForm.dateOfBirth,
          annualIncome: annualIncome || null,
          salarySlipFileName: eligibilityForm.salarySlipFileName || null,
          bankStatementFileName: eligibilityForm.bankStatementFileName || null,
          creditReportFileName: eligibilityForm.creditReportFileName || null,
          insuranceClaimDocumentFileName: eligibilityForm.insuranceClaimDocumentFileName || null,
          loanApplicationFileName: eligibilityForm.loanApplicationFileName || null,
          previousLoanNocFileName: eligibilityForm.previousLoanNocFileName || null,
          ruleBasedEligible,
          warnings,
        }),
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

      const assessment = result.assessment || {};
      const riskLevel = assessment.riskLevel || 'unknown';
      const normalizedRiskLevel = riskLevel.toLowerCase();
      const score = assessment.score ?? 'n/a';
      const explanation = assessment.explanation || 'No detailed assessment returned.';
      const responseWarnings = Array.isArray(result.warnings) ? result.warnings : [];
      const warningMessage = responseWarnings.length ? ` ${responseWarnings.join(' ')}` : '';

      const eligibilityMessage = normalizedRiskLevel === 'high'
        ? `${eligibilityForm.fullName || 'Applicant'} is not eligible due to high risk. Risk level: ${riskLevel}. Score: ${score}. ${explanation}${warningMessage}`
        : normalizedRiskLevel === 'low'
          ? `${eligibilityForm.fullName || 'Applicant'} appears eligible for the requested loan amount. Risk level: ${riskLevel}. Score: ${score}. ${explanation}${warningMessage}`
          : ruleBasedEligible
            ? `${eligibilityForm.fullName || 'Applicant'} appears eligible for the requested loan amount. Risk level: ${riskLevel}. Score: ${score}. ${explanation}${warningMessage}`
            : `${eligibilityForm.fullName || 'Applicant'} does not meet the current eligibility threshold. Please review income, EMI, or requested amount. Risk level: ${riskLevel}. Score: ${score}. ${explanation}${warningMessage}`;

      setEligibilityError(riskLevel.toLowerCase() === 'high');
      setEligibilityResult(eligibilityMessage);
    } catch (error) {
      setEligibilityError(true);
      setEligibilityResult(error.message || 'AI service is unavailable. Please try again later.');
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

                {feedback ? <p className="feedback">{feedback}</p> : null}
                <div className="dashboard-actions">
                  <button className="btn btn-primary" type="submit">Submit Customer</button>
                  <button className="btn btn-secondary" type="button" onClick={handleSyncToDatabase}>Sync to Database</button>
                </div>
                {syncStatus ? <p className="feedback">{syncStatus}</p> : null}
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

<label htmlFor="dateOfBirth">Date of birth (must be 18+)</label>
                <input id="dateOfBirth" name="dateOfBirth" type="date" max={getMaxDobFor18Plus()} value={eligibilityForm.dateOfBirth} onChange={handleEligibilityInput} required />

            <label htmlFor="salarySlipUpload">Salary slip (proof of monthly income)</label>
            <input id="salarySlipUpload" name="salarySlipFileName" type="file" onChange={handleEligibilityFile} required />

            <label htmlFor="bankStatementUpload">Bank statement (at least 3 months)</label>
            <input id="bankStatementUpload" name="bankStatementFileName" type="file" onChange={handleEligibilityFile} required />

            <label htmlFor="governmentIdUpload">Government ID</label>
            <input id="governmentIdUpload" name="governmentIdFileName" type="file" onChange={handleEligibilityFile} required />

            <label htmlFor="creditReportUpload">Credit report</label>
            <input id="creditReportUpload" name="creditReportFileName" type="file" onChange={handleEligibilityFile} required />

            <label htmlFor="lifeInsurancePolicyUpload">Life insurance policy</label>
            <input id="lifeInsurancePolicyUpload" name="lifeInsurancePolicyFileName" type="file" onChange={handleEligibilityFile} />

            <label htmlFor="healthInsurancePolicyUpload">Health insurance policy</label>
            <input id="healthInsurancePolicyUpload" name="healthInsurancePolicyFileName" type="file" onChange={handleEligibilityFile} />

            <label htmlFor="vehicleInsurancePolicyUpload">Vehicle insurance policy</label>
            <input id="vehicleInsurancePolicyUpload" name="vehicleInsurancePolicyFileName" type="file" onChange={handleEligibilityFile} />

            <label htmlFor="insuranceClaimUpload">Insurance claim documents</label>
            <input id="insuranceClaimUpload" name="insuranceClaimDocumentFileName" type="file" onChange={handleEligibilityFile} />

            <label htmlFor="loanApplicationUpload">Loan application</label>
            <input id="loanApplicationUpload" name="loanApplicationFileName" type="file" onChange={handleEligibilityFile} required />

            <label htmlFor="previousLoanNocUpload">NOC of previous loans</label>
            <input id="previousLoanNocUpload" name="previousLoanNocFileName" type="file" onChange={handleEligibilityFile} />

            {eligibilityResult ? <p className={`feedback ${eligibilityError ? 'error' : ''}`}>{eligibilityResult}</p> : null}
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
