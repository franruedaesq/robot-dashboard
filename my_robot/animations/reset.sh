#!/bin/bash
# 🔙 Reset — vuelve todos los joints a posición de reposo
source /opt/ros/humble/setup.bash
PUB="timeout 2 ros2 topic pub --once /joint_states sensor_msgs/msg/JointState"

echo "🔙 Reseteando todos los joints a reposo..."
$PUB '{name: [
  "l_shoulder_pitch","l_shoulder_roll","l_shoulder_yaw","l_elbow","l_wrist_prosup","l_wrist_pitch","l_wrist_yaw",
  "r_shoulder_pitch","r_shoulder_roll","r_shoulder_yaw","r_elbow","r_wrist_prosup","r_wrist_pitch","r_wrist_yaw",
  "torso_pitch","torso_roll","torso_yaw",
  "neck_pitch","neck_roll","neck_yaw"
], position: [
  0.0, 0.0, 0.0, 0.62, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.62, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0,
  0.0, 0.0, 0.0
]}'
echo "✅ Robot en reposo"
