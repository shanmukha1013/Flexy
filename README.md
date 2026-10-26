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

- Secure username/email and password sign-in
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
- Username/email and password sign-in, with passwords hashed using Argon2id
- JWT access tokens with HttpOnly refresh-token cookies

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

Open http://localhost:3001 and create an account at `/signup.html`.
`GET /api/health` reports whether the database is connected. No email provider
is needed.

### Configuration

All variables are documented in [`.env.example`](.env.example). In production
(`NODE_ENV=production`) the server refuses to start unless `MONGODB_URI`, `JWT_SECRET`
and `JWT_REFRESH_SECRET` are set, and the secrets are at least 32 characters, differ
from each other and are not known placeholder values.

`RESEND_API_KEY`, `EMAIL_FROM` and `EMAIL_TRANSPORT` belonged to the retired email-code
sign-in. They are ignored; if they are still set, startup logs their names (never their
values) so they can be removed.

---

# How Sign-In Works

**Sign up** (`/signup.html`, `POST /api/auth/signup`): full name, username, phone
number, email, password and confirmation. Every field is validated in the browser and
again on the server.

- Usernames: 3-30 letters, numbers, underscores or periods, stored lowercase, unique in
  any letter case. A few names that could impersonate Flexy (`admin`, `support`, ...)
  are reserved.
- Emails are trimmed and lowercased, and unique (database index).
- Phone numbers are stored as `+` and digits. They are contact details only: never
  verified, never used to sign in, never shown to other members, and not unique.
- Passwords: 8-128 characters with at least one letter and one number, not a common
  password, and not the same as the username or email. They are hashed with Argon2id
  (19 MiB, 2 passes; OWASP's recommended minimum) and never stored or returned in any
  other form. Hashes with outdated parameters are upgraded on the next login.

Nothing is marked as verified at signup. The new account goes straight to profile setup.

**Log in** (`/login.html`, `POST /api/auth/login`): one field for the username or email,
plus the password. A wrong password, an unknown account and an account without a password
all get the same answer (`Incorrect username, email or password.`), and take the same time.

**Sessions:** the API returns a 15-minute access token (sent as a Bearer header) and
sets a 30-day refresh cookie (`HttpOnly`; `Secure` and `SameSite=None` in production
because the frontend and API are on different sites). Logging out, changing the password
or using a password link revokes every refresh token of the account. Access tokens are
stateless, so one that was already issued keeps working until it expires (at most 15
minutes). The auth endpoints refuse browser requests from origins other than the
configured frontends, which blocks cross-site request forgery against the cookie.

**Profile completion:** after signup the account must finish `/profile-setup.html`:
at least one interest is required; the photo and bio are optional. The server sets
`profileCompleted` once the requirements are met (clients cannot set it), and every
protected API route answers `403 { reason: "profile_incomplete" }` until then. Only the
session endpoints, the profile update and the password endpoints are open to
incomplete accounts. Members who finished setup before this field existed are treated
as complete.

**Rate limits** (per server instance, in memory): 20 signups per IP per hour; 20 failed
logins per IP and 10 per username or email per 15 minutes (whether or not the account
exists); 10 failed password changes or resets per IP per 15 minutes. Counters live in
memory, which suits the single Render instance but needs a shared store (such as Redis)
if the API is scaled out.

**Changing the password:** Settings, Security. Accounts without a password (see below)
can set one there while still signed in.

### Accounts from the email-code sign-in, and forgotten passwords

Accounts created with the old email codes have no password. Members who are still
signed in on some device get a reminder and can set a password in Settings. Everyone
else, and anyone who forgets their password, needs a one-time link from an operator:
Flexy does not send email, so there is no self-service "Forgot password" link.

```bash
# With MONGODB_URI pointing at the production database (for example in the Render shell):
npm run account:password-link -- <username or email>        # 60-minute link
npm run account:password-link -- shan@example.com --minutes=180
```

The script prints a link to `/reset-password.html`. It works once, cancels any earlier
link, and signs the account out everywhere when used. Only the token's SHA-256 hash is
stored. Anyone holding the link can take over the account until it expires, so send it
only when you are sure the request comes from the owner, ideally to the email address on
the account (the script prints it).

### Upgrading production from email codes

The code works with the existing data as it is. The migration makes the data explicit
and removes the unique index on `users.phone` (with it in place, a phone number that is
already on another account cannot sign up).

```bash
npm run db:migrate-auth             # dry run: reports what would change
npm run db:migrate-auth -- --apply  # applies it; safe to run more than once
```

It changes no profile data: it records `profileCompleted` (copied from the old
setup-complete flag) on accounts that lack it, drops the unique phone index and creates
missing indexes. The old `otpverifications` collection is no longer used; its records
expire on their own, and it can be dropped afterwards.

**Rolling back** to the email-code release requires `npm run db:migrate-auth -- --down --apply`
first. It removes all passwords (members would sign in with email codes again) and
recreates the phone index. Do not skip it: the old code returns whole user documents from
`GET /api/users/:id` and would expose password hashes.

---

# Testing

```bash
npm test                  # everything
npm run test:unit         # configuration, password hashing and policy, validation helpers
npm run test:integration  # API, sign-up/login/sessions, profile completion, scripts, Socket.IO, server startup
npm run check             # syntax check of every JavaScript file
```

Integration tests run against a temporary in-memory MongoDB
([mongodb-memory-server](https://github.com/typegoose/mongodb-memory-server)) and never
touch a real database. The first run downloads a MongoDB binary (about 70 MB) unless one
is already cached.

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
