# ===== ShepherdCheck Deployment Guide =====
#
# Quick deploy on Railway, Render, or any Node host.

## Prerequisites
- Node 20+
- A Twilio account (optional — SMS works without it, just logs)

## 1. Environment Variables
Copy `.env.example` to `.env` and fill in:

```
PORT=3001
JWT_SECRET=<generate a long random string>
TWILIO_ACCOUNT_SID=     # optional
TWILIO_AUTH_TOKEN=      # optional
TWILIO_PHONE_NUMBER=    # optional
```

Generate a JWT secret:
```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 2. Run
```bash
# Backend
cd backend
npm install
npm start

# Frontend (dev mode)
cd ../frontend
npm install
npm run dev
```

## 3. Production Build
```bash
cd frontend
npm run build
```

Serve the `frontend/dist` folder from your backend (or deploy to Vercel/Netlify).

## 4. Deploy to Railway
```
railway login
railway init
railway up
```

Set env vars in Railway dashboard.

## 5. Twilio Setup
1. Sign up at twilio.com
2. Buy a phone number (~$1/month)
3. Set these env vars:
   - `TWILIO_ACCOUNT_SID` — from Twilio Console
   - `TWILIO_AUTH_TOKEN` — from Twilio Console
   - `TWILIO_PHONE_NUMBER` — your purchased number (e.g. +15551234567)

That's it. Churches sign up at your URL, you approve them from the Admin tab.