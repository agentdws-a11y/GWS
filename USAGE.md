# Hyre.AI Usage Guide

A short walkthrough of the main screens. For setup, see the [README](README.md). Everything opens at http://localhost:5173.

## Logging in

Go to `/login`. HR admins and candidates use the same login page, and the app sends each person to their own side based on their role. Nobody can open any page after the landing, login and register pages without logging in first.

- HR admin (for testing): `admin@hyre.ai` / `Admin123!`
- Candidates create their own account at `/register`.

## HR panel

**Dashboard** (`/hr`)
The first page after login. It gives a quick view of hiring activity.

**Departments** (`/hr/departments`)
Add the departments first, because vacancies use them.

**Vacancies** (`/hr/vacancies`)
Lists every job. Use New Vacancy to post a role with its details and required skills. Each vacancy can be edited later.

**Applications for a vacancy** (`/hr/vacancies/:jobId/applications`)
Shows the applications for one job, ranked by match score. Each application shows the match category (Strong, Possible or Not a Fit), the skills that matched and the ones that are missing, and a warning if the AI service found a duplicate candidate. All applications across every job are also listed at `/hr/applications`.

**Candidate detail** (`/hr/applications/:applicationId`)
The full view of one application. From here HR can shortlist or reject the candidate, and download the CV.

**Scheduling an interview** (`/hr/applications/:applicationId/schedule`)
After shortlisting, HR offers time slots (Monday to Saturday, hourly from 9:00 to 17:00). The candidate then picks one of them. Booked interviews show up in `/hr/interviews`.

**Interview feedback** (`/hr/interviews/:interviewId/feedback`)
Feedback is recorded against each interview. The review page (`/hr/applications/:applicationId/review`) is where HR looks over the interview results for a candidate.

**Offer letters** (`/hr/applications/:applicationId/offer`)
HR enters the salary, start date and other terms. The system drafts the offer letter, HR edits it if needed, and then sends it.

**Assessments** (`/hr/assessments`)
Create, edit and manage online assessments. Candidate results can be opened from `/hr/assessments/results/:applicationId`.

**Analytics** (`/hr/analytics`)
Hiring activity over time, vacancy status, the candidate pipeline, and department-wise hiring. There is a month filter, and the monthly report can be exported as a CSV file.

**Admin Invites** (`/hr/admin-invites`)
Invite another HR admin by email. They get a link to create their account. This needs the email settings in the backend `.env`.

## Candidate portal

**Register and log in** (`/register`, `/login`)
Create an account with an email and a password (at least 8 characters, with an uppercase letter, a lowercase letter, a number and a special character).

**Dashboard** (`/candidate`)
An overview of the candidate's own applications and activity.

**Browse jobs** (`/candidate/jobs`)
Lists the open vacancies. Opening one (`/candidate/jobs/:jobId`) shows the details and the apply form, where the candidate uploads a PDF or DOCX resume.

**My applications** (`/candidate/applications`)
Shows where each application stands. A candidate can only see their own applications.

**Interviews** (`/candidate/interviews`)
When HR offers interview slots, the candidate picks a time here.

**Assessments** (`/candidate/assessments`)
Lists the assessments for the candidate. Each one can be taken at `/candidate/assessments/:assessmentId/take`, and the result is shown afterwards.

**Offers** (`/candidate/offers`)
Offer letters sent by HR appear here.

## A typical run through

1. HR logs in, adds a department, and posts a vacancy.
2. A candidate registers, finds the vacancy, and applies with a resume.
3. The AI service parses the resume and scores it. HR opens the vacancy's applications and sees the ranked list.
4. HR shortlists a candidate and offers interview slots. The candidate picks one.
5. After the interview, HR records the feedback.
6. HR drafts and sends the offer letter. The candidate sees it under Offers.
7. HR checks the dashboard and analytics for the numbers.