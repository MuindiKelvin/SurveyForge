# SurveyForge

Build surveys, share links that expire after 24 hours, collect responses in Firebase, and download the results as Excel or PDF.

**Stack:** React 18 (Vite) · React Router · Bootstrap 5 + Bootstrap Icons · Firebase Auth + Firestore + Hosting · Chart.js · jsPDF · docx · SheetJS

## Features

- **Sign in** with Google or email + password (Firebase uses the email as the username). Password reset included.
- **Survey builder** with these question types: short answer, paragraph, multiple choice, checkboxes (optional "select up to N"), dropdown, rating scale, yes/no, grid (rows x choices), number, date, email and section headings.
  Add, edit, reorder, duplicate and delete questions; paste many options at once; preview exactly what respondents see.
- **Creation progress charts**: completion ring, questions-by-type chart, question-status chart and a checklist. "Mark complete" unlocks at 100%.
- **Team collaboration**: every signed-in user sees **all** surveys and **all** results, and can edit, duplicate and share any survey. The dashboard shows who created each survey and who saved it last, with an *All surveys / Created by me* filter.
- **Save** drafts and complete surveys. Duplicate from the dashboard; only the person who created a survey can delete it.
- **Edit-conflict protection**: if a teammate saves a survey while you are editing it, you are asked before your save replaces theirs.
- **Download the survey** as PDF or Word (.docx).
- **Branded documents**: every PDF and Word file (survey and results) carries the Payoneer circular logo and company name at the top of every page, and the company contact line plus page numbers in the footer. The Excel results workbook has the company name and contact line at the top of its Summary sheet.
- **Share links** that stop working 24 hours after creation (enforced by the Firestore security rules using the server clock). Copy, WhatsApp, email, or remove a link early.
- **Public survey page** - respondents need no account; answers are stored in Firestore.
- **Results** page with charts per question, a table of individual responses, and downloads as **Excel (.xlsx)** and **PDF**.
- Responsive - works on phones, tablets and desktops.
- A ready-made **Owner Business Diagnostic** template (43 questions, 10 sections).

## Requirements

- Node.js 18 or newer (`node -v`)
- A free Google account for Firebase

## Quick start

```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env
# open .env and paste your Firebase web-app values (see step 2 below)
npm run dev               # http://localhost:5173
```

Until `.env` is filled in, the app shows a "Connect your Firebase project" notice instead of crashing.

## Firebase setup (one time)

1. **Create a project** at <https://console.firebase.google.com> (Add project).
2. **Register a web app**: Project settings -> General -> *Your apps* -> `</>` Web. Copy the config values into `.env`:
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```
3. **Enable sign-in**: Build -> Authentication -> Get started -> Sign-in method -> enable **Google** (choose a support email) and **Email/Password**.
4. **Create the database**: Build -> Firestore Database -> Create database (production mode, pick a region close to your users).
5. **Install the Firebase CLI and connect the folder**:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add        # choose your project, alias "default"
   ```
6. **Deploy the security rules** (required - without them nothing can be read or saved):
   ```bash
   npm run deploy:rules
   ```
7. **Try it locally** with `npm run dev`, then deploy to Firebase Hosting:
   ```bash
   npm run deploy            # builds, then deploys hosting + rules
   ```
   Your site is live at `https://<project-id>.web.app`.

If you use a custom domain, add it under Authentication -> Settings -> **Authorized domains** so Google sign-in works there.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the automated tests |
| `npm run deploy` | Build, then deploy hosting + Firestore rules |
| `npm run deploy:rules` | Deploy only the Firestore rules |
| `npm run deploy:hosting` | Build, then deploy only hosting |

## How sharing and results work

- Finishing a survey sets its status to **complete**. Only complete surveys can be shared. Any teammate can create or remove share links for any survey.
- **Create 24-hour link** writes a document to `shares/{randomId}` containing a *snapshot* of the survey and a server timestamp. The link is `https://your-site/s/{randomId}` (24 random characters, not guessable).
- The security rules only allow reading a share while `now < createdAt + 24h`, and only allow adding a response while the share exists and is under 24 hours old. After that the page shows "This survey link has expired". Removing a link revokes it immediately.
- Editing a survey later does **not** change links that already exist - create a new link to share the updated version.
- Responses are saved under `surveys/{surveyId}/responses`. Every signed-in teammate can read them; only the survey's creator can delete them. Responses from all of a survey's links are combined in the results.

### Data model

```
surveys/{surveyId}            ownerId (creator), ownerName, updatedByName, title, description, status, questions[], createdAt, updatedAt
surveys/{surveyId}/responses/{id}   shareId, answers{ [questionId]: value }, submittedAt
shares/{shareId}              surveyId, ownerId (who made the link), createdByName, title, description, questions[], createdAt
```

## Project structure

```
src/
  pages/        Login, Dashboard, SurveyBuilder, SurveyDetail (share + downloads), SurveyResults, PublicSurvey
  components/   navbar, modal, question editor, progress charts, respondent form, result cards
  services/     Firestore access (surveys, shares, responses)
  context/      auth + toast providers
  utils/        survey model/validation, answers, analysis, PDF/Word/Excel exporters
  templates/    Owner Business Diagnostic starter survey
  config/       company.js - company name, contact details and brand colours printed on documents
  assets/       payoneer-logo-circle.png (used on documents) and payoneer-logo.png (original banner)
  test/         component and page tests
firestore.rules  security rules        firebase.json  hosting + rules config
```

## Company branding on documents

- Company details live in `src/config/company.js` (name, website, phone, email, location). Edit them there and every PDF / Word / Excel export updates.
- The logo is `src/assets/payoneer-logo-circle.png`. To change it, replace that file with a **square PNG with transparent corners** (a circular crop). It is embedded into the documents at build time, so exports work offline.
- Shared PDF letterhead/footer code: `src/utils/pdfBranding.js`. Word header/footer: `brandHeader()` / `brandFooter()` in `src/utils/exportSurveyDocx.js`.

## Who can see what (important)

Anyone can create an account on the login page, and **every signed-in user can read every survey and result**. That is what lets your team collaborate, but it also means a stranger who signs up would see everything. Once your team members have registered, turn off new sign-ups in the Firebase console (look under Authentication -> Settings for the option that disables account creation), or add an email allow-list to `firestore.rules`.

After pulling this update, redeploy the security rules: `npm run deploy:rules`.

## Notes and limits

- Anyone with a valid link can submit - there is no one-response-per-person check.
- The results screen loads the newest 5,000 responses per survey. The PDF report lists the first 200 individual responses; the Excel file contains all loaded responses.
- PDF files use a built-in font that covers Latin characters (English, Swahili, French, etc.). Other scripts are replaced with `?` in PDFs; Word and Excel keep them.
- Firestore's free tier is generous, but viewing the dashboard and results reads documents (one count query per survey on the dashboard).
- Keep `.env` private to your own machine/CI. Firebase web config values are not secret, but they identify your project.

## Troubleshooting

- **"Connect your Firebase project" screen** - `.env` is missing or still has placeholder values. Restart `npm run dev` after editing it.
- **"Missing or insufficient permissions"** - the rules are not deployed: run `npm run deploy:rules`.
- **Google pop-up blocked or "unauthorized domain"** - allow pop-ups, and add your domain in Authentication -> Settings -> Authorized domains.
- **`firebase use --add` finds no project** - run `firebase login` first and make sure you are using the same Google account.
