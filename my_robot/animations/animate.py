#!/usr/bin/env python3
"""
animate.py — Smooth 30Hz animation player for iCub Darmstadt joints.

Usage (inside Docker):
  python3 /animations/animate.py wave
  python3 /animations/animate.py dance
  python3 /animations/animate.py full    # all animations in sequence
  python3 /animations/animate.py list    # list all available animations

How it works:
  Each animation is defined as a list of keyframes: (time_sec, {joint: position}).
  The player interpolates between keyframes at 30Hz using cubic easing and
  publishes to /joint_commands so the browser's Live feedback (+ ts-trajectory)
  renders it smoothly.
"""

import rclpy
from rclpy.node import Node
from sensor_msgs.msg import JointState
import math
import sys
import time

# ─── Easing ──────────────────────────────────────────────────────────────────
def cubic_ease_in_out(t: float) -> float:
    """Smooth S-curve: slow start, fast middle, slow end."""
    if t < 0.5:
        return 4 * t * t * t
    p = 2 * t - 2
    return 0.5 * p * p * p + 1

def lerp(a, b, t):
    return a + (b - a) * t

# ─── Keyframe interpolation ───────────────────────────────────────────────────
def interpolate_keyframes(keyframes, t: float) -> dict:
    """
    keyframes: list of (time_sec, {joint_name: position})
    t: current time in seconds
    Returns: {joint_name: interpolated_position}
    """
    if t <= keyframes[0][0]:
        return dict(keyframes[0][1])
    if t >= keyframes[-1][0]:
        return dict(keyframes[-1][1])

    # Find surrounding keyframes
    for i in range(len(keyframes) - 1):
        t0, pose0 = keyframes[i]
        t1, pose1 = keyframes[i + 1]
        if t0 <= t <= t1:
            alpha = (t - t0) / (t1 - t0)
            alpha = cubic_ease_in_out(alpha)
            result = {}
            all_joints = set(pose0.keys()) | set(pose1.keys())
            for joint in all_joints:
                a = pose0.get(joint, 0.0)
                b = pose1.get(joint, 0.0)
                result[joint] = lerp(a, b, alpha)
            return result
    return {}

# ─── Animations library ────────────────────────────────────────────────────────
REST = {
    "l_shoulder_pitch": 0.0, "l_shoulder_roll": 0.0, "l_shoulder_yaw": 0.0,
    "l_elbow": 0.62, "l_wrist_prosup": 0.0, "l_wrist_pitch": 0.0, "l_wrist_yaw": 0.0,
    "r_shoulder_pitch": 0.0, "r_shoulder_roll": 0.0, "r_shoulder_yaw": 0.0,
    "r_elbow": 0.62, "r_wrist_prosup": 0.0, "r_wrist_pitch": 0.0, "r_wrist_yaw": 0.0,
    "torso_pitch": 0.0, "torso_roll": 0.0, "torso_yaw": 0.0,
    "neck_pitch": 0.0, "neck_roll": 0.0, "neck_yaw": 0.0,
}

ANIMATIONS = {

    "wave": [
        (0.0, REST),
        (0.8, {**REST, "r_shoulder_pitch": -0.8, "r_shoulder_roll": 1.0, "r_elbow": 1.2}),
        (1.2, {**REST, "r_shoulder_pitch": -0.8, "r_shoulder_roll": 1.0, "r_elbow": 1.2, "r_wrist_prosup": -0.8}),
        (1.6, {**REST, "r_shoulder_pitch": -0.8, "r_shoulder_roll": 1.0, "r_elbow": 1.2, "r_wrist_prosup":  0.8}),
        (2.0, {**REST, "r_shoulder_pitch": -0.8, "r_shoulder_roll": 1.0, "r_elbow": 1.2, "r_wrist_prosup": -0.8}),
        (2.4, {**REST, "r_shoulder_pitch": -0.8, "r_shoulder_roll": 1.0, "r_elbow": 1.2, "r_wrist_prosup":  0.8}),
        (2.8, {**REST, "r_shoulder_pitch": -0.8, "r_shoulder_roll": 1.0, "r_elbow": 1.2, "r_wrist_prosup": -0.8}),
        (3.4, REST),
    ],

    "bow": [
        (0.0, REST),
        (1.0, {**REST, "torso_pitch": 0.5, "neck_pitch": -0.3}),
        (2.0, {**REST, "torso_pitch": 0.5, "neck_pitch": -0.3}),
        (3.0, REST),
    ],

    "t_pose": [
        (0.0, REST),
        (1.0, {**REST, "l_shoulder_roll": 1.5, "l_elbow": 0.0, "r_shoulder_roll": 1.5, "r_elbow": 0.0}),
        (2.5, {**REST, "l_shoulder_roll": 1.5, "l_elbow": 0.0, "r_shoulder_roll": 1.5, "r_elbow": 0.0}),
        (3.5, REST),
    ],

    "look_around": [
        (0.0, REST),
        (0.8, {**REST, "neck_yaw":  0.6, "neck_pitch": 0.1}),
        (1.4, {**REST, "neck_yaw":  0.0, "neck_pitch": 0.1}),
        (2.2, {**REST, "neck_yaw": -0.6, "neck_pitch": 0.1}),
        (2.8, {**REST, "neck_yaw":  0.0, "neck_pitch": 0.1}),
        (3.1, {**REST, "neck_yaw":  0.0, "neck_pitch": 0.4}),  # nod down
        (3.4, {**REST, "neck_yaw":  0.0, "neck_pitch": 0.0}),  # nod up
        (3.7, {**REST, "neck_yaw":  0.0, "neck_pitch": 0.4}),
        (4.0, REST),
    ],

    "victory": [
        (0.0, REST),
        (0.8, {**REST,
               "l_shoulder_pitch": -1.2, "l_shoulder_roll": 0.5, "l_elbow": 0.3,
               "r_shoulder_pitch": -1.2, "r_shoulder_roll": 0.5, "r_elbow": 0.3,
               "neck_pitch": 0.3}),
        (2.0, {**REST,
               "l_shoulder_pitch": -1.2, "l_shoulder_roll": 0.5, "l_elbow": 0.3,
               "r_shoulder_pitch": -1.2, "r_shoulder_roll": 0.5, "r_elbow": 0.3,
               "neck_pitch": 0.3}),
        (3.0, REST),
    ],

    "think": [
        (0.0, REST),
        (0.5, {**REST, "neck_pitch": 0.15, "neck_roll": 0.1}),
        (1.2, {**REST, "neck_pitch": 0.15, "neck_roll": 0.1,
               "r_shoulder_pitch": -0.5, "r_shoulder_roll": 0.3, "r_elbow": 1.5}),
        (1.5, {**REST, "neck_pitch": 0.15, "neck_roll": 0.1,
               "r_shoulder_pitch": -0.5, "r_shoulder_roll": 0.3, "r_elbow": 1.5,
               "r_wrist_prosup": 0.3}),
        (1.8, {**REST, "neck_pitch": 0.15, "neck_roll": 0.1,
               "r_shoulder_pitch": -0.5, "r_shoulder_roll": 0.3, "r_elbow": 1.5,
               "r_wrist_prosup": -0.3}),
        (2.1, {**REST, "neck_pitch": 0.15, "neck_roll": 0.1,
               "r_shoulder_pitch": -0.5, "r_shoulder_roll": 0.3, "r_elbow": 1.5,
               "r_wrist_prosup": 0.3}),
        (2.5, {**REST, "neck_pitch": 0.15, "neck_roll": 0.1,
               "r_shoulder_pitch": -0.5, "r_shoulder_roll": 0.3, "r_elbow": 1.5}),
        (3.2, REST),
    ],

    "dance": [
        (0.0, REST),
        (0.5, {**REST, "torso_yaw": -0.3, "torso_roll":  0.1,
               "l_shoulder_pitch": -0.3, "r_shoulder_pitch": 0.1,
               "l_elbow": 0.8, "r_elbow": 1.2}),
        (1.0, {**REST, "torso_yaw":  0.3, "torso_roll": -0.1,
               "l_shoulder_pitch":  0.1, "r_shoulder_pitch": -0.3,
               "l_elbow": 1.2, "r_elbow": 0.8}),
        (1.5, {**REST, "torso_yaw": -0.3, "torso_roll":  0.1,
               "l_shoulder_pitch": -0.3, "r_shoulder_pitch": 0.1,
               "l_elbow": 0.8, "r_elbow": 1.2}),
        (2.0, {**REST, "torso_yaw":  0.3, "torso_roll": -0.1,
               "l_shoulder_pitch":  0.1, "r_shoulder_pitch": -0.3,
               "l_elbow": 1.2, "r_elbow": 0.8}),
        (2.5, {**REST, "torso_yaw": -0.3, "torso_roll":  0.1,
               "l_shoulder_pitch": -0.3, "r_shoulder_pitch": 0.1,
               "l_elbow": 0.8, "r_elbow": 1.2}),
        (3.0, {**REST, "torso_yaw":  0.3, "torso_roll": -0.1,
               "l_shoulder_pitch":  0.1, "r_shoulder_pitch": -0.3,
               "l_elbow": 1.2, "r_elbow": 0.8}),
        (3.5, {**REST,
               "l_shoulder_pitch": -0.8, "r_shoulder_pitch": -0.8,
               "l_shoulder_roll": 0.5, "r_shoulder_roll": 0.5,
               "l_elbow": 0.3, "r_elbow": 0.3, "neck_pitch": 0.2}),
        (4.5, REST),
    ],

    "stretch": [
        (0.0, REST),
        (1.2, {**REST,
               "l_shoulder_pitch": -1.0, "r_shoulder_pitch": -1.0,
               "l_elbow": 0.2, "r_elbow": 0.2, "torso_pitch": 0.1}),
        (2.0, {**REST,
               "l_shoulder_pitch": 0.0, "r_shoulder_pitch": 0.0,
               "l_shoulder_roll": 1.2, "r_shoulder_roll": 1.2,
               "l_elbow": 0.1, "r_elbow": 0.1}),
        (3.2, {**REST,
               "torso_roll":  0.3, "neck_roll":  0.1}),
        (4.0, {**REST,
               "torso_roll": -0.3, "neck_roll": -0.1}),
        (5.0, REST),
    ],

    "reset": [
        (0.0, REST),
        (1.5, REST),
    ],
}


# ─── Player ───────────────────────────────────────────────────────────────────
class AnimationPlayer(Node):
    RATE_HZ = 30

    def __init__(self, animation_name: str):
        super().__init__("animation_player")
        self.pub = self.create_publisher(JointState, "/joint_commands", 10)
        self.animation_name = animation_name

    def play(self, keyframes):
        duration = keyframes[-1][0]
        interval = 1.0 / self.RATE_HZ
        start = time.time()
        print(f"▶  Playing '{self.animation_name}' ({duration:.1f}s @ {self.RATE_HZ}Hz)")

        while True:
            t = time.time() - start
            if t > duration:
                break

            pose = interpolate_keyframes(keyframes, t)

            msg = JointState()
            msg.header.stamp = self.get_clock().now().to_msg()
            msg.name = list(pose.keys())
            msg.position = list(pose.values())
            self.pub.publish(msg)

            elapsed = time.time() - start - t
            sleep_time = interval - elapsed
            if sleep_time > 0:
                time.sleep(sleep_time)

        print(f"✅ Done '{self.animation_name}'")


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        print(__doc__)
        print("Available animations:", ", ".join(sorted(ANIMATIONS.keys())))
        sys.exit(0)

    cmd = sys.argv[1]

    if cmd == "list":
        print("Available animations:")
        for name, kf in sorted(ANIMATIONS.items()):
            print(f"  {name:<15} ({kf[-1][0]:.1f}s)")
        sys.exit(0)

    if cmd == "full":
        sequence = ["wave", "bow", "t_pose", "look_around",
                    "stretch", "dance", "victory", "think", "reset"]
    elif cmd in ANIMATIONS:
        sequence = [cmd]
    else:
        print(f"Unknown animation: '{cmd}'")
        print("Available:", ", ".join(sorted(ANIMATIONS.keys())))
        sys.exit(1)

    rclpy.init()
    for name in sequence:
        player = AnimationPlayer(name)
        player.play(ANIMATIONS[name])
        rclpy.spin_once(player, timeout_sec=0)
        player.destroy_node()
        if len(sequence) > 1:
            time.sleep(0.3)  # brief pause between animations
    rclpy.shutdown()


if __name__ == "__main__":
    main()
