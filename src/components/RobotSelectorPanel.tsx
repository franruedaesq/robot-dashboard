import { useState, useRef } from 'react';
import type { PackageMap } from '../types';
import { PRELOADED_ROBOTS, DEFAULT_PKG_MAP } from '../robots/catalog';

export function RobotSelectorPanel({
    onLoad,
}: {
    onLoad: (urdfText: string, pkgMap: PackageMap, forwardAngle?: number, visualYOffset?: number) => void;
}) {
    const [activeTab, setActiveTab] = useState<'preloaded' | 'custom'>('preloaded');
    const [selectedId, setSelectedId] = useState(PRELOADED_ROBOTS[0].id);
    const [urlInput, setUrlInput] = useState('');
    const [pkgInput, setPkgInput] = useState(
        Object.entries(DEFAULT_PKG_MAP).map(([k, v]) => `${k}=${v}`).join('\n')
    );
    const [dragging, setDragging] = useState(false);
    const [error, setError] = useState('');
    const fileRef = useRef<HTMLInputElement>(null);

    const parsePkgMap = (raw: string): PackageMap => {
        const map: PackageMap = {};
        raw.split('\n').forEach(line => {
            const [k, ...rest] = line.trim().split('=');
            if (k && rest.length) map[k.trim()] = rest.join('=').trim();
        });
        return map;
    };

    const handleText = (text: string) => {
        setError('');
        onLoad(text, parsePkgMap(pkgInput));
    };

    const handleFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = e => handleText(e.target?.result as string);
        reader.readAsText(file);
    };

    const handleUrl = async () => {
        try {
            const res = await fetch(urlInput);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            handleText(await res.text());
        } catch (e: any) { setError(e.message); }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault(); setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    };

    const inputStyle: React.CSSProperties = {
        backgroundColor: '#0d1220', color: '#cde', border: '1px solid #2a3a5a',
        borderRadius: 6, padding: '6px 10px', fontSize: '0.78rem', fontFamily: 'monospace',
        width: '100%', boxSizing: 'border-box',
    };
    const btnStyle: React.CSSProperties = {
        padding: '6px 14px', fontSize: '0.78rem', cursor: 'pointer',
        backgroundColor: '#1e3860', color: '#8cf', border: '1px solid #3a6ea5',
        borderRadius: 6, whiteSpace: 'nowrap',
    };
    const tabStyle = (active: boolean): React.CSSProperties => ({
        padding: '7px 20px', fontSize: '0.8rem', cursor: 'pointer',
        backgroundColor: active ? '#1e3860' : 'transparent',
        color: active ? '#8cf' : '#567',
        border: 'none', borderBottom: active ? '2px solid #5af' : '2px solid transparent',
        fontFamily: 'monospace', fontWeight: active ? 600 : 400,
        transition: 'all 0.15s',
    });

    return (
        <div style={{ backgroundColor: '#080d1a', border: '1px solid #1e2a4a', borderRadius: 10, width: '100%', maxWidth: 900, boxSizing: 'border-box', overflow: 'hidden' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid #1e2a4a' }}>
                <button style={tabStyle(activeTab === 'preloaded')} onClick={() => setActiveTab('preloaded')}>
                    📦 Robots precargados
                </button>
                <button style={tabStyle(activeTab === 'custom')} onClick={() => setActiveTab('custom')}>
                    📂 Cargar robot
                </button>
            </div>

            <div style={{ padding: '14px 16px' }}>
                {activeTab === 'preloaded' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <select
                            value={selectedId}
                            onChange={e => setSelectedId(e.target.value)}
                            style={{ ...inputStyle, flex: 1, cursor: 'pointer' }}
                        >
                            {PRELOADED_ROBOTS.map(r => (
                                <option key={r.id} value={r.id}>{r.label}</option>
                            ))}
                        </select>
                        <button
                            style={{ ...btnStyle, backgroundColor: '#1e5f3f', color: '#2ecc71', borderColor: '#2ecc71' }}
                            onClick={() => {
                                const robot = PRELOADED_ROBOTS.find(r => r.id === selectedId)!;
                                onLoad(robot.urdf, robot.pkgMap, robot.forwardAngle, robot.visualYOffset);
                            }}
                        >
                            Cargar
                        </button>
                    </div>
                )}

                {activeTab === 'custom' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div>
                            <div style={{ color: '#567', fontSize: '0.72rem', marginBottom: 3 }}>
                                Mapa de packages <span style={{ opacity: 0.55 }}>(nombre=URL base, una por línea)</span>
                            </div>
                            <textarea
                                rows={2}
                                value={pkgInput}
                                onChange={e => setPkgInput(e.target.value)}
                                style={{ ...inputStyle, resize: 'vertical' }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input
                                style={inputStyle}
                                placeholder="https://…/robot.urdf"
                                value={urlInput}
                                onChange={e => setUrlInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleUrl()}
                            />
                            <button style={btnStyle} onClick={handleUrl}>Cargar URL</button>
                        </div>
                        <div
                            onDragOver={e => { e.preventDefault(); setDragging(true); }}
                            onDragLeave={() => setDragging(false)}
                            onDrop={handleDrop}
                            onClick={() => fileRef.current?.click()}
                            style={{
                                padding: '12px', textAlign: 'center',
                                border: `2px dashed ${dragging ? '#5af' : '#2a3a5a'}`,
                                borderRadius: 8, color: dragging ? '#5af' : '#567',
                                fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.15s',
                            }}
                        >
                            {dragging ? '¡Suelta el archivo!' : '📄 Arrastra un .urdf aquí o haz clic para seleccionar'}
                        </div>
                        <input ref={fileRef} type="file" accept=".urdf,.xml" style={{ display: 'none' }}
                            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                        {error && <div style={{ color: '#f88', fontSize: '0.75rem' }}>⚠️ {error}</div>}
                    </div>
                )}
            </div>
        </div>
    );
}
