# Vaulta

## Overview

Vaulta is a secure, AI-forward digital vault platform designed to help users manage, protect, and interact with sensitive information in a modern, scalable way. The platform is built with a globally distributed frontend, a PostgreSQL-backed secure data layer, and serverless infrastructure to support rapid iteration and future growth.

Vaulta is currently in active development and early user acquisition.

---

## Tech Stack

### Frontend

* React (Vite)
* TypeScript
* Tailwind CSS
* Deployed on Netlify (global CDN)

### Backend

* Supabase (PostgreSQL, Auth, Storage)
* Row Level Security (RLS) enabled

### Services

* Railway (isolated backend services)

### Distribution

* Web Application
* Progressive Web App (PWA) for desktop and mobile

---

## Features

* Secure authentication and session management
* Encrypted data storage and access control
* Scalable PostgreSQL database
* Serverless-friendly architecture
* Mobile- and desktop-ready via PWA

---

## Environment Configuration

This project uses environment variables for configuration. **Sensitive values are never committed to the repository.**

Example:

```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_public_anon_key
```

---

## Development

### Install Dependencies

```bash
npm install
```

### Run Locally

```bash
npm run dev
```

### Build for Production

```bash
npm run build
```

---

## Deployment

* Source of truth: GitHub
* Automatic deployments via Netlify
* Backend services managed via Supabase and Railway

---

## Ownership & Licensing

**Copyright © Jonathan McEwen. All rights reserved.**

This repository, including but not limited to all source code, documentation, architecture, designs, concepts, and intellectual property contained herein, is the exclusive property of **Jonathan McEwen**.

### Exclusive License

No license is granted to any individual, organization, or entity other than **Jonathan McEwen**. This project is **not open source**.

You may **not**:

* Copy, modify, distribute, sublicense, or sell any portion of this code
* Use this code or derivative works for commercial or non-commercial purposes
* Deploy, host, or reproduce this project or its components

without **explicit written permission** from Jonathan McEwen.

### Reservation of Rights

All rights not expressly granted are fully reserved by the owner.

---

## Legal Notice

This repository is provided for private development, evaluation, and demonstration purposes only by the owner. Unauthorized use may result in legal action.

---

## Contact

**Jonathan McEwen**
Creator & Owner, Vaulta

For licensing inquiries or permissions, contact the owner directly.

---

*This README does not constitute a public license or an offer to license.*
