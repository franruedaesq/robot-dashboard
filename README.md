# Robot Dashboard 🤖

A modern, responsive, web-based robotic dashboard and 3D digital twin built with **React**, **TypeScript**, and **Vite**. This application connects to a ROS 2 system via WebSockets to visualize, simulate, and control robots in a rich, real-time 3D environment powered by `@react-three/fiber` and accelerated by the `@react-three/rapier` 3D physics engine.

## ✨ Core Features & Capabilities

### 🌍 3D Digital Twin Simulation
Create a physically accurate, real-time replica of your robot ecosystem:
- **Physics Engine**: Native rigid body dynamics and collision detection powered by Rapier.
- **URDF Support**: Automatically loads, parses, and visually translates robot descriptions into Three.js object hierarchies while auto-detecting exact spawning constraints.
- **Multiple Preloaded Robots**: Easily switch between supported robot models seamlessly using the Robot Selector panel.

### 🔌 ROS 2 Integration
Connects directly to the "Cerebro ROS 2" bridge via `roslib` (`ws://localhost:9090`):
- Subscribes to `/cmd_vel` for movement commands.
- Constantly streams odometry back to ROS via the `/odom` topics, calculating absolute pose and yaw angles based on the physics engine simulation.
- Publishes simulated sensor data across various configured frames.

### 🎮 Teleoperation & Control
Drive the robot directly from the dashboard regardless of the device you are using:
- **Keyboard Control**: Intuitive WASD or Arrow Keys for movement, computing robust differential translations into `linear` and `angular` velocity vectors.
- **On-Screen D-Pad**: A floating, touch-optimized directional pad offering granular movement commands perfect for mobile interfaces or mouse control.
- **Robot Arm Manipulation**: A sophisticated, specialized panel to directly update joint angles and control end-effectors, visually rendering arm states instantly.

### 📡 Advanced Sensor Simulation
Bring real-world sensors to the browser:
- **Simulated LiDAR (`/sim_scan`)**: Emulates full 360-degree 2D LiDAR scans through complex raycasting in the 3D physics world. Includes physically realistic Gaussian distribution noise mimicking real-world sensor inaccuracies while automatically ignoring internal robot geometry.
- **Real LiDAR Panel**: View and closely compare real incoming LiDAR data against simulated spatial readings side-by-side inside the dashboard.

### ⚙️ Headless Mode (RL Data Generation)
A performance-oriented execution layer built for Machine Learning and Reinforcement Learning practitioners:
- **Uncoupled Execution**: Bypasses the GPU-bound 3D graphic rendering layer completely.
- **Time Acceleration**: Runs the Rapier physics calculations iteratively at massive computational speed unconstrained by monitor FPS, enabling simulated environments to generate massive datasets faster than real-time speed.
- **Sim-Time Control**: Control the time scale directly. The simulation calculates high-frequency frames per RequestAnimationFrame (RAF) tick while still executing all physics and sensor callbacks at standard frequencies (e.g., 60Hz step resolution).

### 🏗️ World Editor & Dynamic Scenarios
Interactively construct and modify test scenarios directly in the browser:
- **Obstacle Placement**: Click-to-place system for Boxes, Walls (Horizontal/Vertical orientation), and People.
- **Modifiable Physics**: Toggle specific obstacles between "Fixed" (static barriers) and "Dynamic" (pushable objects constrained by gravity and collisions).
- **Preset Scenarios**: Quickly load various pre-built map configurations.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Active ROS 2 `rosbridge_server` running on `ws://localhost:9090` (can be updated inside `App.tsx`)

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
   Navigate your browser to `http://localhost:5173`. The UI is thoroughly responsive, adapting dynamically to broad desktop displays and scaled-down mobile screens.

## 🛠️ Technology Stack

- **Framework**: React, TypeScript, Vite
- **3D & Physics**: `@react-three/fiber`, `@react-three/drei`, `@react-three/rapier`, `three.js`
- **Communications**: `roslib` (ROS 1 / ROSBridge native WebSocket wrapper)
- **Styling**: Vanilla CSS structure, inline responsive React style generation
