import { useEffect, useRef } from 'react';
import * as ROSLIB from 'roslib';

export function RealLiDARPanel({ ros }: { ros: ROSLIB.Ros | null }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!ros) return;
        const topic = new ROSLIB.Topic<any>({ ros, name: '/scan', messageType: 'sensor_msgs/LaserScan' });
        const handler = (msg: any) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            const W = canvas.width, H = canvas.height, cx = W / 2, cy = H / 2;
            const scale = (W / 2) / (msg.range_max || 10);
            ctx.clearRect(0, 0, W, H);
            ctx.fillStyle = '#0d0d1a'; ctx.fillRect(0, 0, W, H);
            for (let ri = 1; ri <= 4; ri++) {
                ctx.beginPath(); ctx.arc(cx, cy, (W / 2) * (ri / 4), 0, Math.PI * 2);
                ctx.strokeStyle = '#2a2a4a'; ctx.lineWidth = 0.5; ctx.stroke();
            }
            ctx.strokeStyle = '#2a2a4a';
            ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke();
            ctx.fillStyle = '#00ff88';
            (msg.ranges as number[]).forEach((dist: number, i: number) => {
                if (!isFinite(dist) || dist < msg.range_min || dist > msg.range_max) return;
                const angle = msg.angle_min + i * msg.angle_increment;
                ctx.beginPath(); ctx.arc(cx + Math.cos(angle) * dist * scale, cy - Math.sin(angle) * dist * scale, 1.5, 0, Math.PI * 2); ctx.fill();
            });
            ctx.fillStyle = '#3498db'; ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
        };
        topic.subscribe(handler);
        return () => topic.unsubscribe(handler);
    }, [ros]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#00ff88', fontSize: '0.75rem', fontFamily: 'monospace' }}>🟢 /scan — Real LiDAR</span>
            <canvas ref={canvasRef} width={250} height={250} style={{ border: '1px solid #2a2a4a', borderRadius: 8 }} />
        </div>
    );
}
