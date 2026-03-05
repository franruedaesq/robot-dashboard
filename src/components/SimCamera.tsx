import { useEffect, useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as ROSLIB from 'roslib';
import * as THREE from 'three';
import { SENSOR_HZ, CAM_W, CAM_H } from '../constants';
import type { PoseRef } from './RobotPhysicsBody';

export function SimCamera({ bodyRef, ros, enabled, thumbnailCanvasRef, httpEndpoint, expandedCanvasRef }: {
    bodyRef: React.RefObject<PoseRef | null>;
    ros: ROSLIB.Ros | null;
    enabled: boolean;
    thumbnailCanvasRef: React.RefObject<HTMLCanvasElement | null>;
    httpEndpoint?: string;
    expandedCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
}) {
    const { gl, scene } = useThree();
    const camRef = useRef(new THREE.PerspectiveCamera(70, CAM_W / CAM_H, 0.05, 50));
    const renderTarget = useMemo(() => new THREE.WebGLRenderTarget(CAM_W, CAM_H, { depthBuffer: true }), []);
    const pixelBuf = useMemo(() => new Uint8Array(CAM_W * CAM_H * 4), []);
    const offCanvas = useMemo(() => {
        const c = document.createElement('canvas');
        c.width = CAM_W; c.height = CAM_H;
        return c;
    }, []);
    const lastTime = useRef(0);
    const topicRef = useRef<ROSLIB.Topic<any> | null>(null);
    const postInFlight = useRef(false);

    useEffect(() => {
        if (!ros) return;
        topicRef.current = new ROSLIB.Topic<any>({ ros, name: '/sim_camera/compressed', messageType: 'sensor_msgs/CompressedImage' });
        return () => { topicRef.current = null; };
    }, [ros]);

    useEffect(() => () => { renderTarget.dispose(); }, [renderTarget]);

    useFrame(({ clock }) => {
        const body = bodyRef.current;
        if (!body || !enabled) return;
        if (clock.elapsedTime - lastTime.current < 1 / SENSOR_HZ) return;
        lastTime.current = clock.elapsedTime;

        const t = body.translation();
        const r = body.rotation();
        const yaw = 2 * Math.atan2(r.y, r.w);
        const cam = camRef.current;
        cam.position.set(t.x, t.y + 0.25, t.z);
        // Robot's forward direction is (cos yaw, 0, -sin yaw).
        // A Three.js camera looks along -Z by default; to look in +X at yaw=0
        // we need rotation.y = yaw - PI/2.
        cam.rotation.set(0, yaw - Math.PI / 2, 0);
        cam.updateProjectionMatrix();
        cam.updateMatrixWorld();

        gl.setRenderTarget(renderTarget);
        gl.clear(true, true, true);

        // Add a temporary ambient light to the scene just for this camera's view
        const ambientLight = new THREE.AmbientLight(0xffffff, 2.0); // Bright white light
        scene.add(ambientLight);

        gl.render(scene, cam);

        // Remove the temporary light and cleanup
        scene.remove(ambientLight);
        ambientLight.dispose();

        gl.setRenderTarget(null);
        gl.readRenderTargetPixels(renderTarget, 0, 0, CAM_W, CAM_H, pixelBuf);

        const ctx = offCanvas.getContext('2d');
        if (!ctx) return;
        const imgData = ctx.createImageData(CAM_W, CAM_H);
        for (let row = 0; row < CAM_H; row++) {
            const srcRow = CAM_H - 1 - row;
            imgData.data.set(pixelBuf.subarray(srcRow * CAM_W * 4, (srcRow + 1) * CAM_W * 4), row * CAM_W * 4);
        }
        ctx.putImageData(imgData, 0, 0);

        const thumb = thumbnailCanvasRef.current;
        if (thumb) thumb.getContext('2d')?.drawImage(offCanvas, 0, 0, thumb.width, thumb.height);

        const expanded = expandedCanvasRef?.current;
        if (expanded) expanded.getContext('2d')?.drawImage(offCanvas, 0, 0, expanded.width, expanded.height);

        const base64 = offCanvas.toDataURL('image/jpeg', 0.5).split(',')[1];
        topicRef.current?.publish({ format: 'jpeg', data: base64 });

        if (httpEndpoint && !postInFlight.current) {
            postInFlight.current = true;
            fetch(httpEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: base64, format: 'jpeg', width: CAM_W, height: CAM_H }),
            })
                .catch(() => { })
                .finally(() => { postInFlight.current = false; });
        }
    });

    return null;
}
