declare module 'urdf-loader' {
    export default class URDFLoader {
        constructor(manager?: import('three').LoadingManager);
        packages: Record<string, string> | string;
        parse(content: string): any;
    }
}
