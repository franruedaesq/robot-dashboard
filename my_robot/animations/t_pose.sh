#!/bin/bash
# 🤸 T-Pose — ambos brazos completamente abiertos
source /opt/ros/humble/setup.bash
PUB="timeout 2 ros2 topic pub --once /joint_states sensor_msgs/msg/JointState"

echo "🤖 Entrando en T-Pose..."
$PUB '{name: ["l_shoulder_pitch","l_shoulder_roll","l_elbow","r_shoulder_pitch","r_shoulder_roll","r_elbow"], position: [0.0, 1.5, 0.0, 0.0, 1.5, 0.0]}'
sleep 2.0

echo "⬇️  Volviendo a reposo..."
$PUB '{name: ["l_shoulder_pitch","l_shoulder_roll","l_elbow","r_shoulder_pitch","r_shoulder_roll","r_elbow"], position: [0.0, 0.0, 0.62, 0.0, 0.0, 0.62]}'
echo "✅ Listo"
