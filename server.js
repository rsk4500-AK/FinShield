import express from 'express';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

dotenv.config();

const port = process.env.PORT || 3100;
const apiKey = process.env.VITE_API_KEY;
const mongoUri = process.env.MONGODB_URI;
const mongoDbName = process.env.MONGODB_DB_NAME || 'FinShield';
const mongoCollectionName = process.env.MONGODB_COLLECTION || 'records';
const mongoEligibilityCollectionName = process.env.MONGODB_ELIGIBILITY_COLLECTION || 'eligibility_records';
const nvidiaUrl = 'https://integrate.api.nvidia.com/v1/chat/completions';

const app = express();
const localStore = [];
const localEligibilityStore = [];
let mongoClient = null;
let mongoCollection = null;
let mongoEligibilityCollection = null;
let dbAvailable = false;

function getApplicantAge(dateString) {
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
}

async function initMongo() {
  if (!mongoUri) {
    console.warn('No MONGODB_URI configured. MongoDB persistence is disabled.');
    return;
  }

  try {
    mongoClient = new MongoClient(mongoUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 20000,
      tls: true,
      appName: 'FinShieldSyncServer',
    });

    await mongoClient.connect();
    await mongoClient.db(mongoDbName).command({ ping: 1 });

    const db = mongoClient.db(mongoDbName);
    mongoCollection = db.collection(mongoCollectionName);
    mongoEligibilityCollection = db.collection(mongoEligibilityCollectionName);
    dbAvailable = true;
    console.log('Connected to MongoDB Atlas:', mongoDbName, '/', mongoCollectionName, 'and', mongoEligibilityCollectionName);
  } catch (error) {
    dbAvailable = false;
    console.error('MongoDB connection failed. Local sync fallback enabled.');
    console.error('MongoDB error:', error);
  }
}

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', dbAvailable });
});

app.get('/api/sync-state', (req, res) => {
  res.json({ count: localStore.length, records: localStore, dbAvailable });
});

app.post('/api/sync', async (req, res) => {
  try {
    const payload = req.body || {};
    const records = Array.isArray(payload.records) ? payload.records : [];

    if (dbAvailable && mongoCollection) {
      const preparedRecords = records.map((record) => ({
        ...record,
        syncedAt: new Date().toISOString(),
      }));

      const { insertedCount } = await mongoCollection.insertMany(preparedRecords);
      return res.json({ ok: true, synced: insertedCount, fallback: false });
    }

    records.forEach((record) => {
      localStore.push({
        ...record,
        syncedAt: new Date().toISOString(),
      });
    });

    return res.json({ ok: true, synced: records.length, fallback: true });
  } catch (error) {
    console.error('Sync failed:', error);
    return res.status(500).json({ ok: false, error: 'Unable to sync records.' });
  }
});

app.post('/api/eligibility', async (req, res) => {
  if (!apiKey) {
    return res.status(500).json({ ok: false, error: 'Server missing NVIDIA API key.' });
  }

  const body = req.body || {};
  const fullName = String(body.fullName || '').trim();
  const mobileNumber = String(body.mobileNumber || '').trim();
  const dateOfBirth = String(body.dateOfBirth || '').trim();
  const requestedLoanAmount = Number(body.requestedLoanAmount ?? NaN);
  const monthlyNetSalary = Number(body.monthlyNetSalary ?? NaN);
  const currentMonthlyEmi = Number(body.currentMonthlyEmi ?? NaN);
  const annualIncome = Number(body.annualIncome ?? NaN);
  const salarySlipFileName = String(body.salarySlipFileName || '').trim();
  const bankStatementFileName = String(body.bankStatementFileName || '').trim();
  const governmentIdFileName = String(body.governmentIdFileName || '').trim();
  const creditReportFileName = String(body.creditReportFileName || '').trim();
  const insuranceClaimDocumentFileName = String(body.insuranceClaimDocumentFileName || '').trim();
  const loanApplicationFileName = String(body.loanApplicationFileName || '').trim();

  const validationErrors = [];

  if (!fullName) validationErrors.push('Customer full name is required.');
  if (!mobileNumber) validationErrors.push('Mobile number is required.');
  if (Number.isNaN(requestedLoanAmount) || requestedLoanAmount <= 0) validationErrors.push('Requested loan amount must be a positive number.');
  if (Number.isNaN(monthlyNetSalary) || monthlyNetSalary <= 0) validationErrors.push('Monthly net salary must be a positive number.');
  if (Number.isNaN(currentMonthlyEmi) || currentMonthlyEmi < 0) validationErrors.push('Current monthly EMI must be zero or a positive number.');
  if (!salarySlipFileName) validationErrors.push('Salary slip is required.');
  if (!bankStatementFileName) validationErrors.push('Bank statement is required.');
  if (!governmentIdFileName) validationErrors.push('Government ID is required.');
  if (!creditReportFileName) validationErrors.push('Credit report is required.');
  if (!loanApplicationFileName) validationErrors.push('Loan application is required.');

  const age = getApplicantAge(dateOfBirth);
  if (age === null) {
    validationErrors.push('Date of birth is required and must be valid.');
  } else if (age < 18) {
    validationErrors.push('Applicant must be at least 18 years old.');
  }

  if (validationErrors.length > 0) {
    return res.status(400).json({ ok: false, error: 'Validation failed.', details: validationErrors });
  }

  const hasAnnualIncome = !Number.isNaN(annualIncome) && annualIncome > 0;
  const salaryRatio = currentMonthlyEmi / monthlyNetSalary;
  const ruleBasedEligible = monthlyNetSalary > 0 && salaryRatio <= 0.45 && (hasAnnualIncome ? requestedLoanAmount <= annualIncome * 0.4 : true);
  const warnings = [];

  if (!hasAnnualIncome) {
    warnings.push('Annual income not provided. AI assessment is based only on entered financial information.');
  }

  const prompt = `You are a lending risk analyst. Return only valid JSON containing riskLevel, score, explanation, and warnings. Use the following customer details exactly:
${JSON.stringify(
    {
      fullName,
      mobileNumber,
      dateOfBirth,
      requestedLoanAmount,
      monthlyNetSalary,
      currentMonthlyEmi,
      annualIncome: hasAnnualIncome ? annualIncome : null,
      documents: {
        incomeCertificateFileName: incomeCertificateFileName || null,
        insuranceClaimDocumentFileName: insuranceClaimDocumentFileName || null,
        loanApplicationFileName: loanApplicationFileName || null,
      },
      ruleBasedEligible,
      salaryRatio,
      warnings,
    },
    null,
    2
  )}
`;

  try {
    console.log("===== Calling NVIDIA API =====");
    console.log("URL:", nvidiaUrl);
    console.log("Model:", "meta/llama-3.1-8b-instruct");
    const response = await fetch(nvidiaUrl, {
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
            content: `
You are a lending risk analyst.

Return ONLY raw JSON.

Do NOT use markdown.

Do NOT wrap the JSON inside \`\`\`.

Return exactly this schema:

{
  "riskLevel": "Low|Medium|High",
  "score": number,
  "explanation": "string",
  "warnings": ["string"]
}
`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });
    console.log("NVIDIA Status:", response.status);

    const payload = await response.json();
    console.log("===== NVIDIA RESPONSE =====");
    console.dir(payload, { depth: null });

    if (!response.ok) {
        return res.status(502).json({
            ok: false,
            error: "AI service error",
            details: payload
        });
    }

    let content = payload?.choices?.[0]?.message?.content || "{}";

    content = content
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

    console.log("AFTER CLEAN:");
    console.log(content);

    let assessment;

    try {
      console.log("RAW CONTENT:");
      console.log(content);
        try {
    assessment = JSON.parse(content);
} catch (e) {

    console.log("Parse failed");

    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");

    if (start !== -1 && end !== -1) {
        assessment = JSON.parse(content.substring(start, end + 1));
    } else {
        throw e;
    }
}
    } catch {
        assessment = {
            riskLevel: "Unknown",
            score: "N/A",
            explanation: content,
            warnings: []
        };
    }

    const record = {
      fullName,
      mobileNumber,
      dateOfBirth,
      requestedLoanAmount,
      monthlyNetSalary,
      currentMonthlyEmi,
      annualIncome: hasAnnualIncome ? annualIncome : null,
      incomeCertificateFileName: incomeCertificateFileName || null,
      insuranceClaimDocumentFileName: insuranceClaimDocumentFileName || null,
      loanApplicationFileName: loanApplicationFileName || null,
      governmentIdFileName: governmentIdFileName || null,
      salarySlipFileName: salarySlipFileName || null,
      bankStatementFileName: bankStatementFileName || null,
      ruleBasedEligible,
      salaryRatio,
      warnings,
      assessment,
      createdAt: new Date().toISOString(),
    };

    if (dbAvailable && mongoEligibilityCollection) {
      try {
        await mongoEligibilityCollection.insertOne(record);
      } catch (mongoError) {
        console.error('Failed to save eligibility record to MongoDB:', mongoError);
      }
    } else {
      localEligibilityStore.unshift(record);
      if (localEligibilityStore.length > 20) {
        localEligibilityStore.pop();
      }
    }

    return res.status(200).json({
      ok: true,
      assessment,
      ruleBasedEligible,
      warnings,
    });
  } catch (error) {
    console.error("===== ELIGIBILITY ERROR =====");
    console.error(error);
    console.error(error.stack);

    return res.status(500).json({
      ok: false,
      error: error.message,
      stack: error.stack,
    });
  }
});

app.get('/api/eligibility/latest', async (req, res) => {
  try {
    if (dbAvailable && mongoEligibilityCollection) {
      const latest = await mongoEligibilityCollection.find().sort({ createdAt: -1 }).limit(1).toArray();
      return res.json({ ok: true, record: latest[0] || null });
    }

    return res.json({ ok: true, record: localEligibilityStore[0] || null });
  } catch (error) {
    console.error('Failed to retrieve latest eligibility record:', error);
    return res.status(500).json({ ok: false, error: 'Unable to fetch latest eligibility record.' });
  }
});

app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Not found' });
});

app.use((error, req, res, next) => {
  console.error('Unhandled server error:', error);
  res.status(500).json({ ok: false, error: 'Internal server error.' });
});

await initMongo();

app.listen(port, () => {
  console.log(`FinShield server listening on port ${port}`);
});

