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

Requirements: Node.js 20.19 or newer, and a MongoDB database (local or Atlas).

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

# Testing

```bash
npm test                  # everything
npm run test:unit         # configuration, email service, OTP and validation helpers
npm run test:integration  # API, authentication, authorization, Socket.IO, server startup
npm run check             # syntax check of every JavaScript file
```

Integration tests run against a temporary in-memory MongoDB
([mongodb-memory-server](https://github.com/typegoose/mongodb-memory-server)) and a fake
email service. They never send email or touch a real database. The first run downloads
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
