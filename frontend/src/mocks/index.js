export function mockWebVR() {
    return import('webvr-polyfill').then((module) => {
        const WebVRPolyfill = module.default;
        const webVRPolyfill = new WebVRPolyfill();
        webVRPolyfill.enable();
    });
}
