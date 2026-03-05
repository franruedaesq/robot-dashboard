#!/bin/bash
# 🚶‍♂️ Patrullar y Actuar — el robot se mueve, gira y mueve sus articulaciones
source /opt/ros/humble/setup.bash

# Publishers
PUB_JOINT="timeout 2 ros2 topic pub --once /joint_commands sensor_msgs/msg/JointState"
PUB_CMD="timeout 2 ros2 topic pub --once /cmd_vel geometry_msgs/msg/Twist"

echo "🚶‍♂️ Moviendo hacia adelante..."
$PUB_CMD '{linear: {x: 0.3, y: 0.0, z: 0.0}, angular: {x: 0.0, y: 0.0, z: 0.0}}'
sleep 2.0

echo "🛑 Deteniendo..."
$PUB_CMD '{linear: {x: 0.0, y: 0.0, z: 0.0}, angular: {x: 0.0, y: 0.0, z: 0.0}}'
sleep 0.5

echo "🔄 Girando..."
$PUB_CMD '{linear: {x: 0.0, y: 0.0, z: 0.0}, angular: {x: 0.0, y: 0.0, z: 0.5}}'
sleep 2.0

echo "🛑 Deteniendo giro..."
$PUB_CMD '{linear: {x: 0.0, y: 0.0, z: 0.0}, angular: {x: 0.0, y: 0.0, z: 0.0}}'
sleep 0.5

echo "👋 Moviendo articulaciones (saludo)..."
$PUB_JOINT '{name: ["r_shoulder_pitch","r_shoulder_roll","r_elbow"], position: [-0.8, 1.0, 1.2]}'
sleep 1.0
$PUB_JOINT '{name: ["r_shoulder_pitch","r_shoulder_roll","r_elbow","r_wrist_prosup"], position: [-0.8, 1.0, 1.2, -0.8]}'
sleep 0.5
$PUB_JOINT '{name: ["r_shoulder_pitch","r_shoulder_roll","r_elbow","r_wrist_prosup"], position: [-0.8, 1.0, 1.2, 0.8]}'
sleep 0.5
$PUB_JOINT '{name: ["r_shoulder_pitch","r_shoulder_roll","r_elbow","r_wrist_prosup"], position: [-0.8, 1.0, 1.2, -0.8]}'
sleep 0.5

echo "⬇️  Volviendo a reposo..."
$PUB_JOINT '{name: ["r_shoulder_pitch","r_shoulder_roll","r_elbow","r_wrist_prosup"], position: [0.0, 0.0, 0.62, 0.0]}'

echo "✅ Listo"
