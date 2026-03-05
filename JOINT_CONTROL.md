# Joint Control from Terminal (ROS 2)

> **How it works:** Enable the **"Live /joint_states"** checkbox in the 🦾 panel first.
> The dashboard subscribes to `/joint_states` — that's the topic that drives the 3D visuals.

Connect to the running Docker container:
```bash
docker exec -it mi_ros2_humble_auto bash
source /opt/ros/humble/setup.bash
```

---

## Move a Single Joint

```bash
ros2 topic pub --once /joint_states sensor_msgs/msg/JointState '{
  name: ["l_elbow"],
  position: [1.2]
}'
```

## Move Multiple Joints at the Same Time

```bash
ros2 topic pub --once /joint_states sensor_msgs/msg/JointState '{
  name: ["l_elbow", "r_elbow", "torso_pitch"],
  position: [1.2, 0.8, 0.3]
}'
```

## Stream Continuously at 10Hz (live animation)

```bash
ros2 topic pub --rate 10 /joint_states sensor_msgs/msg/JointState '{
  name: ["l_elbow", "r_elbow"],
  position: [0.8, 0.8]
}'
```
> Press `Ctrl+C` to stop.

## Simulate a Sequence (sequential positions over time)

Shell script that publishes one position, waits, then the next:

```bash
for pos in 0.3 0.8 1.2 1.8 0.0; do
  ros2 topic pub --once /joint_states sensor_msgs/msg/JointState \
    "{name: [\"l_elbow\"], position: [$pos]}"
  sleep 1
done
```

---

## 🙋 Animación: Saludar con la mano (Wave)

Levanta el brazo derecho y oscila la muñeca 3 veces:

```bash
PUB="ros2 topic pub --once /joint_states sensor_msgs/msg/JointState"

echo "Levantando brazo..."
$PUB '{name: ["r_shoulder_pitch","r_shoulder_roll","r_elbow"], position: [-0.8, 1.0, 1.2]}'
sleep 1.0

echo "Saludando..."
for i in 1 2 3; do
  $PUB '{name: ["r_shoulder_pitch","r_shoulder_roll","r_elbow","r_wrist_prosup"], position: [-0.8, 1.0, 1.2, -0.8]}'
  sleep 0.4
  $PUB '{name: ["r_shoulder_pitch","r_shoulder_roll","r_elbow","r_wrist_prosup"], position: [-0.8, 1.0, 1.2,  0.8]}'
  sleep 0.4
done

echo "Bajando brazo..."
$PUB '{name: ["r_shoulder_pitch","r_shoulder_roll","r_elbow","r_wrist_prosup"], position: [0.0, 0.0, 0.0, 0.0]}'
```

---

## 🤸 Animación: Pose T (ambos brazos abiertos)

```bash
PUB="ros2 topic pub --once /joint_states sensor_msgs/msg/JointState"

echo "T-Pose..."
$PUB '{name: ["l_shoulder_pitch","l_shoulder_roll","l_elbow","r_shoulder_pitch","r_shoulder_roll","r_elbow"], position: [0.0, 1.5, 0.0, 0.0, 1.5, 0.0]}'
sleep 2.0

echo "Volviendo a reposo..."
$PUB '{name: ["l_shoulder_pitch","l_shoulder_roll","l_elbow","r_shoulder_pitch","r_shoulder_roll","r_elbow"], position: [0.0, 0.0, 0.62, 0.0, 0.0, 0.62]}'
```

---

## 👀 Animación: Mirar alrededor (Head Look Around)

```bash
PUB="ros2 topic pub --once /joint_states sensor_msgs/msg/JointState"

for yaw in 0.6 0.0 -0.6 0.0; do
  $PUB "{name: [\"neck_yaw\", \"neck_pitch\"], position: [$yaw, 0.15]}"
  sleep 0.8
done
# Reset
$PUB '{name: ["neck_yaw","neck_pitch"], position: [0.0, 0.0]}'
```

---

## 🙇 Animación: Reverencia (Bow)

```bash
PUB="ros2 topic pub --once /joint_states sensor_msgs/msg/JointState"

echo "Inclinándose..."
$PUB '{name: ["torso_pitch","neck_pitch"], position: [0.5, -0.3]}'
sleep 1.5

echo "Levantándose..."
$PUB '{name: ["torso_pitch","neck_pitch"], position: [0.0, 0.0]}'
```

---

## 🙌 Animación: Brazos arriba (Victory Pose)

```bash
PUB="ros2 topic pub --once /joint_states sensor_msgs/msg/JointState"

echo "Subiendo brazos..."
$PUB '{name: ["l_shoulder_pitch","l_shoulder_roll","l_elbow","r_shoulder_pitch","r_shoulder_roll","r_elbow","neck_pitch"], position: [-1.2, 0.5, 0.3, -1.2, 0.5, 0.3, 0.3]}'
sleep 2.0

echo "Bajando brazos..."
$PUB '{name: ["l_shoulder_pitch","l_shoulder_roll","l_elbow","r_shoulder_pitch","r_shoulder_roll","r_elbow","neck_pitch"], position: [0.0, 0.0, 0.62, 0.0, 0.0, 0.62, 0.0]}'
```

---

## 🔄 Animación: Rutina completa encadenada

Saludo → Reverencia → T-Pose → Reposo, todo en un solo script:

```bash
PUB="ros2 topic pub --once /joint_states sensor_msgs/msg/JointState"

echo "=== Saludo ==="
$PUB '{name: ["r_shoulder_pitch","r_shoulder_roll","r_elbow"], position: [-0.8, 1.0, 1.2]}'
sleep 0.8
$PUB '{name: ["r_shoulder_pitch","r_shoulder_roll","r_elbow","r_wrist_prosup"], position: [-0.8, 1.0, 1.2, -0.8]}'
sleep 0.4
$PUB '{name: ["r_shoulder_pitch","r_shoulder_roll","r_elbow","r_wrist_prosup"], position: [-0.8, 1.0, 1.2,  0.8]}'
sleep 0.4
$PUB '{name: ["r_shoulder_pitch","r_shoulder_roll","r_elbow","r_wrist_prosup"], position: [-0.8, 1.0, 1.2, -0.8]}'
sleep 0.4
$PUB '{name: ["r_shoulder_pitch","r_shoulder_roll","r_elbow","r_wrist_prosup"], position: [0.0, 0.0, 0.0, 0.0]}'
sleep 0.6

echo "=== Reverencia ==="
$PUB '{name: ["torso_pitch","neck_pitch"], position: [0.5, -0.3]}'
sleep 1.2
$PUB '{name: ["torso_pitch","neck_pitch"], position: [0.0, 0.0]}'
sleep 0.6

echo "=== T-Pose ==="
$PUB '{name: ["l_shoulder_pitch","l_shoulder_roll","l_elbow","r_shoulder_pitch","r_shoulder_roll","r_elbow"], position: [0.0, 1.5, 0.0, 0.0, 1.5, 0.0]}'
sleep 1.5

echo "=== Reposo ==="
$PUB '{name: ["l_shoulder_pitch","l_shoulder_roll","l_elbow","r_shoulder_pitch","r_shoulder_roll","r_elbow"], position: [0.0, 0.0, 0.62, 0.0, 0.0, 0.62]}'
echo "✅ Listo"
```

---

## iCub Darmstadt Joint Reference

| Joint | Good test values |
|---|---|
| `l_elbow` / `r_elbow` | `0.0`, `1.0`, `1.8` |
| `l_shoulder_pitch` / `r_shoulder_pitch` | `-0.8`, `0.0`, `0.5` |
| `l_shoulder_roll` / `r_shoulder_roll` | `0.0`, `0.8`, `1.5` |
| `torso_pitch` | `-0.2`, `0.0`, `0.5` |
| `torso_yaw` | `-0.5`, `0.0`, `0.5` |
| `neck_pitch` | `-0.3`, `0.0`, `0.4` |
| `neck_yaw` | `-0.6`, `0.0`, `0.6` |
| `r_wrist_prosup` | `-0.8`, `0.0`, `0.8` |

---

## ⚠️ `/joint_trajectory_controller/joint_trajectory` — Real Robot Only

The commands in the arm panel *publish* to this topic to command a real hardware controller
(e.g. a physical iCub or Gazebo simulation). Nobody in this local Docker setup subscribes to it,
so publishing from the terminal will hang with "Waiting for at least 1 matching subscription(s)".
Use `/joint_states` above instead for testing the dashboard visuals.
