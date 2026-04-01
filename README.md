# leadGen.io

LeadGen.io is an AI-powered lead generation and CRM platform designed to streamline the process of finding, analyzing, and contacting potential business clients.

## Features

### Business Discovery

- Automated search for businesses based on category and geographical area.
- Real-time progress monitoring during data extraction.
- Data enrichment including address, phone, email, and website.

### AI-Powered Outreach

- Personalized email generation using Google Gemini AI.
- Context-aware communication strategies (Social-only businesses, Weak website analysis, AI Strategy).
- Integrated email delivery system via Nodemailer.

### CRM and Lead Management

- Centralized dashboard for tracking lead status (To Contact, Email Sent, In Negotiation, Won, Lost).
- Detailed business profiles with editable contact information.
- Historical notes and next-contact scheduling.
- Opt-out/GDPR compliance management.

### Technical Excellence

- Modern, minimalist UI with Dark/Light mode support.
- Fully responsive design for desktop and mobile use.
- Social media scanner to identify Facebook and Instagram presence.

## Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS, shadcn/ui, Framer Motion.
- **Backend**: Node.js, Express.
- **Database**: SQLite (local persistence).
- **AI**: Google Gemini Pro API.
- **Outreach**: Nodemailer (Gmail integration).

## Getting Started

### Prerequisites

- Node.js (Latest LTS version recommended)
- Google Gemini API Key
- Gmail App Password (for email features)

### Installation

1. Clone the repository:

   ```bash
   git clone [repository-url]
   cd leadGen.io
   ```

2. Install dependencies for all modules:

   ```bash
   npm run install:all
   ```

3. Configure environment variables:
   Create a `.env` file in the `backend` directory:

   ```env
   PORT=3000
   GEMINI_API_KEY=your_gemini_key
   EMAIL_USER=your_gmail@gmail.com
   EMAIL_PASS=your_app_password
   MY_NAME=Your Name
   MY_PHONE=Your Phone
   ```

   Create a `.env` file in the `frontend` directory:

   ```env
   VITE_API_URL=http://localhost:3000
   ```

### Running the Application

Start both the backend and frontend simultaneously from the root directory:

```bash
npm start
```

The application will be available at `http://localhost:5173`.

## Management

### Data Privacy

The system includes built-in GDPR compliance tools, allowing for easy "Opt-out" registration to prevent future contact with specific leads.

### Social Scanning

The integrated social scanner helps identify the digital footprint of leads, allowing for more effective and personalized outreach strategies.
