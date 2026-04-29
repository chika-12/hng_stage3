# Insighta Labs+ Profiles API

A secure, production-ready RESTful API serving African profile data with GitHub OAuth authentication, role-based access control, natural language search, CSV export, and full pagination support.

Built with **Node.js**, **Express**, and **MongoDB (Mongoose)**. Deployed on **Railway**.

**Base URL:**

```
https://hngintern-production-7bfd.up.railway.app/api/v1
```

---

## Table of Contents

- [System Architecture](#system-architecture)
- [Authentication Flow](#authentication-flow)
- [CLI Usage](#cli-usage)
- [Token Handling Approach](#token-handling-approach)
- [Role Enforcement Logic](#role-enforcement-logic)
- [Natural Language Parsing Approach](#natural-language-parsing-approach)
- [API Reference](#api-reference)
- [Filters](#filters)
- [Sorting](#sorting)
- [Pagination](#pagination)
- [Error Handling](#error-handling)
- [Performance](#performance)
- [Getting Started](#getting-started)

---

## System Architecture

The API is structured in clean, separated layers — each with a single responsibility:

```
insighta-backend/
├── controllers/
│   ├── authController.js        # GitHub OAuth, token refresh, logout
│   └── profileControllers.js   # Profile CRUD, search, export
├── middleware/
│   ├── protectMiddleWare.js     # JWT verification + RBAC
│   └── globalErrorHandler.js   # Centralized error handling
├── models/
│   ├── user.js                  # User schema (GitHub OAuth users)
│   └── usermodel.js             # Profile schema
├── route/
│   ├── authRoute.js             # /api/v1/auth/*
│   └── profileRoute.js          # /api/v1/profiles/*
├── queryFeatures/
│   ├── features.js              # Filter + sort + pagination builder
│   ├── searchParser.js          # Natural language query parser
│   └── validateQuery.js         # Query parameter validation
├── utils/
│   ├── pkce.js                  # PKCE code verifier + challenge generator
│   ├── generateToken.js         # JWT access + refresh token generators
│   ├── catchAsync.js            # Async error wrapper
│   └── appError.js              # Custom error class
├── app.js                       # Express app setup + middleware stack
└── server.js                    # Server entry point
```

**Middleware stack (applied globally):**

| Middleware               | Purpose                                  |
| ------------------------ | ---------------------------------------- |
| `helmet`                 | Sets secure HTTP headers                 |
| `xss-clean`              | Sanitizes user input against XSS attacks |
| `hpp`                    | Prevents HTTP parameter pollution        |
| `express-mongo-sanitize` | Blocks NoSQL injection via `$` operators |
| `express-rate-limit`     | Limits each IP to 500 requests per hour  |
| `cookie-parser`          | Parses cookies for OAuth state and PKCE  |

---

## Authentication Flow

Authentication uses **GitHub OAuth 2.0 with PKCE** (Proof Key for Code Exchange). PKCE prevents authorization code interception attacks by binding the token exchange to the client that started the flow.

### Web Flow

```
1. Client visits:    GET /api/v1/auth/github
2. Backend:          generates PKCE pair (verifier + challenge)
                     generates random state value
                     stores verifier, state, source in httpOnly cookies
                     redirects to GitHub OAuth authorization page
3. GitHub:           user logs in and grants permission
4. GitHub:           redirects to /api/v1/auth/github/callback?code=...&state=...
5. Backend:          validates state matches cookie (CSRF protection)
                     exchanges code + code_verifier with GitHub for access token
                     fetches user profile and email from GitHub API
                     creates or updates user in MongoDB (upsert by githubId)
                     generates JWT access token (15 min) + refresh token (7 days)
                     saves refresh token to user document in MongoDB
                     sets access_token and refresh_token as httpOnly cookies
                     redirects to WEB_PORTAL_URL
```

### CLI Flow

```
1. CLI opens:        GET /api/v1/auth/github?source=cli
2. Backend:          same as web flow but stores source=cli in cookie
3. After GitHub:     detects source=cli from cookie
                     redirects to: http://localhost:4242/?accessToken=...&refreshToken=...
4. CLI:              local server on port 4242 catches the redirect
                     reads tokens from URL query params
                     saves them to ~/.insighta/tokens.json
```

The `source=cli` parameter is what tells the backend to deliver tokens via URL redirect to the CLI's local server instead of setting httpOnly cookies for the browser.

### Token Refresh

```
POST /api/v1/auth/refresh
Body: { "refreshToken": "..." }

Response: { "accessToken": "..." }
```

The backend verifies the refresh token's signature and checks it matches the one stored in the user's MongoDB document. On success it returns a new access token.

---

## CLI Usage

A dedicated CLI tool — `insighta_adv_cli` — is published on npm and talks directly to this API.

### Install

```bash
npm install -g insighta_adv_cli
```

### Commands

```bash
insighta login                                    # Authenticate via GitHub OAuth
insighta logout                                   # Clear local session
insighta whoami                                   # Show currently logged in user

insighta profiles list                            # List all profiles
insighta profiles list --page 2                   # Paginate
insighta profiles list --limit 10                 # Set page size
insighta profiles list --sort name                # Sort by field
insighta profiles list --search "women from ghana" # Natural language search

insighta profiles get <id>                        # Get single profile by ID
insighta profiles export                          # Export all profiles to CSV (admin only)
insighta profiles export -o myfile.csv            # Export with custom filename
```

### Source Code

```
https://github.com/chika-mark/insighta-cli
```

---

## Token Handling Approach

The API issues two tokens on successful authentication:

| Token         | Expiry     | Purpose                                                   |
| ------------- | ---------- | --------------------------------------------------------- |
| Access Token  | 15 minutes | Sent with every API request in the `Authorization` header |
| Refresh Token | 7 days     | Used to obtain a new access token without re-login        |

### Access Token

Generated with `jsonwebtoken` and contains:

```json
{ "id": "user._id", "role": "user.role" }
```

Sent by clients as:

```
Authorization: Bearer <accessToken>
```

The `protectMiddleWare` extracts and verifies this token on every protected route. It reads from the `Authorization` header first, then falls back to the `access_token` cookie for web clients.

### Refresh Token

Stored in two places:

- **MongoDB** — on the user's document (`user.refreshToken`)
- **Client** — in `~/.insighta/tokens.json` for CLI, or `refresh_token` httpOnly cookie for web

On refresh, the backend verifies the token's signature AND checks it matches the stored value in MongoDB. This means refresh tokens can be explicitly revoked by setting `user.refreshToken = null` on logout.

### Logout

```
POST /api/v1/auth/logout
Body: { "refreshToken": "..." }
```

Finds the user by refresh token and sets it to `null` in MongoDB — invalidating the session server-side even if the token hasn't expired yet.

---

## Role Enforcement Logic

The API supports two roles assigned to users at the time of first login:

| Role      | Default | Assigned by                         |
| --------- | ------- | ----------------------------------- |
| `analyst` | ✅ Yes  | Automatically on first GitHub login |
| `admin`   | ❌ No   | Manually updated in MongoDB         |

### How it works

Role enforcement uses two middleware functions that work together:

**1. `protectMiddleWare`** — verifies the JWT and attaches the full user object to `req.user`:

```js
const decoded = jwt.verify(token, process.env.JWT_SECRET);
const user = await User.findById(decoded.id);
req.user = user;
```

**2. `requireRole`** — checks `req.user.role` against the allowed roles for that route:

```js
exports.requireRole = (role) => {
  return (req, res, next) => {
    if (!role.includes(req.user.role)) {
      return next(new AppError('Access denied', 403));
    }
    next();
  };
};
```

### Route Protection Table

| Route                          | Method | Protection                                     |
| ------------------------------ | ------ | ---------------------------------------------- |
| `/api/v1/auth/github`          | GET    | Public                                         |
| `/api/v1/auth/github/callback` | GET    | Public                                         |
| `/api/v1/auth/refresh`         | POST   | Public                                         |
| `/api/v1/auth/logout`          | POST   | Public                                         |
| `/api/v1/profiles`             | GET    | `protectMiddleWare`                            |
| `/api/v1/profiles`             | POST   | `protectMiddleWare` + `requireRole(['admin'])` |
| `/api/v1/profiles/search`      | GET    | `protectMiddleWare`                            |
| `/api/v1/profiles/export`      | GET    | `protectMiddleWare` + `requireRole(['admin'])` |
| `/api/v1/profiles/:id`         | GET    | `protectMiddleWare`                            |
| `/api/v1/profiles/:id`         | DELETE | `protectMiddleWare` + `requireRole(['admin'])` |

---

## Natural Language Parsing Approach

Natural language search is handled by a custom rule-based parser in `queryFeatures/searchParser.js`. It requires no AI or external APIs — it uses keyword matching and a country name lookup table to convert plain English into MongoDB filters.

### How it works

The parser scans the query string for known keywords and maps them to filter fields:

**Gender detection:**

```
"women", "female", "girls"  →  gender: "female"
"men", "male", "boys"       →  gender: "male"
```

**Age group detection:**

```
"young", "youth"    →  age_group: "teenager", min_age: 16, max_age: 24
"adult", "adults"   →  age_group: "adult"
"senior", "elderly" →  age_group: "senior"
"child", "children" →  age_group: "child"
```

**Age range detection:**

```
"above 30"         →  min_age: 30
"under 25"         →  max_age: 25
"between 20 and 40" →  min_age: 20, max_age: 40
```

**Country detection:**

```
"from ghana"   →  country_id: "GH"
"from nigeria" →  country_id: "NG"
"from kenya"   →  country_id: "KE"
```

A full country name → ISO code lookup table maps country names to their 2-letter codes.

### Example

```
Query:    "elderly women from ghana"

Parsed:   {
            gender: "female",
            age_group: "senior",
            country_id: "GH"
          }

MongoDB:  Profile.find({ gender: "female", age_group: "senior", country_id: "GH" })
```

The response always includes an `interpreted` field showing exactly what the parser extracted — useful for debugging:

```json
{
  "status": "success",
  "query": "elderly women from ghana",
  "interpreted": {
    "gender": "female",
    "age_group": "senior",
    "country_id": "GH"
  },
  "data": [...]
}
```

### Endpoint

```
GET /api/v1/profiles/search?q=elderly women from ghana
```

---

## API Reference

### Auth Routes

| Method | Route                          | Description               |
| ------ | ------------------------------ | ------------------------- |
| GET    | `/api/v1/auth/github`          | Start GitHub OAuth flow   |
| GET    | `/api/v1/auth/github/callback` | GitHub OAuth callback     |
| POST   | `/api/v1/auth/refresh`         | Refresh access token      |
| POST   | `/api/v1/auth/logout`          | Logout and revoke session |

### Profile Routes

| Method | Route                     | Description             | Role  |
| ------ | ------------------------- | ----------------------- | ----- |
| GET    | `/api/v1/profiles`        | List all profiles       | Any   |
| POST   | `/api/v1/profiles`        | Create a profile        | Admin |
| GET    | `/api/v1/profiles/search` | Natural language search | Any   |
| GET    | `/api/v1/profiles/export` | Export profiles as CSV  | Admin |
| GET    | `/api/v1/profiles/:id`    | Get profile by ID       | Any   |
| DELETE | `/api/v1/profiles/:id`    | Delete profile by ID    | Admin |

---

## Filters

Available on `GET /api/v1/profiles`:

| Parameter                 | Type        | Description                            | Example                        |
| ------------------------- | ----------- | -------------------------------------- | ------------------------------ |
| `gender`                  | string      | `male` or `female`                     | `?gender=female`               |
| `age_group`               | string      | `child`, `teenager`, `adult`, `senior` | `?age_group=adult`             |
| `country_id`              | string      | 2-letter ISO code                      | `?country_id=NG`               |
| `min_age`                 | number      | Minimum age (inclusive)                | `?min_age=18`                  |
| `max_age`                 | number      | Maximum age (inclusive)                | `?max_age=60`                  |
| `min_gender_probability`  | float (0–1) | Minimum gender confidence              | `?min_gender_probability=0.75` |
| `min_country_probability` | float (0–1) | Minimum country confidence             | `?min_country_probability=0.5` |

All filters are combinable.

---

## Sorting

Use the `sort` parameter. Prefix with `-` for descending order.

```
GET /api/v1/profiles?sort=age          # ascending
GET /api/v1/profiles?sort=-age         # descending
GET /api/v1/profiles?sort=country_id,-age  # multiple fields
```

Default sort: `-created_at` (newest first).

---

## Pagination

| Parameter | Default | Max | Description      |
| --------- | ------- | --- | ---------------- |
| `page`    | 1       | —   | Page number      |
| `limit`   | 10      | 50  | Records per page |

All paginated responses include:

```json
{
  "total": 200,
  "page": 2,
  "limit": 10,
  "totalPages": 20,
  "hasNextPage": true,
  "hasPrevPage": true
}
```

---

## Error Handling

All errors follow a consistent structure:

```json
{
  "status": "error",
  "message": "<description>"
}
```

| Status Code | Meaning                           |
| ----------- | --------------------------------- |
| `400`       | Missing or invalid parameter      |
| `401`       | Not logged in or token expired    |
| `403`       | Access denied — insufficient role |
| `404`       | Resource not found                |
| `422`       | Invalid parameter type            |
| `500`       | Internal server error             |

---

## Performance

- **`.lean()`** on all Mongoose queries — returns plain JS objects, reducing memory overhead
- **`Promise.all`** for parallel `find()` and `countDocuments()` — both run simultaneously
- **Database indexes** on `gender`, `country_id`, `age_group`, and a compound index on all three — eliminates full collection scans
- **Pagination cap** at 50 records per request — prevents large payload responses

---

## Getting Started

### Prerequisites

- Node.js v18+
- MongoDB Atlas account
- GitHub OAuth App

### Installation

```bash
git clone <repo-url>
cd insighta-backend
npm install
```

### Environment Variables

```env
NODE_ENV=development
PORT=5000
DATABASE=mongodb+srv://username:<PASSWORD>@cluster.mongodb.net/profiles
PASSWORD=your_mongodb_password
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=https://your-domain.com/api/v1/auth/github/callback
WEB_PORTAL_URL=https://your-web-portal.com
```

### Run

```bash
# Development
npm run dev

# Production
npm start
```

---

## License
