import type { PackageMap } from '../types';

// ── Raw URDF imports ──────────────────────────────────────────────────────────
import turtlebot3BurgerURDF from '../assets/robots/turtlebot3_burger.urdf?raw';
import turtlebot3WaffleURDF from '../assets/robots/turtlebot3_description/urdf/turtlebot3_waffle.urdf?raw';
import turtlebot3WafflePiURDF from '../assets/robots/turtlebot3_description/urdf/turtlebot3_waffle_pi.urdf?raw';
import iCubDarmstadt01 from '../assets/robots/iCub/robots/iCubDarmstadt01/model.urdf?raw';
import iCubErzelli02 from '../assets/robots/iCub/robots/iCubErzelli02/model.urdf?raw';
import tidybotURDF from '../assets/robots/tidybot_description/urdf/tidybot_isaac.urdf?raw';
// ── Package maps ──────────────────────────────────────────────────────────────
export const DEFAULT_PKG_MAP: PackageMap = {
    turtlebot3_description: 'http://localhost:8001/turtlebot3_description',
};

export const ICUB_PKG_MAP: PackageMap = {
    iCub: 'http://localhost:8001/iCub',
};

export const TIDYBOT_PKG_MAP: PackageMap = {
    tidybot_description: 'http://localhost:8001/tidybot_description',
};

// ── Robot catalogue ───────────────────────────────────────────────────────────
export interface RobotCatalogEntry {
    id: string;
    label: string;
    urdf: string;
    pkgMap: PackageMap;
    /** Y-axis rotation (radians) to align the robot's visual front with +X.
     *  0 = standard ROS convention (+X forward). */
    forwardAngle?: number;
    /** Visual offset added to the rendered model to fine-tune placement on the floor. */
    visualYOffset?: number;
}

export const PRELOADED_ROBOTS: RobotCatalogEntry[] = [
    { id: 'tb3_burger', label: 'TurtleBot3 Burger', urdf: turtlebot3BurgerURDF, pkgMap: DEFAULT_PKG_MAP },
    { id: 'tb3_waffle', label: 'TurtleBot3 Waffle', urdf: turtlebot3WaffleURDF, pkgMap: DEFAULT_PKG_MAP },
    { id: 'tb3_waffle_pi', label: 'TurtleBot3 Waffle PI', urdf: turtlebot3WafflePiURDF, pkgMap: DEFAULT_PKG_MAP },
    // iCub's visual front faces −X after the ROS→Three.js coord transform,
    // so we rotate it π around Y to align with the +X physics forward direction.
    { id: 'iCubDarmstadt01', label: 'iCub Darmstadt 01', urdf: iCubDarmstadt01, pkgMap: ICUB_PKG_MAP, forwardAngle: Math.PI },
    { id: 'iCubErzelli02', label: 'iCub Erzelli 02', urdf: iCubErzelli02, pkgMap: ICUB_PKG_MAP, forwardAngle: Math.PI },
    { id: 'tidybot', label: 'Tidybot', urdf: tidybotURDF, pkgMap: TIDYBOT_PKG_MAP },
];
