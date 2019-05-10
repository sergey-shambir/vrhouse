export enum XRSessionMode {
    Inline = "inline",
    ImmersiveVR = "immersive-vr",
    ImmersiveAR = "immersive-ar"
}

export interface XRSession {
    // NOTE: incomplete, see https://immersive-web.github.io/webxr/#xrsession-interface
}

export interface XRVRDisplay extends VRDisplay {
    supportsSession(mode: XRSessionMode): Promise<void>;
    requestSession(mode: XRSessionMode): Promise<XRSession>;
}

export interface XR {
    ondevicechange: EventHandlerNonNull;
    supportsSession(mode: XRSessionMode): Promise<void>;
    requestSession(mode: XRSessionMode): Promise<XRSession>;
    requestDevice(): Promise<XRVRDisplay>;
}
