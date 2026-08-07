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
  fireEvent.change(screen.getByLabelText(/date of birth/i), { target: { value: '1990-01-01' } });
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
