export const getRobotConfig = (robotName: string | undefined) => {
    if (!robotName) return {};
    try {
        return JSON.parse(localStorage.getItem(`robot_config_${robotName}`) || '{}');
    } catch {
        return {};
    }
};

export const updateRobotConfig = (robotName: string | undefined, updates: any) => {
    if (!robotName) return;
    try {
        const existing = getRobotConfig(robotName);
        localStorage.setItem(`robot_config_${robotName}`, JSON.stringify({ ...existing, ...updates }));
    } catch (e) {
        console.warn("Failed to save to localStorage", e);
    }
};
