#!/bin/bash
# 🙋 Saludar con la mano derecha (Wave)
source /opt/ros/humble/setup.bash
PUB="timeout 2 ros2 topic pub --once /joint_states sensor_msgs/msg/JointState"

echo "🤖 Levantando brazo..."
$PUB '{name: ["r_shoulder_pitch","r_shoulder_roll","r_elbow"], position: [-0.8, 1.0, 1.2]}'
sleep 1.0

echo "👋 Saludando (3 veces)..."
for i in 1 2 3; do
  $PUB '{name: ["r_shoulder_pitch","r_shoulder_roll","r_elbow","r_wrist_prosup"], position: [-0.8, 1.0, 1.2, -0.8]}'
  sleep 0.4
  $PUB '{name: ["r_shoulder_pitch","r_shoulder_roll","r_elbow","r_wrist_prosup"], position: [-0.8, 1.0, 1.2,  0.8]}'
  sleep 0.4
done

echo "⬇️  Bajando brazo..."
$PUB '{name: ["r_shoulder_pitch","r_shoulder_roll","r_elbow","r_wrist_prosup"], position: [0.0, 0.0, 0.62, 0.0]}'
echo "✅ Listo"
