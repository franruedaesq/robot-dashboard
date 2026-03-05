# Robot Dashboard 🤖

A modern, responsive, web-based robotic dashboard and 3D digital twin built with **React**, **TypeScript**, and **Vite**. This application connects to a ROS 2 system via WebSockets to visualize, simulate, and control robots in a rich, real-time 3D environment powered by `@react-three/fiber` and accelerated by the `@react-three/rapier` 3D physics engine.

## ✨ Core Features & Capabilities

### 🌍 3D Digital Twin Simulation
Create a physically accurate, real-time replica of your robot ecosystem:
- **Physics Engine**: Native rigid body dynamics and collision detection powered by Rapier.
- **URDF Support**: Automatically loads, parses, and visually translates robot descriptions into Three.js object hierarchies while auto-detecting exact spawning constraints.
- **Spatial Partitioning (Octree)**: Ultra-fast collision checks, distance queries, and raycasts against the world powered by `@spatial-engine`, solving massive scale physics efficiently.
- **TF Engine Coordination**: A highly efficient Transformation Frame (TF) hierarchy manager built via `@tf-engine/react`, ensuring all internal robot links and frames stay globally synchronized without costly DOM re-renders.

### 🔌 ROS 2 Integration
Connects directly to the "Cerebro ROS 2" bridge via `roslib` (`ws://localhost:9090`):
- Subscribes to `/cmd_vel` for movement commands.
- Constantly streams odometry back to ROS via the `/odom` topics, calculating absolute pose and yaw angles based on the physics engine simulation.
- Publishes simulated sensor data across various configured frames.

### 🎮 Teleoperation & Control
Drive the robot directly from the dashboard regardless of the device you are using:
- **Keyboard Control**: Intuitive WASD or Arrow Keys for movement, computing robust differential translations into `linear` velocity vectors.
- **On-Screen D-Pad**: A floating, touch-optimized directional pad offering granular movement commands perfect for mobile interfaces or mouse control.
- **Robot Arm Manipulation**: A sophisticated panel to directly update joint angles and control end-effectors. Includes an interactive visual feedback loop powered by `ts-trajectory` for **smooth, cinematic interpolations** (resolving abrupt value snapping) and **Live `/joint_states` toggle** parsing true hardware states directly to the interface in real-time.

### 📡 Advanced Sensor Simulation
Bring real-world sensors to the browser:
- **Simulated LiDAR (`/sim_scan`)**: Emulates full 360-degree 2D LiDAR scans through complex raycasting in the 3D physics world. Includes physically realistic Gaussian distribution noise mimicking real-world sensor inaccuracies while automatically ignoring internal robot geometry.
- **Real LiDAR Panel**: View and closely compare real incoming LiDAR data against simulated spatial readings side-by-side inside the dashboard.

### ⚙️ Headless Mode (RL Data Generation)
A performance-oriented execution layer built for Machine Learning and Reinforcement Learning practitioners:
- **Uncoupled Execution**: Bypasses the GPU-bound 3D graphic rendering layer completely.
- **Time Acceleration**: Runs the Rapier physics calculations iteratively at massive computational speed unconstrained by monitor FPS, enabling simulated environments to generate massive datasets faster than real-time speed.

### 🏗️ World Editor & Collaborative Multiplayer
Interactively construct and modify test scenarios directly in the browser:
- **Obstacle Placement**: Click-to-place system for Boxes, Walls, and People.
- **Real-Time Multiplayer Sync**: Any scenario edit in one browser magically appears globally for all other connected participants, powered entirely by a robust Conflict-free Replicated Data Type (`@crdt-sync`) state engine. 

### 💃 High-Frequency Robot Animations
- Integrated a 30Hz Python interpolator (`animate.py`) deployed via Docker capable of executing fluid full-body robot choreographies (Greet, T-Pose, Dance, etc) translating simple bash scripts into cubic easing keyframe arrays directly interpreted by the dashboard.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Active ROS 2 `rosbridge_server` running on `ws://localhost:9090` (See `RUNNING.md` for Docker deployment instructions)

### Installation & Execution

1. **Install required dependencies**:
   ```bash
   npm install
   ```

2. **Start the Vite development server**:
   ```bash
   npm run dev
   ```

3. **Open the Dashboard**:
   Navigate your browser to `http://localhost:5173`. 

## 🛠️ Technology Stack

- **Framework**: React 19, TypeScript, Vite
- **3D & Physics Rendering**: `@react-three/fiber`, `@react-three/drei`, `@react-three/rapier`, `three`
- **Internal State & Architecture**:
  - `@tf-engine/core` / `react` (Frame Transformations)
  - `@crdt-sync/core` / `react` (Conflict-free Multiplayer Sync)
  - `@spatial-engine/core` (High Perf Octrees)
  - `ts-trajectory` (Cubic Motion Planning)
- **Robotics Integration**: `roslib`, `urdf-loader` (ROS 1/ROS 2 websocket messaging)
