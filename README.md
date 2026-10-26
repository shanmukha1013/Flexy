<div align="center">

# Flexy

### Every collectible has a story. Every collector deserves a marketplace.

A modern marketplace built for collectors to discover, buy, sell, and showcase valuable collectibles in one place.

**Live Demo:** https://flexy-peach.vercel.app

</div>

---

# Overview

Collecting is more than buying and selling—it's about passion, community, and preserving valuable items.

Flexy brings collectors together through a modern marketplace where users can explore unique collections, list their own items, and connect with people who share the same interests.

Built from idea to deployment, Flexy focuses on creating a simple, fast, and enjoyable experience for every collector.

---

# Why I Built Flexy

I wanted to create a dedicated platform where collectors could easily discover, buy, sell, and showcase collectibles without the complexity of traditional marketplaces.

Building Flexy helped me improve my skills in Full-Stack Development, product design, authentication, database management, and deployment.

---

# Features

- Secure user authentication
- Buy and sell collectibles
- Item listings with images
- Explore marketplace
- User profiles
- Responsive design
- Modern user interface
- Smooth browsing experience

---

# Tech Stack

### Frontend

- HTML, CSS and vanilla JavaScript (multi-page app in `public/`)
- Socket.IO client for live bids and direct messages

### Backend

- Node.js with Express 5
- Socket.IO for real-time updates
- JWT access tokens with HttpOnly refresh-token cookies
- Passwordless email login (one-time codes) delivered through Resend

### Database

- MongoDB with Mongoose

### Deployment

- Vercel (static frontend)
- Render (API and Socket.IO server)

---

# Running Locally

Requirements: Node.js 22.12 or newer (required by the Resend SDK), and a MongoDB database (local or Atlas).

```bash
npm ci
cp .env.example .env      # then fill in the values you need
npm start                 # or: npm run dev (restarts on file changes)
```

Open http://localhost:3001. `GET /api/health` reports whether the database and email
provider are connected.

Without a Resend API key, the server still starts but email login returns
`503 Email sign-in is temporarily unavailable`. To try the login flow locally without
an email account, set `EMAIL_TRANSPORT=console` in `.env`: codes are printed to the
server log instead of being emailed. The server refuses to start with that setting
in production.

### Configuration

All variables are documented in [`.env.example`](.env.example). In production
(`NODE_ENV=production`) the server refuses to start unless `MONGODB_URI`, `JWT_SECRET`
and `JWT_REFRESH_SECRET` are set, and the secrets are at least 32 characters, differ
from each other and are not known placeholder values.

Resend's default sender (`onboarding@resend.dev`) only delivers to the email address
that owns the Resend account. To send codes to other people, verify a domain in Resend
and set `EMAIL_FROM`.

---

# How Sign-In Works

Flexy uses passwordless email sign-in. Entering a new address creates the account and
continues to profile setup; an existing address signs straight in.

1. `POST /api/auth/request-otp` validates the email, generates a six-digit code with
   `crypto.randomInt`, stores only an HMAC of it (bound to the email) and sends it with
   Resend. The response is `200` only after Resend accepts the message; otherwise `502`
   (provider error), `503` (no provider configured, or Resend rate limit) or `429`.
2. The login page shows the code screen only after that `200`.
3. `POST /api/auth/verify-otp` checks the code. A code expires after 5 minutes, works
   once, and allows 5 attempts. Requesting a new code invalidates the previous one.
4. On success the API returns a 15-minute access token and sets a 30-day HttpOnly
   refresh cookie. Logout revokes refresh tokens on the server.

Abuse limits: one code per email per 60 seconds, 10 per email per hour, and per-IP
limits on both endpoints. The per-IP counters live in memory, so they are per server
instance; that is fine for a single Render instance but would need a shared store
(such as Redis) if the API is scaled out.

### Setting up real email delivery

1. Create an API key in the Resend dashboard and set `RESEND_API_KEY`.
2. To email anyone other than yourself, add and verify your domain in Resend
   (DNS records), then set `EMAIL_FROM`, for example `Flexy <login@yourdomain.com>`.
3. Check the setup without starting the app:

   ```bash
   npm run email:check -- you@example.com
   ```

   It sends one sample email and reports whether Resend accepted it, with a hint for
   common rejections. Acceptance is not proof of inbox delivery; confirm in your inbox
   or on the Emails page of the Resend dashboard.

---

# Testing

```bash
npm test                  # everything
npm run test:unit         # configuration, email service, OTP and validation helpers
npm run test:integration  # API, authentication, Resend SDK over HTTP, Socket.IO, server startup
npm run check             # syntax check of every JavaScript file
```

Integration tests run against a temporary in-memory MongoDB
([mongodb-memory-server](https://github.com/typegoose/mongodb-memory-server)), with either
a fake email service or the real Resend SDK pointed at a local stand-in for the Resend
API. They never send email or touch a real database. The first run downloads
a MongoDB binary (about 70 MB) unless one is already cached.

---

# Live Demo

https://flexy-peach.vercel.app

---

# What I Learned

Building Flexy improved my understanding of:

- Full-Stack Development
- Authentication systems
- Database design
- REST API development
- Product thinking
- Deployment
- Building scalable web applications

---

# Future Improvements

- Live auctions
- AI-powered item recommendations
- Secure online payments
- Wishlist
- Seller ratings and reviews
- Mobile application

---

# Connect

**Portfolio**  
https://shanmukha-portfolio-six.vercel.app

**LinkedIn**  
https://linkedin.com/in/marellashanmukhareddy

---

<div align="center">

**From Ideas to Products.**

</div>
