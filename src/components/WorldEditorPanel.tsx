import type { ObstacleConfig, ObstacleType, ScenarioPreset } from '../types';
import { SCENARIO_PRESETS } from '../scenarios/presets';

interface WorldEditorPanelProps {
    obstacles:        ObstacleConfig[];
    placingType:      ObstacleType | null;
    placingDynamic:   boolean;
    placingRotation:  number;
    onSelectType:     (t: ObstacleType | null) => void;
    onToggleDynamic:  (dynamic: boolean) => void;
    onToggleRotation: () => void;
    onLoadScenario:   (preset: ScenarioPreset) => void;
    onClearAll:       () => void;
    onDeleteObstacle: (id: string) => void;
}

const TYPE_ICONS: Record<ObstacleType, string> = {
    box:    '📦',
    wall:   '🧱',
    person: '🧍',
};

const TYPE_LABELS: Record<ObstacleType, string> = {
    box:    'Caja',
    wall:   'Pared',
    person: 'Persona',
};

export function WorldEditorPanel({
    obstacles, placingType, placingDynamic, placingRotation,
    onSelectType, onToggleDynamic, onToggleRotation,
    onLoadScenario, onClearAll, onDeleteObstacle,
}: WorldEditorPanelProps) {

    // ── Shared style tokens ──────────────────────────────────────────────────
    const base: React.CSSProperties = {
        fontFamily: 'monospace', fontSize: '0.78rem',
        backgroundColor: '#080d1a', color: '#cde',
        border: '1px solid #1e2a4a', borderRadius: 10,
        width: '100%', maxWidth: 900, boxSizing: 'border-box' as const,
        overflow: 'hidden',
    };

    const sectionStyle: React.CSSProperties = {
        borderBottom: '1px solid #1e2a4a', padding: '10px 14px',
    };

    const labelStyle: React.CSSProperties = {
        color: '#567', fontSize: '0.7rem', marginBottom: 6,
        textTransform: 'uppercase' as const, letterSpacing: '0.08em',
    };

    const btn = (
        label: string,
        active: boolean,
        onClick: () => void,
        accent = '#5af',
    ): React.ReactNode => (
        <button
            key={label}
            onClick={onClick}
            style={{
                padding: '5px 12px', fontSize: '0.78rem', cursor: 'pointer',
                backgroundColor: active ? `${accent}22` : '#0d1220',
                color: active ? accent : '#788',
                border: `1px solid ${active ? accent : '#2a3a5a'}`,
                borderRadius: 6, transition: 'all 0.15s', whiteSpace: 'nowrap' as const,
            }}
        >{label}</button>
    );

    const TYPES: ObstacleType[] = ['box', 'wall', 'person'];

    return (
        <div style={base}>
            {/* Header */}
            <div style={{ ...sectionStyle, display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #1e2a4a' }}>
                <span style={{ color: '#8cf', fontWeight: 600, fontSize: '0.82rem' }}>🌍 Editor de Entorno</span>
                <span style={{ color: '#345', fontSize: '0.68rem' }}>{obstacles.length} objeto{obstacles.length !== 1 ? 's' : ''}</span>
            </div>

            {/* ── Scenarios ────────────────────────────────────────────────── */}
            <div style={sectionStyle}>
                <div style={labelStyle}>Escenarios predefinidos</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                    {SCENARIO_PRESETS.map(p =>
                        btn(`${p.icon} ${p.label}`, false, () => onLoadScenario(p), '#2ecc71')
                    )}
                    {btn('🗑 Vaciar', false, onClearAll, '#e74c3c')}
                </div>
            </div>

            {/* ── Add obstacle ─────────────────────────────────────────────── */}
            <div style={sectionStyle}>
                <div style={labelStyle}>Añadir obstáculo</div>

                {/* Type buttons */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 8 }}>
                    {TYPES.map(t =>
                        btn(
                            `${TYPE_ICONS[t]} ${TYPE_LABELS[t]}`,
                            placingType === t,
                            () => onSelectType(placingType === t ? null : t),
                        )
                    )}
                </div>

                {/* Options row — only shown when a type is selected */}
                {placingType && (
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' as const, marginTop: 4 }}>

                        {/* Dynamic / Fixed toggle */}
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span style={{ color: '#567', fontSize: '0.7rem' }}>Física:</span>
                            {btn('⚙️ Dinámico', placingDynamic,   () => onToggleDynamic(true),  '#e67e22')}
                            {btn('🔒 Fijo',     !placingDynamic,  () => onToggleDynamic(false), '#7f8c8d')}
                        </div>

                        {/* Wall rotation (only for walls) */}
                        {placingType === 'wall' && (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <span style={{ color: '#567', fontSize: '0.7rem' }}>Orientación:</span>
                                {btn('↔ Horizontal', placingRotation === 0,              () => onToggleRotation(), '#8cf')}
                                {btn('↕ Vertical',   placingRotation !== 0, () => onToggleRotation(), '#8cf')}
                            </div>
                        )}
                    </div>
                )}

                {/* Placement mode status banner */}
                {placingType && (
                    <div style={{
                        marginTop: 8, padding: '6px 10px',
                        backgroundColor: 'rgba(90,175,255,0.08)',
                        border: '1px solid rgba(90,175,255,0.3)',
                        borderRadius: 6, color: '#8cf', fontSize: '0.73rem',
                        display: 'flex', alignItems: 'center', gap: 10,
                    }}>
                        <span>💡 Haz clic en el suelo 3D para colocar {TYPE_ICONS[placingType]} {TYPE_LABELS[placingType]}</span>
                        <button
                            onClick={() => onSelectType(null)}
                            style={{
                                marginLeft: 'auto', padding: '2px 10px', fontSize: '0.72rem',
                                backgroundColor: 'transparent', color: '#f88',
                                border: '1px solid #f886', borderRadius: 4, cursor: 'pointer',
                            }}
                        >Cancelar</button>
                    </div>
                )}
            </div>

            {/* ── Obstacle list ────────────────────────────────────────────── */}
            {obstacles.length > 0 && (
                <div style={{ padding: '10px 14px', maxHeight: 160, overflowY: 'auto' as const }}>
                    <div style={labelStyle}>Objetos en escena</div>
                    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 3 }}>
                        {obstacles.map((obs, i) => (
                            <div key={obs.id} style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '2px 6px', borderRadius: 4,
                                backgroundColor: 'rgba(255,255,255,0.02)',
                            }}>
                                <span style={{ color: '#456', fontSize: '0.65rem', minWidth: 22 }}>#{i + 1}</span>
                                <span>{TYPE_ICONS[obs.type]}</span>
                                <span style={{ color: '#789', fontSize: '0.7rem', flex: 1 }}>
                                    {TYPE_LABELS[obs.type]}
                                    {' '}
                                    <span style={{ color: '#456' }}>
                                        ({obs.position[0].toFixed(1)}, {obs.position[2].toFixed(1)})
                                    </span>
                                    {' '}
                                    <span style={{ color: obs.dynamic ? '#e67e22' : '#7f8c8d', fontSize: '0.65rem' }}>
                                        {obs.dynamic ? '⚙️' : '🔒'}
                                    </span>
                                </span>
                                <button
                                    onClick={() => onDeleteObstacle(obs.id)}
                                    style={{
                                        padding: '1px 7px', fontSize: '0.7rem', cursor: 'pointer',
                                        backgroundColor: 'transparent', color: '#e74c3c',
                                        border: '1px solid #e74c3c44', borderRadius: 4,
                                    }}
                                >✕</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
