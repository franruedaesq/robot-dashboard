import { useEffect, useRef, useState } from 'react';
import * as ROSLIB from 'roslib';

export function RealLiDARPanel({ ros, topicName = '/scan', title = '🟢 /scan — Real LiDAR' }: { ros: ROSLIB.Ros | null, topicName?: string, title?: string }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [zoom, setZoom] = useState(1);
    const zoomRef = useRef(1);

    useEffect(() => {
        zoomRef.current = zoom;
    }, [zoom]);

    useEffect(() => {
        if (!ros) return;
        const topic = new ROSLIB.Topic<any>({ ros, name: topicName, messageType: 'sensor_msgs/LaserScan' });

        // animation frame radar sweep
        let sweepAngle = 0;
        let animationFrame: number;
        let latestMsg: any = null;

        const render = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const W = canvas.width, H = canvas.height, cx = W / 2, cy = H / 2;
            const msg = latestMsg;
            const maxRange = msg?.range_max || 10;
            const scale = ((W / 2) / maxRange) * zoomRef.current;

            // Fade background for sweep trail
            ctx.fillStyle = 'rgba(13, 13, 26, 0.15)';
            ctx.fillRect(0, 0, W, H);

            // Draw Grid
            ctx.strokeStyle = 'rgba(42, 42, 74, 0.5)';
            ctx.lineWidth = 1;
            for (let ri = 1; ri <= 4; ri++) {
                ctx.beginPath();
                ctx.arc(cx, cy, (W / 2) * (ri / 4), 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke();

            // Draw Sweep Line
            sweepAngle = (sweepAngle + 0.05) % (Math.PI * 2);
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(-sweepAngle) * W, cy + Math.sin(-sweepAngle) * H);
            ctx.strokeStyle = 'rgba(0, 255, 136, 0.5)';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw Sweep Gradient
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, W, -sweepAngle, -sweepAngle - 0.5, true);
            ctx.closePath();
            ctx.fillStyle = 'rgba(0, 255, 136, 0.1)';
            ctx.fill();

            // Draw Points
            if (msg && msg.ranges) {
                ctx.fillStyle = '#00ff88';
                ctx.shadowBlur = 8;
                ctx.shadowColor = '#00ff88';
                (msg.ranges as number[]).forEach((dist: number, i: number) => {
                    const angle = msg.angle_min + i * msg.angle_increment;
                    if (!isFinite(dist) || dist < msg.range_min || dist > msg.range_max) return;

                    const px = cx + Math.cos(angle) * dist * scale;
                    const py = cy - Math.sin(angle) * dist * scale;

                    ctx.beginPath();
                    ctx.arc(px, py, 1.5, 0, Math.PI * 2);
                    ctx.fill();
                });
                ctx.shadowBlur = 0; // reset
            }

            // Draw Center Robot
            ctx.fillStyle = '#3498db';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#3498db';
            ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;

            animationFrame = requestAnimationFrame(render);
        };

        const handler = (msg: any) => {
            latestMsg = msg;
        };

        topic.subscribe(handler);
        animationFrame = requestAnimationFrame(render);

        return () => {
            topic.unsubscribe(handler);
            cancelAnimationFrame(animationFrame);
        };
    }, [ros, topicName]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#00ff88', fontSize: '0.75rem', fontFamily: 'monospace', textShadow: '0 0 5px #00ff88' }}>
                {title}
            </span>
            <div style={{ position: 'relative', width: 250, height: 250, border: '1px solid #2a2a4a', borderRadius: '50%', overflow: 'hidden', boxShadow: '0 0 15px rgba(0, 255, 136, 0.1)' }}>
                <canvas ref={canvasRef} width={250} height={250} style={{ position: 'absolute', top: 0, left: 0 }} />
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                <span style={{ color: '#888', fontSize: '0.7rem' }}>Zoom:</span>
                <input
                    type="range"
                    min="0.5"
                    max="5"
                    step="0.1"
                    value={zoom}
                    onChange={e => setZoom(parseFloat(e.target.value))}
                    style={{ width: '100px', cursor: 'pointer', accentColor: '#00ff88' }}
                />
                <span style={{ color: '#ccc', fontSize: '0.7rem', width: '20px' }}>{zoom.toFixed(1)}x</span>
            </div>
        </div>
    );
}
