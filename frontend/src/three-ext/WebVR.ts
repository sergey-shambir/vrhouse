/**
 * @author mrdoob / http://mrdoob.com
 * @author Mugen87 / https://github.com/Mugen87
 *
 * Based on @tojiro's vr-samples-utils.js
 */

import * as THREE from 'three';
import {
    XR,
    XRVRDisplay,
    XRSessionMode,
} from '../webxr-types';

interface WebVRManagerExt extends THREE.WebVRManager {
    setFrameOfReferenceType(value: string): void;
}

interface WebXRManagerExt extends WebVRManagerExt {
    setSession(value: string): void;
}

interface WEBVROptions {
    frameOfReferenceType: string;
}

export class WEBVR {
    static createButton(renderer: THREE.WebGLRenderer, options?: WEBVROptions): HTMLElement {
        const vr = renderer.vr as WebXRManagerExt;
        const button = document.createElement('button');

        if (options && options.frameOfReferenceType) {
            vr.setFrameOfReferenceType(options.frameOfReferenceType);
        }

        function showEnterVR(device: VRDisplay) {
            button.style.display = '';

            button.style.cursor = 'pointer';
            button.style.left = 'calc(50% - 50px)';
            button.style.width = '100px';

            button.textContent = 'ENTER VR';

            button.onmouseenter = function () { button.style.opacity = '1.0'; };
            button.onmouseleave = function () { button.style.opacity = '0.5'; };

            button.onclick = function () {
                device.isPresenting ? device.exitPresent() : device.requestPresent([{ source: renderer.domElement }]);
            };

            vr.setDevice(device);
        };

        function showEnterXR(device: XRVRDisplay) {
            let currentSession = null;

            function onSessionStarted(session) {
                session.addEventListener('end', onSessionEnded);
                vr.setSession(session);
                button.textContent = 'EXIT VR';
                currentSession = session;
            }

            function onSessionEnded(event) {
                currentSession.removeEventListener('end', onSessionEnded);
                vr.setSession(null);
                button.textContent = 'ENTER VR';
                currentSession = null;
            }

            button.style.display = '';

            button.style.cursor = 'pointer';
            button.style.left = 'calc(50% - 50px)';
            button.style.width = '100px';

            button.textContent = 'ENTER VR';

            button.onmouseenter = function () { button.style.opacity = '1.0'; };
            button.onmouseleave = function () { button.style.opacity = '0.5'; };

            button.onclick = function () {
                if (currentSession === null) {
                    device.requestSession(XRSessionMode.ImmersiveVR).then(onSessionStarted);
                } else {
                    currentSession.end();
                }
            };
            vr.setDevice(device);
        }

        function showVRNotFound() {
            button.style.display = '';
            button.style.cursor = 'auto';
            button.style.left = 'calc(50% - 75px)';
            button.style.width = '150px';
            button.textContent = 'VR NOT FOUND';

            button.onmouseenter = null;
            button.onmouseleave = null;
            button.onclick = null;

            vr.setDevice(null);
        }

        function stylizeElement(element) {
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
        if ('xr' in navigator) {
            const xr = navigator['xr'] as XR;
            button.style.display = 'none';
            stylizeElement(button);
            xr.requestDevice().then(function (device) {
                device.supportsSession(XRSessionMode.ImmersiveVR)
                    .then(function () { showEnterXR(device); })
                    .catch(showVRNotFound);
            }).catch(showVRNotFound);
            return button;
        } else if ('getVRDisplays' in navigator) {
            button.style.display = 'none';
            stylizeElement(button);
            window.addEventListener('vrdisplayconnect', function (event: VRDisplayEvent) {
                showEnterVR(event.display);
            }, false);
            window.addEventListener('vrdisplaydisconnect', function (event: VRDisplayEvent) {
                showVRNotFound();
            }, false);
            window.addEventListener('vrdisplaypresentchange', function (event: VRDisplayEvent) {
                button.textContent = event.display.isPresenting ? 'EXIT VR' : 'ENTER VR';
            }, false);
            window.addEventListener('vrdisplayactivate', function (event: VRDisplayEvent) {
                event.display.requestPresent([{ source: renderer.domElement }]);
            }, false);
            navigator.getVRDisplays()
                .then(function (displays) {
                    if (displays.length > 0) {
                        showEnterVR(displays[0]);
                    } else {
                        showVRNotFound();
                    }
                }).catch(showVRNotFound);
            return button;
        } else {
            const message = document.createElement('a');
            message.href = 'https://webvr.info';
            message.innerHTML = 'WEBVR NOT SUPPORTED';
            message.style.left = 'calc(50% - 90px)';
            message.style.width = '180px';
            message.style.textDecoration = 'none';
            stylizeElement(message);
            return message;
        }
    }
};
