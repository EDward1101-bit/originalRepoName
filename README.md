# XMPP Chat Application

A real-time chat application built with React (frontend) and FastAPI + Slixmpp (backend).

## 🚀 Quick Start with Docker

**Requirements:** Docker Desktop installed

```bash
# 1. Clone and enter directory
git clone <repo-url>
cd originalRepoName

# 2. Setup environment
cp backend/.env.example backend/.env
# Edit backend/.env with your Supabase credentials

# 3. Start everything
docker-compose up --build
```

Access:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## 📁 Project Structure

```
├── backend/           # FastAPI + Slixmpp backend
│   ├── main.py       # API entry point
│   ├── Dockerfile    # Container configuration
│   └── .env.example  # Environment template
├── frontend/         # React + Vite frontend
│   ├── src/         # Source code
│   ├── Dockerfile   # Container configuration
│   └── .env.example # Environment template
├── docker-compose.yml # Orchestrates all services
└── DOCKER.md         # Detailed Docker guide
```

## 🔧 Development Commands

```bash
# Start services
docker-compose up

# Rebuild after changes
docker-compose up --build

# Stop services
docker-compose down

# View logs
docker-compose logs -f
```

## 📝 For Team Members

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines and [DOCKER.md](DOCKER.md) for detailed Docker setup.

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite, TypeScript, TailwindCSS |
| Backend | Python 3.12, FastAPI, Slixmpp |
| Database | Supabase (PostgreSQL) |
