/**
 * @author mrdoob / http://mrdoob.com
 * @author Mugen87 / https://github.com/Mugen87
 *
 * Based on @tojiro's vr-samples-utils.js
 */

import * as THREE from 'three';
import { View } from './View';
import {
    XR,
    XRVRDisplay,
    XRSessionMode,
    XRSession,
} from '../webxr-types';

interface WebVRManagerExt extends THREE.WebVRManager {
    setFrameOfReferenceType(value: string): void;
    setSession(value: XRSession): void;
}

interface WebVRButtonOptions {
    frameOfReferenceType: string;
}

export class WebVRButton implements View {
    element: HTMLButtonElement;

    private renderer: THREE.WebGLRenderer;
    private vrManager: WebVRManagerExt;

    private currentSession: XRSession;

    constructor(renderer: THREE.WebGLRenderer, options?: WebVRButtonOptions) {
        this.renderer = renderer;
        this.vrManager = renderer.vr as WebVRManagerExt;
        this.element = document.createElement('button');

        if (options && options.frameOfReferenceType) {
            this.vrManager.setFrameOfReferenceType(options.frameOfReferenceType);
        }

        if ('xr' in navigator) {
            const xr = navigator['xr'] as XR;
            this.element.style.display = 'none';
            this.stylizeElement(this.element);
            xr.requestDevice().then((device) => {
                device.supportsSession(XRSessionMode.ImmersiveVR)
                    .then(() => {
                        this.showEnterXR(device);
                    })
                    .catch((err: any) => {
                        console.error(err);
                        this.showVRNotFound();
                    });
            }).catch((err: any) => {
                console.error(err);
                this.showVRNotFound();
            });
        } else if ('getVRDisplays' in navigator) {
            this.element.style.display = 'none';
            this.stylizeElement(this.element);
            window.addEventListener('vrdisplayconnect', (event: VRDisplayEvent) => {
                this.showEnterVR(event.display);
            }, false);
            window.addEventListener('vrdisplaydisconnect', (event: VRDisplayEvent) => {
                this.showVRNotFound();
            }, false);
            window.addEventListener('vrdisplaypresentchange', (event: VRDisplayEvent) => {
                this.element.textContent = event.display.isPresenting ? 'EXIT VR' : 'ENTER VR';
            }, false);
            window.addEventListener('vrdisplayactivate', (event: VRDisplayEvent) => {
                event.display.requestPresent([{ source: renderer.domElement }]);
            }, false);
            navigator.getVRDisplays()
                .then((displays) => {
                    if (displays.length > 0) {
                        this.showEnterVR(displays[0]);
                    } else {
                        this.showVRNotFound();
                    }
                }).catch((err: any) => {
                    console.error(err);
                    this.showVRNotFound();
                });
        } else {
            throw new Error('WebVR not supported');
        }
    }

    private showEnterVR(device: VRDisplay) {
        this.element.style.display = '';

        this.element.style.cursor = 'pointer';
        this.element.style.left = 'calc(50% - 50px)';
        this.element.style.width = '100px';

        this.element.textContent = 'ENTER VR';

        this.element.onmouseenter = () => { this.element.style.opacity = '1.0'; };
        this.element.onmouseleave = () => { this.element.style.opacity = '0.5'; };

        this.element.onclick = () => {
            device.isPresenting ? device.exitPresent() : device.requestPresent([{ source: this.renderer.domElement }]);
        };

        this.vrManager.setDevice(device);
    }

    private showEnterXR(device: XRVRDisplay) {
        this.element.style.display = '';

        this.element.style.cursor = 'pointer';
        this.element.style.left = 'calc(50% - 50px)';
        this.element.style.width = '100px';

        this.element.textContent = 'ENTER VR';

        this.element.onmouseenter = () => { this.element.style.opacity = '1.0'; };
        this.element.onmouseleave = () => { this.element.style.opacity = '0.5'; };

        this.element.onclick = () => {
            if (this.currentSession === null) {
                device.requestSession(XRSessionMode.ImmersiveVR).then(this.onSessionStarted.bind(this));
            } else {
                this.currentSession.end();
            }
        };
        this.vrManager.setDevice(device);
    }

    private showVRNotFound() {
        this.element.style.display = '';
        this.element.style.cursor = 'auto';
        this.element.style.left = 'calc(50% - 75px)';
        this.element.style.width = '150px';
        this.element.textContent = 'VR NOT FOUND';

        this.element.onmouseenter = null;
        this.element.onmouseleave = null;
        this.element.onclick = null;

        this.vrManager.setDevice(null);
    }

    private stylizeElement(element) {
        element.style.position = 'absolute';
        element.style.bottom = '20px';
        element.style.padding = '12px 6px';
        element.style.border = '1px solid #fff';
        element.style.borderRadius = '4px';
        element.style.background = 'rgba(0,0,0,0.1)';
        element.style.color = '#fff';
        element.style.font = 'normal 13px sans-serif';
        element.style.textAlign = 'center';
        element.style.opacity = '0.5';
        element.style.outline = 'none';
        element.style.zIndex = '999';
    }

    private onSessionStarted(session: XRSession) {
        session.addEventListener('end', this.onSessionEnded.bind(this));
        this.vrManager.setSession(session);
        this.element.textContent = 'EXIT VR';
        this.currentSession = session;
    }

    private onSessionEnded(event: Event) {
        this.currentSession.removeEventListener('end', this.onSessionEnded.bind(this));
        this.vrManager.setSession(null);
        this.element.textContent = 'ENTER VR';
        this.currentSession = null;
    }
}
