#!/bin/bash
# 🤔 Pensando — rasca la cabeza con el brazo derecho
source /opt/ros/humble/setup.bash
PUB="timeout 2 ros2 topic pub --once /joint_commands sensor_msgs/msg/JointState"

echo "🤔 Hmm... pensando..."
# Inclina cabeza levemente
$PUB '{name: ["neck_pitch","neck_roll"], position: [0.15, 0.1]}'
sleep 0.5

# Levanta brazo derecho hacia la cabeza
$PUB '{name: ["r_shoulder_pitch","r_shoulder_roll","r_elbow","r_wrist_pitch"], position: [-0.5, 0.3, 1.5, 0.2]}'
sleep 0.8

# Pequeños movimientos de "rascar"
for i in 1 2 3; do
  $PUB '{name: ["r_wrist_prosup"], position: [0.3]}'
  sleep 0.3
  $PUB '{name: ["r_wrist_prosup"], position: [-0.3]}'
  sleep 0.3
done

# Baja el brazo
echo "💡 ¡Ya sé!"
$PUB '{name: ["r_shoulder_pitch","r_shoulder_roll","r_elbow","r_wrist_pitch","r_wrist_prosup","neck_pitch","neck_roll"], position: [0.0, 0.0, 0.62, 0.0, 0.0, 0.0, 0.0]}'
echo "✅ Listo"
