# Docker Development Setup

This project runs fully in Docker. No local dependencies needed!

## Prerequisites

- **Docker Desktop** (Windows/Mac) or **Docker Engine** (Linux)
- **Docker Compose** (usually included with Docker Desktop)

### Install Docker

| OS | Installation |
|---|---|
| Windows | [Docker Desktop](https://docs.docker.com/desktop/install/windows-install/) |
| macOS | [Docker Desktop](https://docs.docker.com/desktop/install/mac-install/) |
| Linux | [Docker Engine](https://docs.docker.com/engine/install/) |

## Quick Start

### 1. Clone and Setup

```bash
git clone <repository-url>
cd originalRepoName
```

### 2. Configure Environment

Copy the example env files and add your credentials:

```bash
# Backend
cp backend/.env.example backend/.env

# Frontend (if needed)
cp frontend/.env.example frontend/.env
```

**Important**: Edit `backend/.env` and add your Supabase credentials:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Start Services

```bash
# Build and start all services
docker-compose up --build

# Or run in background
docker-compose up --build -d
```

### 4. Access the App

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |
| Prosody XMPP | localhost:5222 |
| Prosody HTTP API | http://localhost:5280 |

## Common Commands

```bash
# Start services
docker-compose up

# Start in background
docker-compose up -d

# Stop services
docker-compose down

# Rebuild after code changes
docker-compose up --build

# View logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f prosody

# Stop and remove volumes (clean slate)
docker-compose down -v
```

## Development Mode

Code changes on your host machine will be reflected in the running containers (hot-reload enabled).

### Backend
- Python files are mounted directly
- Uvicorn auto-reloads on changes

### Prosody (XMPP Server)
- Configuration mounted from `prosody/prosody.cfg.lua`
- Custom modules in `prosody/modules/`
- HTTP API available at port 5280 for user management

### Frontend
- Vite dev server with HMR enabled
- Changes appear instantly in browser

## Troubleshooting

### Port Already in Use

If port 5173 or 8000 is busy, stop the service or edit `docker-compose.yml`:

```yaml
ports:
  - "5174:5173"  # Changed host port
```

### Permission Errors (Linux)

If you get permission errors:

```bash
sudo usermod -aG docker $USER
# Then logout and login
```

### Windows/Mac Performance

For better performance on Windows/Mac, ensure:
- Docker Desktop has enough resources (8GB RAM recommended)
- WSL 2 backend enabled (Windows)

### Reset Everything

```bash
docker-compose down -v --rmi all
docker system prune -a
docker-compose up --build
```

## Project Structure

```
.
├── backend/
│   ├── Dockerfile          # Backend container
│   ├── main.py             # FastAPI entry point
│   ├── services/           # Business logic
│   ├── api/                # API routes
│   └── .env.example        # Environment template
├── frontend/
│   ├── Dockerfile          # Frontend container
│   ├── nginx.conf          # Production nginx config
│   └── .env.example        # Environment template
├── prosody/
│   ├── Dockerfile          # Prosody XMPP server
│   ├── prosody.cfg.lua     # Prosody configuration
│   └── modules/            # Custom Prosody modules
└── docker-compose.yml      # Orchestration
```

## For Team Members

1. Install Docker (link above)
2. Clone the repo
3. Copy `.env.example` files to `.env`
4. Add Supabase credentials
5. Run `docker-compose up --build`
6. Done! No other installations needed.
