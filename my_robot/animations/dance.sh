#!/bin/bash
# 💃 Bailar — movimientos rítmicos del torso y brazos
source /opt/ros/humble/setup.bash
PUB="timeout 2 ros2 topic pub --once /joint_commands sensor_msgs/msg/JointState"

echo "🎵 ¡A bailar!"

for i in 1 2 3 4; do
  # Beat izquierda
  $PUB '{name: ["torso_yaw","torso_roll","l_shoulder_pitch","r_shoulder_pitch","l_elbow","r_elbow"], position: [-0.3, 0.1, -0.3, 0.1, 0.8, 1.2]}'
  sleep 0.5

  # Beat derecha
  $PUB '{name: ["torso_yaw","torso_roll","l_shoulder_pitch","r_shoulder_pitch","l_elbow","r_elbow"], position: [0.3, -0.1, 0.1, -0.3, 1.2, 0.8]}'
  sleep 0.5
done

echo "🫡 Pose final..."
$PUB '{name: ["torso_yaw","torso_roll","l_shoulder_pitch","r_shoulder_pitch","l_elbow","r_elbow","neck_pitch"], position: [0.0, 0.0, -0.8, -0.8, 0.3, 0.3, 0.2]}'
sleep 1.0

echo "⬇️  Volviendo a reposo..."
$PUB '{name: ["torso_yaw","torso_roll","l_shoulder_pitch","r_shoulder_pitch","l_elbow","r_elbow","neck_pitch"], position: [0.0, 0.0, 0.0, 0.0, 0.62, 0.62, 0.0]}'
echo "✅ Listo"
