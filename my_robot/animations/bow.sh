#!/bin/bash
# 🙇 Reverencia — inclinar torso y cabeza hacia adelante
source /opt/ros/humble/setup.bash
PUB="timeout 2 ros2 topic pub --once /joint_states sensor_msgs/msg/JointState"

echo "🙇 Haciendo reverencia..."
$PUB '{name: ["torso_pitch","neck_pitch"], position: [0.5, -0.3]}'
sleep 1.5

echo "🤖 Levantándose..."
$PUB '{name: ["torso_pitch","neck_pitch"], position: [0.0, 0.0]}'
echo "✅ Listo"
