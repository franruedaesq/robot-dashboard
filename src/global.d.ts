declare module 'tf-engine' {
    export class Vec3 {
        constructor(x?: number, y?: number, z?: number);
        x: number;
        y: number;
        z: number;
        static zero(): Vec3;
        static fromArray(arr: [number, number, number]): Vec3;
        add(other: Vec3): Vec3;
        subtract(other: Vec3): Vec3;
        scale(scalar: number): Vec3;
        length(): number;
        normalize(): Vec3;
        dot(other: Vec3): number;
        cross(other: Vec3): Vec3;
        lerp(other: Vec3, t: number): Vec3;
        equals(other: Vec3, epsilon?: number): boolean;
        toArray(): [number, number, number];
        toString(): string;
    }

    export class Quaternion {
        constructor(x?: number, y?: number, z?: number, w?: number);
        x: number;
        y: number;
        z: number;
        w: number;
        static identity(): Quaternion;
        static fromAxisAngle(axis: Vec3, angleRad: number): Quaternion;
        static fromEulerXYZ(x: number, y: number, z: number): Quaternion;
        static fromArray(arr: [number, number, number, number]): Quaternion;
        multiply(other: Quaternion): Quaternion;
        invert(): Quaternion;
        normalize(): Quaternion;
        rotateVec3(v: Vec3): Vec3;
        slerp(other: Quaternion, t: number): Quaternion;
        equals(other: Quaternion, epsilon?: number): boolean;
        toArray(): [number, number, number, number];
        toString(): string;
    }

    export class Transform {
        constructor(translation?: Vec3, rotation?: Quaternion);
        translation: Vec3;
        rotation: Quaternion;
        static identity(): Transform;
        static fromMat4(m: Float32Array): Transform;
        compose(other: Transform): Transform;
        invert(): Transform;
        transformPoint(point: Vec3): Vec3;
        equals(other: Transform, epsilon?: number): boolean;
        toMat4(): Float32Array;
    }

    export class CycleDetectedError extends Error {
        constructor(message: string);
    }

    export interface TFTreeJSON {
        [key: string]: any;
    }

    export class TFTree {
        constructor();
        addFrame(id: string, parentId?: string, transform?: Transform): void;
        updateTransform(id: string, transform: Transform): void;
        updateFrame(id: string, transform: Transform): void;
        updateTransforms(updates: Record<string, Transform>): void;
        removeFrame(id: string): void;
        hasFrame(id: string): boolean;
        frameIds(): string[];
        getTransform(from: string, to: string): Transform;
        onChange(frameId: string, callback: (frameId: string) => void): () => void;
        toJSON(): TFTreeJSON;
        static fromJSON(data: TFTreeJSON): TFTree;
    }

    export interface BufferedTFTreeOptions {
        maxBufferDuration?: number;
    }

    export class BufferedTFTree extends TFTree {
        constructor(options?: BufferedTFTreeOptions);
        setTransform(id: string, transform: Transform, timestamp: number): void;
        getTransformAt(from: string, to: string, timestamp: number): Transform;
        removeFrame(id: string): void;
    }
}
