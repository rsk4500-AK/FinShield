import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, test, expect, vi } from 'vitest';
import App from './App';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.restoreAllMocks();
});

test('renders the main hero headline and workflow section', () => {
  render(<App />);

  expect(screen.getByRole('heading', { name: /protect customers before risk turns into default/i })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /a complete ai workflow from document intake to human decision support/i })).toBeInTheDocument();
});

test('shows the login form and enters the customer dashboard after a successful login', () => {
  render(<App />);

  fireEvent.click(screen.getByRole('button', { name: /^login$/i }));
  fireEvent.change(screen.getByLabelText(/employee id/i), { target: { value: 'EMP-1001' } });
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@example.com' } });
  fireEvent.click(screen.getAllByRole('button', { name: /login/i })[1]);

  expect(screen.getByRole('heading', { name: /customer onboarding dashboard/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/customer name/i)).toBeInTheDocument();
});

test('shows an error message for an invalid login attempt', () => {
  render(<App />);

  fireEvent.click(screen.getByRole('button', { name: /^login$/i }));
  fireEvent.change(screen.getByLabelText(/employee id/i), { target: { value: 'EMP-1001' } });
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'not-an-email' } });
  fireEvent.click(screen.getAllByRole('button', { name: /login/i })[1]);

  expect(screen.getByText(/please enter a valid employee id and email/i)).toBeInTheDocument();
});

test('does not render the removed solution section', () => {
  render(<App />);

  expect(screen.queryByRole('link', { name: /^solution$/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: /the problem/i })).not.toBeInTheDocument();
});

test('shows the customer eligibility assessment form with the requested fields', () => {
  render(<App />);

  expect(screen.getByRole('heading', { name: /customer eligibility check/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/full name of customer/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/mobile number/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/requested loan amount/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/monthly net salary/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/current monthly emi/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/date of birth/i)).toBeInTheDocument();
});

test('syncs queued onboarding records to the remote endpoint', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  vi.stubGlobal('fetch', fetchMock);

  render(<App />);

  fireEvent.click(screen.getByRole('button', { name: /^login$/i }));
  fireEvent.change(screen.getByLabelText(/employee id/i), { target: { value: 'EMP-1001' } });
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@example.com' } });
  fireEvent.click(screen.getAllByRole('button', { name: /login/i })[1]);

  fireEvent.change(screen.getByLabelText(/customer name/i), { target: { value: 'Priya Nair' } });
  fireEvent.change(screen.getByLabelText(/aadhaar card number/i), { target: { value: '123456789012' } });
  fireEvent.change(screen.getAllByLabelText(/date of birth/i)[0], { target: { value: '1992-04-10' } });
  fireEvent.change(screen.getByLabelText(/pan card number/i), { target: { value: 'ABCDE1234F' } });
  fireEvent.change(screen.getByLabelText(/address/i), { target: { value: '123 Main Street' } });
  fireEvent.change(screen.getByLabelText(/income certificate \(annual\)/i), { target: { value: '800000' } });
  fireEvent.click(screen.getByRole('button', { name: /submit customer/i }));
  fireEvent.click(screen.getByRole('button', { name: /sync to database/i }));

  expect(fetchMock).toHaveBeenCalledWith(
    '/api/sync',
    expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
      }),
    })
  );

  expect(await screen.findByText('Sync completed.')).toBeInTheDocument();
});

test('uses the configured API key when checking eligibility', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ id: 'meta/llama-3.1-8b-instruct' }] }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"riskLevel":"medium","score":62,"explanation":"Customer looks moderately risky based on debt load and salary."}' } }],
      }),
    });

  vi.stubEnv('VITE_API_KEY', 'test-key');
  vi.stubGlobal('fetch', fetchMock);

  render(<App />);

  fireEvent.change(screen.getByLabelText(/full name of customer/i), { target: { value: 'Asha Rao' } });
  fireEvent.change(screen.getByLabelText(/mobile number/i), { target: { value: '9876543210' } });
  fireEvent.change(screen.getByLabelText(/requested loan amount/i), { target: { value: '500000' } });
  fireEvent.change(screen.getByLabelText(/monthly net salary/i), { target: { value: '100000' } });
  fireEvent.change(screen.getByLabelText(/current monthly emi/i), { target: { value: '20000' } });
  fireEvent.change(screen.getByLabelText(/^date of birth$/i), { target: { value: '1990-01-01' } });
  fireEvent.click(screen.getByRole('button', { name: /check eligibility/i }));

  expect(fetchMock).toHaveBeenCalledWith(
    'https://integrate.api.nvidia.com/v1/chat/completions',
    expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: expect.stringContaining('Bearer '),
      }),
    })
  );

  expect(await screen.findByText(/risk level: medium/i)).toBeInTheDocument();
});
