# Scenario Generation Analysis & Proposal

This document analyzes the current scenario generation mechanism in the `robot-dashboard` project and proposes a new workflow integrating `gp2f` for collaborative, policy-driven scenario design.

## 1. Current State Analysis

### 1.1 Implementation
Currently, scenarios are hardcoded as static TypeScript arrays in `src/scenarios/presets.ts`. Each scenario is defined as a list of `ObstacleConfig` objects, which specify the properties of each obstacle in the 3D world.

**Key Components:**
- **Data Structure:** `ObstacleConfig` (defined in `src/types.ts`) includes:
  - `id`: Unique identifier
  - `type`: `box` | `wall` | `person`
  - `position`: `[x, y, z]` coordinates
  - `rotation`: Y-axis rotation
  - `scale`: `[width, height, depth]`
  - `color`: Hex color string
  - `dynamic`: Boolean flag for physics interaction (movable vs. static)
- **Loading Mechanism:** The `WorldEditorPanel` component imports `SCENARIO_PRESETS` and allows users to apply a preset. This triggers an update to the `CrdtWorldContext`, which synchronizes the obstacle state across clients.
- **Rendering & Physics:** The `RobotDigitalTwin` and `World` components render these obstacles using `@react-three/rapier`. Static obstacles (e.g., walls) become fixed rigid bodies, while dynamic ones (e.g., boxes) become dynamic rigid bodies that the robot can push.

### 1.2 Limitations
- **Rigidity:** Creating or modifying a scenario requires code changes to `src/scenarios/presets.ts` and a rebuild/redeployment of the application.
- **No Visual Editor:** There is no dedicated UI for placing objects; coordinates must be calculated manually or trial-and-errored.
- **Lack of Validation:** There are no inherent checks to prevent invalid configurations (e.g., overlapping walls, blocking the robot's spawn point).

## 2. Proposed Solution: External Scenario Designer with `gp2f` Integration

We propose shifting from hardcoded presets to a **data-driven workflow** where scenarios are designed in an external platform, exported as JSON, and loaded dynamically into the robot dashboard.

### 2.1 The Workflow
1.  **Design:** A user opens the **Scenario Designer** (a new or external web tool).
2.  **Edit:** The user drags and drops obstacles (walls, boxes, people) onto a 2D/3D canvas.
    - *Role of `gp2f`:* The designer tool uses `gp2f` to manage the scenario state. This allows for:
        - **Real-time Collaboration:** Multiple users can edit the same scenario simultaneously without conflicts (using CRDTs/LWW).
        - **Policy Enforcement:** `gp2f` policies can enforce rules like "walls cannot overlap", "must have at least one exit", or "robot spawn area must be clear".
        - **AI Assistance:** An AI agent could suggest optimal obstacle placements based on the robot's capabilities, vetted by `gp2f` policies.
3.  **Export:** The designed scenario is exported as a JSON file (e.g., `scenario_warehouse_v2.json`).
4.  **Import:** In the main **Robot Dashboard**, the user clicks "Import Scenario" in the `WorldEditorPanel`.
5.  **Run:** The dashboard parses the JSON and instantiates the obstacles. Since the underlying `ObstacleConfig` structure is preserved, the physical responsiveness (collisions, dynamics) works exactly as it does with hardcoded presets.

### 2.2 Data Format (JSON Schema)
The exported JSON file will mirror the existing `ObstacleConfig` structure to ensure seamless integration.

**Example `scenario.json`:**
```json
{
  "version": "1.0",
  "name": "Custom Warehouse",
  "obstacles": [
    {
      "id": "wall-01",
      "type": "wall",
      "position": [0, 1, -5],
      "rotation": 0,
      "scale": [10, 2, 0.3],
      "color": "#7f8c8d",
      "dynamic": false
    },
    {
      "id": "box-01",
      "type": "box",
      "position": [2, 0.25, 0],
      "rotation": 0.5,
      "scale": [0.5, 0.5, 0.5],
      "color": "#e67e22",
      "dynamic": true
    }
  ]
}
```

### 2.3 Integration Details

#### A. Scenario Designer (New/External Tool)
This tool will be a standalone React application (or a module within an existing platform) that:
- Uses `gp2f` (or `@crdt-sync`) to maintain the list of obstacles.
- Provides a UI for adding/manipulating `ObstacleConfig` objects.
- Implements a "Download JSON" button that serializes the current state.

#### B. Robot Dashboard (Current App)
We will enhance `src/components/WorldEditorPanel.tsx` to support file imports.

**New Feature: `ImportScenarioButton`**
- **UI:** A simple file input button (`<input type="file" accept=".json" />`).
- **Logic:**
  1.  Read the selected file.
  2.  Parse JSON content.
  3.  Validate against a schema (ensure all required fields like `position`, `scale` exist).
  4.  Call `setObstacles(parsedObstacles)` from `CrdtWorldContext`.
  5.  (Optional) Add the imported scenario to a "Custom Scenarios" list in the UI for quick switching during the session.

### 2.4 Responsiveness & Physics
The critical requirement is that the loaded scenario "can be responsive to the robot like it currently is."

**How this is preserved:**
The `RobotDigitalTwin` and `World` components in the dashboard interact with obstacles solely through the `ObstacleConfig` interface. They do not care if the obstacle came from a hardcoded array or a parsed JSON file.
- **Dynamic Objects:** If the JSON specifies `"dynamic": true` (e.g., for a box), `@react-three/rapier` will automatically create a dynamic rigid body with mass. The robot will be able to push it.
- **Static Objects:** If `"dynamic": false` (e.g., for a wall), it becomes a static collider. The robot will collide with it but not move it.

Therefore, **full physical responsiveness is guaranteed** as long as the exported JSON correctly sets the `type`, `scale`, and `dynamic` properties.

## 3. Summary of Benefits

| Feature | Current Approach (Presets) | Proposed Approach (External Designer + JSON) |
| :--- | :--- | :--- |
| **Creation** | Hardcoded TypeScript | Visual Drag & Drop Interface |
| **Flexibility** | Requires code change & rebuild | Dynamic loading at runtime |
| **Collaboration** | Git merge conflicts | Real-time sync via `gp2f` / CRDTs |
| **Validation** | Manual code review | Automated Policy Checks (e.g., overlap detection) |
| **Sharing** | Code sharing | JSON file sharing |

This proposal leverages the strengths of the existing rendering engine while introducing a flexible, data-driven workflow for scenario creation.
