# Business Loan Management System

MERN-style Business Loan Management System for managing borrowers, loans, and payments.

## Workflow

1. User creates an account with username and password.
2. User logs in.
3. The system opens the Dashboard.
4. The Loans page contains the borrower/loan form — there is no separate Customers page.
5. Enter only:
   - Borrower name
   - Amount to loan
   - How many months to pay
   - Interest amount set by the lender
6. The system automatically calculates total payable and creates payments every 15 days.
7. Payments can be recorded from each loan's payment schedule.

## Example

Loan amount: ₱500
Interest: ₱100
Term: 1 month

Total payable: ₱600
Payment schedule: 2 payments every 15 days
Payment amount: ₱300 each

## Run

### Backend

Create `server/.env` from `.env.example` and add your MongoDB Atlas URI and JWT secret.

```powershell
cd server
npm install
npm run dev
```

Backend: `http://127.0.0.1:5000`

### Frontend

In another terminal:

```powershell
cd client
npm install
npm run dev
```

Frontend: `http://127.0.0.1:5173`

## Security

Do not commit `server/.env` or expose your MongoDB password. Rotate the database password if it has been shared publicly.


## Loan Receipts
Each loan card now has a **Download Receipt** button. It generates a printable A4 PDF containing the borrower name, receipt number, loan amount, interest, total payable, term, payment frequency, paid/remaining balance, payment schedule, and signature lines. The PDF can be printed or saved from the downloaded file.

The receipt is generated in the browser, so no additional backend endpoint is required.
