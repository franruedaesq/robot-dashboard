# How to Run the Robot Dashboard

This project has two parts that need to run simultaneously:
1. **ROS 2 Robot** — runs inside Docker (`my_robot/`)
2. **Frontend Dashboard** — runs with Node.js (project root)

---

## 1. 🐳 Start the ROS 2 Robot (Docker)

Navigate to the `my_robot/` directory:

```bash
cd my_robot
```

If you have leftover containers from a previous run, clean them up first:

```bash
docker stop mi_ros2_humble mi_ros2_humble_auto
docker rm mi_ros2_humble mi_ros2_humble_auto
docker system prune -f
```

Then build and start the container:

```bash
docker-compose up --build
```

This starts:
- **rosbridge** on port `9090` (WebSocket bridge between the dashboard and ROS 2)
- **HTTP server** on port `8080` (camera frame endpoint)
- **Radar visualizer** node publishing `/radar_image/compressed`

> **Note:** The first build will take a few minutes to install ROS 2 packages. Subsequent runs will be much faster thanks to Docker's layer cache.

---

## 2. 🖥️ Start the Frontend + Mesh Server

Open a **new terminal** and go back to the project root:

```bash
cd ..   # or cd /path/to/robot-dashboard
```

Then run:

```bash
npm start
```

This runs **two processes in parallel** (via `concurrently`):
- **Mesh relay server** — `node mesh-server.js`
- **Vite dev server** — available at [http://localhost:5173](http://localhost:5173)

---

## ✅ Expected Ports

| Service | Port | Description |
|---|---|---|
| rosbridge | `9090` | ROS ↔ Browser WebSocket |
| HTTP camera | `8080` | `/frame` endpoint for sim camera |
| Vite frontend | `5173` | Main dashboard UI |
| Mesh server | *(internal)* | CRDT sync relay |

---

## 🔁 Full Restart (Clean Slate)

If something is broken or ports are in use:

```bash
# Terminal 1 — Docker
cd my_robot
docker stop mi_ros2_humble mi_ros2_humble_auto
docker rm mi_ros2_humble mi_ros2_humble_auto
docker system prune -f
docker-compose up --build

# Terminal 2 — Frontend
npm start
```
