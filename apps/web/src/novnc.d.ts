declare module '@novnc/novnc' {
  export default class RFB {
    constructor(target: HTMLElement, urlOrChannel: string | WebSocket);
    scaleViewport: boolean;
    resizeSession: boolean;
    disconnect(): void;
    addEventListener(event: 'connect' | 'disconnect' | 'credentialsrequired', listener: (e: any) => void): void;
  }
}
