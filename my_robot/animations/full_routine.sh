#!/bin/bash
# 🔄 Rutina completa — todas las animaciones encadenadas
source /opt/ros/humble/setup.bash

echo "════════════════════════════════════"
echo "  🤖 iCub Darmstadt — Rutina Completa"
echo "════════════════════════════════════"

SCRIPTS_DIR="$(dirname "$0")"

run() {
  echo ""
  echo "▶️  $1"
  bash "$SCRIPTS_DIR/$2"
  sleep 0.5
}

run "Saludando..."       wave.sh
run "Reverencia..."      bow.sh
run "T-Pose..."          t_pose.sh
run "Mirando alrededor..." look_around.sh
run "Estirando..."       stretch.sh
run "¡Bailando!"         dance.sh
run "¡Victoria!"         victory.sh
run "Pensando..."        think.sh

echo ""
echo "════════════════════════════════════"
echo "✅ Rutina completa terminada"
echo "════════════════════════════════════"
