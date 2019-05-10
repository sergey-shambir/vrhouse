export interface WebVRPolyfillConfig {
    ADDITIONAL_VIEWERS: any[];
    DEFAULT_VIEWER: string;
    PROVIDE_MOBILE_VRDISPLAY: boolean;
    MOBILE_WAKE_LOCK: boolean;
    DEBUG: boolean;
    DPDB_URL: string;
    K_FILTER: number;
    PREDICTION_TIME_S: number;
    CARDBOARD_UI_DISABLED: boolean;
    ROTATE_INSTRUCTIONS_DISABLED: boolean;
    YAW_ONLY: boolean;
    BUFFER_SCALE: number;
    DIRTY_SUBMIT_FRAME_BINDINGS: boolean;
}

export class WebVRPolyfill {
    version: string;
    VRFrameData: VRFrameData;

    constructor(config?: WebVRPolyfillConfig);
    getVRDisplays(): VRDisplay[];
    getPolyfillDisplays(): VRDisplay[];
    enable(): void;
}

export function mockWebVR(): Promise<WebVRPolyfill>;
