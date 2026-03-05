#!/bin/bash
# 🧘 Estiramiento — brazos arriba, abrir, bajar lentamente
source /opt/ros/humble/setup.bash
PUB="timeout 2 ros2 topic pub --once /joint_commands sensor_msgs/msg/JointState"

echo "🧘 Estirando hacia arriba..."
$PUB '{name: ["l_shoulder_pitch","r_shoulder_pitch","l_elbow","r_elbow","torso_pitch"], position: [-1.0, -1.0, 0.2, 0.2, 0.1]}'
sleep 1.5

echo "↔️  Abriendo brazos..."
$PUB '{name: ["l_shoulder_pitch","r_shoulder_pitch","l_shoulder_roll","r_shoulder_roll","l_elbow","r_elbow"], position: [0.0, 0.0, 1.2, 1.2, 0.1, 0.1]}'
sleep 1.5

echo "⬇️  Bajando brazos lentamente..."
$PUB '{name: ["l_shoulder_pitch","r_shoulder_pitch","l_shoulder_roll","r_shoulder_roll","l_elbow","r_elbow","torso_pitch"], position: [0.0, 0.0, 0.0, 0.0, 0.62, 0.62, 0.0]}'
sleep 1.0

echo "🧎 Inclinación lateral izquierda..."
$PUB '{name: ["torso_roll","neck_roll"], position: [0.3, 0.1]}'
sleep 1.0
$PUB '{name: ["torso_roll","neck_roll"], position: [-0.3, -0.1]}'
sleep 1.0
$PUB '{name: ["torso_roll","neck_roll"], position: [0.0, 0.0]}'
echo "✅ Listo"
