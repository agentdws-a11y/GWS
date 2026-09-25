# Hyre.AI

Smart Employee Recruitment & AI Hiring System. This is my 6-week internship project for GWS Digital Services.

Hyre.AI manages hiring from job posting to offer letter. It has an HR panel, a candidate portal, and a separate Python AI service that reads each resume, scores it against the job's required skills, and checks for duplicate candidates before HR sees the application.

A short guide to the main screens is in [USAGE.md](USAGE.md).

## Tech stack

| Part | Technology |
| --- | --- |
| Frontend | React 19, Vite, React Router |
| Backend | Node.js, Express, JWT authentication, bcryptjs, multer (CV uploads), nodemailer |
| Database | MySQL (database name `hyre_ai`) |
| AI service | Python, Flask, pdfplumber, python-docx, scikit-learn |

## Project structure

```
HyreAI/
  ai-service/   Flask app: resume parsing, skill matching, scoring, duplicate check, offer letter drafts
  backend/      Express REST API, database schema, background jobs, email
  frontend/     React app for both the HR panel and the candidate portal
```

## What you need installed

- Git
- Node.js (18 or newer is recommended)
- Python (3.9 or newer is recommended)
- MySQL (5.7 or 8.0)

## Running it locally

These steps are for Windows PowerShell. Do them in this order.

### 1. Get the code

```powershell
git clone https://github.com/sineha1/HyreAI.git
cd HyreAI
```

### 2. Create the database

Make sure MySQL is running, then:

```powershell
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS hyre_ai;"
Get-Content backend\database-schema\schema.sql | mysql -u root -p hyre_ai
```

This creates all the tables.

### 3. Set up the backend environment file

Go into the backend folder, copy the example file, and fill in your own values:

```powershell
cd backend
copy .env.example .env
```

Open `.env` and set at least your MySQL password (`DB_PASSWORD`) and a long random text for `JWT_SECRET`. The email settings are only used for sending HR admin invites, so you can leave them until you want to test that.

### 4. Start the AI service (port 5001)

Open a new PowerShell window in the HyreAI folder:

```powershell
python -m venv venv
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
.\venv\Scripts\Activate.ps1
pip install -r ai-service\requirements.txt
cd ai-service
python app.py
```

The `Set-ExecutionPolicy` line is there because Windows blocks the venv activation script by default. It only applies to that one PowerShell window.

### 5. Start the backend (port 5000)

Open another PowerShell window:

```powershell
cd backend
npm install
node seed-admin.js
npm start
```

`seed-admin.js` creates the first HR admin account. You only need to run it once.

### 6. Start the frontend (port 5173)

Open a third PowerShell window:

```powershell
cd frontend
npm install
npm run dev
```

Now open http://localhost:5173 in the browser.

| Part | Port |
| --- | --- |
| AI service | 5001 |
| Backend API | 5000 |
| Frontend | 5173 |

## Logins for testing

**HR admin** (created by `seed-admin.js`)

- Email: `admin@hyre.ai`
- Password: `Admin123!`

Use this only for local testing.

There is no sample candidate, department or job in the database. To try the full flow:

1. Log in as the HR admin, create a department, then create a vacancy.
2. Log out and register a candidate account at `/register`.
3. Log in as the candidate and apply to the vacancy with a PDF or DOCX resume.

More HR admins can be added from the HR panel (Admin Invites). That sends an invite link by email, so the SMTP settings in `.env` need to be filled in for it to work.

## Backend environment variables

| Variable | What it is for |
| --- | --- |
| `DB_HOST` | MySQL host, usually `localhost` |
| `DB_PORT` | MySQL port, usually `3306` |
| `DB_USER` | MySQL username |
| `DB_PASSWORD` | MySQL password |
| `DB_NAME` | Database name, `hyre_ai` |
| `JWT_SECRET` | Secret used to sign login tokens |
| `AI_SERVICE_URL` | Address of the Python AI service, `http://127.0.0.1:5001` |
| `FRONTEND_URL` | Address of the frontend, used for links inside emails |
| `SMTP_HOST` | Email server, for example `smtp.gmail.com` |
| `SMTP_PORT` | Email server port, for example `587` |
| `SMTP_SECURE` | `true` or `false` |
| `SMTP_USER` | Email account username |
| `SMTP_PASS` | Email password (for Gmail, an app password) |
| `FROM_EMAIL` | The "from" address on emails |
| `COMPANY_NAME` | Company name used in emails |

The frontend and the AI service do not use `.env` files.

## What the AI service does

- **Resume parsing:** reads text from PDF and DOCX files and pulls out name, email, phone, skills and years of experience.
- **Skill matching:** compares the resume with the job's required skills and returns which skills matched and which are missing.
- **Ranking:** gives each application a match percentage (mostly based on skills, partly on text similarity). Scores of 75 and above are Strong, 50 to 74 are Possible, and below 50 is Not a Fit.
- **Duplicate detection:** flags applications with the same email, the same phone number, or a very similar CV. HR can review and dismiss or confirm each flag.
- **Offer letter drafting:** fills an offer letter template from the candidate, job, salary and start date. HR can edit it before sending.

Applications are parsed in the background after they are saved. If the AI service fails on one, the backend retries it automatically every 5 minutes.

## Known limitations

- AI interview question generation is not built.
- Emails are only sent for HR admin invites. There are no emails for status changes or interview reminders.