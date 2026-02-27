# Integrating an External "Robot Brain" with the Dashboard

If you want to create an external AI agent, autonomous navigation stack, or custom "Brain" for your robot, this dashboard is fully ready to act as the simulation and visualization layer. 

**The short answer is YES: This dashboard adheres 100% to professional industry standards (ROS 2 Humble).** You do *not* need a custom API, undocumented webhooks, or a special manual. If someone knows how to use ROS 2, they already know how to talk to this dashboard.

Because we use `rosbridge_server` as the middleware, your "Brain" can be written in Python (using `rclpy`), C++ (`rclcpp`), Rust, or even another Node.js script. It just needs to run within the same ROS 2 network.

---

## 🔌 Connection & Network Details

To physically or virtually connect your Robot to this Dashboard, you only need to expose your ROS 2 environment over WebSockets using the standard `rosbridge_suite`.

### Default Ports

*   **Port 9090 (WebSockets):** This is the default port the Dashboard uses to send and receive all ROS 2 messages (`cmd_vel`, `odom`, `sim_scan`, etc.). When you start the Dashboard, it automatically attempts to bind to `ws://localhost:9090`. 
*   **Port 8080:** Used primarily for streaming visual data or secondary APIs if your robot container requires it (exposed by default in the Docker configuration).

### Step-by-Step Connection

1.  **On your Robot (or Simulated Brain):**
    Install and run the ROS 2 WebSockets bridge. This serves as the middleman between the Dashboard and your ROS 2 topics:
    ```bash
    sudo apt install ros-humble-rosbridge-suite
    ros2 launch rosbridge_server rosbridge_websocket_launch.xml port:=9090
    ```
2.  **On the Dashboard:**
    By default, the Dashboard connects to `ws://localhost:9090`. If your Robot is on a different physical device (like a Raspberry Pi), simply update the connection URL in the Dashboard settings (or `src/App.tsx`) to point to your Robot's IP address (e.g., `ws://192.168.1.100:9090`).

*(Note: If you are running the included `docker-compose.yml`, this is already handled for you, and ports 9090 and 8080 are automatically exposed.)*

---

## 🧠 How the "Brain" Communicates with the Dashboard

The dashboard acts exactly like a physics simulator (e.g., Gazebo or Isaac Sim) mixed with a data visualizer (e.g., RViz). It consumes commands and publishes sensor data using standard ROS 2 message types.

### 1. Moving the Robot's Base (Navigation)
To make your Brain drive the robot around the scene:
*   **Topic to Publish to:** `/cmd_vel`
*   **Message Type:** `geometry_msgs/msg/Twist`
*   **How it works:** Your brain publishes linear (x) and angular (z) velocities. The dashboard's physics engine (`@react-three/rapier`) receives this, applies the physical forces to the robot's rigid body, and moves it through the 3D world, colliding with walls and boxes naturally.

### 2. Moving the Robot's Arms/Head (Manipulation)
To make your Brain control the robot's joints:
*   **Topic to Publish to:** `/joint_states`
*   **Message Type:** `sensor_msgs/msg/JointState`
*   **How it works:** (Ensure "Live /joint_states" is checked in the UI). Your brain publishes arrays of joint names (e.g., `["r_elbow", "neck_pitch"]`) and their target radians. The dashboard's `ts-trajectory` internal engine will intercept these targets and fluidly animate the 3D model to match the brain's intention in real-time.

### 3. "Seeing" the Scenario (Perception)
Your Brain needs to know where it is and what obstacles are around it to make decisions:

#### A. Odometry (Where am I?)
*   **Topic to Subscribe to:** `/odom`
*   **Message Type:** `nav_msgs/msg/Odometry`
*   **How it works:** The dashboard continuously calculates the robot's exact X, Y, Z coordinates and its Quaternion rotation within the 3D physics world and broadcasts it here. Your brain uses this to update its internal map.

#### B. LiDAR / Collision Avoidance (What is around me?)
*   **Topic to Subscribe to:** `/sim_scan`
*   **Message Type:** `sensor_msgs/msg/LaserScan`
*   **How it works:** The dashboard's `@spatial-engine` fires hundreds of virtual raycasts 360-degrees around the robot. It measures the distance to the walls, boxes, and people you placed in the UI Editor. It packs these distances into a standard ROS LaserScan array (adding realistic mathematical noise) and sends it to your Brain. Your Brain can use this array to detect obstacles and trigger emergency stops or path replanning.

---

## 🚀 Example: A Simple Python Brain

Here is what a minimal "Brain" looks like using standard ROS 2 Python (`rclpy`). It reads the LiDAR and drives forward unless it sees a wall closer than 1 meter. 

This requires **zero custom code** on the dashboard side; it just works.

```python
import rclpy
from rclpy.node import Node
from geometry_msgs.msg import Twist
from sensor_msgs.msg import LaserScan

class RobotBrain(Node):
    def __init__(self):
        super().__init__('robot_brain')
        
        # 1. Dashboard tells us what it sees (LiDAR)
        self.subscription = self.create_subscription(
            LaserScan, '/sim_scan', self.lidar_callback, 10)
            
        # 2. We tell the Dashboard how to move (Motors)
        self.publisher = self.create_publisher(Twist, '/cmd_vel', 10)

    def lidar_callback(self, msg):
        # Check the front center laser beam (assuming 0 is straight ahead)
        front_distance = msg.ranges[len(msg.ranges) // 2]
        
        cmd = Twist()
        if front_distance < 1.0:
            # Obstacle detected! Turn left
            self.get_logger().info('Obstacle! Turning...')
            cmd.linear.x = 0.0
            cmd.angular.z = 0.5
        else:
            # Path clear! Move forward
            self.get_logger().info('Clear. Moving forward...')
            cmd.linear.x = 0.5
            cmd.angular.z = 0.0
            
        # Send command to the Dashboard physics engine
        self.publisher.publish(cmd)

def main():
    rclpy.init()
    brain = RobotBrain()
    rclpy.spin(brain)
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

## 🎯 Conclusion

By adhering strictly to ROS 2 standard message types (`Twist`, `Odometry`, `LaserScan`, `JointState`), we have guaranteed **100% interoperability**. 

Other engineers do not need to read a custom manual or understand React, Three.js, or our custom libraries to build an AI for this robot. They simply write standard ROS 2 nodes, and the dashboard seamlessly acts as their High-Fidelity Simulator and Visualizer.
