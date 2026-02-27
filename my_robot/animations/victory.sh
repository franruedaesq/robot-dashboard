#!/bin/bash
# 🙌 Victory Pose — brazos arriba
source /opt/ros/humble/setup.bash
PUB="timeout 2 ros2 topic pub --once /joint_states sensor_msgs/msg/JointState"

echo "🙌 ¡Victoria! Subiendo brazos..."
$PUB '{name: ["l_shoulder_pitch","l_shoulder_roll","l_elbow","r_shoulder_pitch","r_shoulder_roll","r_elbow","neck_pitch"], position: [-1.2, 0.5, 0.3, -1.2, 0.5, 0.3, 0.3]}'
sleep 2.0

echo "⬇️  Bajando brazos..."
$PUB '{name: ["l_shoulder_pitch","l_shoulder_roll","l_elbow","r_shoulder_pitch","r_shoulder_roll","r_elbow","neck_pitch"], position: [0.0, 0.0, 0.62, 0.0, 0.0, 0.62, 0.0]}'
echo "✅ Listo"
