#!/bin/bash
# 👀 Mirar alrededor — la cabeza gira izquierda, derecha y asiente
source /opt/ros/humble/setup.bash
PUB="timeout 2 ros2 topic pub --once /joint_commands sensor_msgs/msg/JointState"

echo "👀 Mirando a la izquierda..."
$PUB '{name: ["neck_yaw","neck_pitch"], position: [0.6, 0.1]}'
sleep 0.8

echo "👀 Mirando al centro..."
$PUB '{name: ["neck_yaw","neck_pitch"], position: [0.0, 0.1]}'
sleep 0.6

echo "👀 Mirando a la derecha..."
$PUB '{name: ["neck_yaw","neck_pitch"], position: [-0.6, 0.1]}'
sleep 0.8

echo "👀 Centro y asentir..."
$PUB '{name: ["neck_yaw","neck_pitch"], position: [0.0, 0.1]}'
sleep 0.4
$PUB '{name: ["neck_yaw","neck_pitch"], position: [0.0, 0.4]}'
sleep 0.4
$PUB '{name: ["neck_yaw","neck_pitch"], position: [0.0, 0.1]}'
sleep 0.4
$PUB '{name: ["neck_yaw","neck_pitch"], position: [0.0, 0.4]}'
sleep 0.4

echo "↩️  Reseteando cabeza..."
$PUB '{name: ["neck_yaw","neck_pitch"], position: [0.0, 0.0]}'
echo "✅ Listo"
