/**
 * @author qiao / https://github.com/qiao
 * @author mrdoob / http://mrdoob.com
 * @author alteredq / http://alteredqualia.com/
 * @author WestLangley / http://github.com/WestLangley
 * @author erich666 / http://erichaines.com
 */

import {
    EventDispatcher,
    MOUSE,
    Quaternion,
    Spherical,
    Vector2,
    Vector3,
    Object3D,
    PerspectiveCamera,
    OrthographicCamera,
} from "three";

enum STATE {
    NONE = -1,
    ROTATE = 0,
    DOLLY = 1,
    PAN = 2,
    TOUCH_ROTATE = 3,
    TOUCH_DOLLY_PAN = 4,
};

const EPS = 0.000001;

// This set of controls performs orbiting, dollying (zooming), and panning.
// Unlike TrackballControls, it maintains the "up" direction cameraObject.up (+Y by default).
//
//    Orbit - left mouse / touch: one-finger move
//    Zoom - middle mouse, or mousewheel / touch: two-finger spread or squish
//    Pan - right mouse, or left mouse + ctrl/meta/shiftKey, or arrow keys / touch: two-finger move
class OrbitControls extends EventDispatcher {
    cameraObject: PerspectiveCamera | OrthographicCamera;
    domElement: HTMLElement;
    // Set to false to disable this control
    enabled = true;
    // "target" sets the location of focus, where the cameraObject orbits around
    target = new Vector3();
    // How far you can dolly in and out ( PerspectiveCamera only )
    minDistance = 0;
    maxDistance = Infinity;
    // How far you can zoom in and out ( OrthographicCamera only )
    minZoom = 0;
    maxZoom = Infinity;
    // How far you can orbit vertically, upper and lower limits.
    // Range is 0 to Math.PI radians.
    minPolarAngle = 0; // radians
    maxPolarAngle = Math.PI; // radians
    // How far you can orbit horizontally, upper and lower limits.
    // If set, must be a sub-interval of the interval [ - Math.PI, Math.PI ].
    minAzimuthAngle = -Infinity; // radians
    maxAzimuthAngle = Infinity; // radians
    // Set to true to enable damping (inertia)
    // If damping is enabled, you must call controls.update() in your animation loop
    enableDamping = false;
    dampingFactor = 0.25;
    // This option actually enables dollying in and out; left as "zoom" for backwards compatibility.
    // Set to false to disable zooming
    enableZoom = true;
    zoomSpeed = 1.0;
    // Set to false to disable rotating
    enableRotate = true;
    rotateSpeed = 1.0;
    // Set to false to disable panning
    enablePan = true;
    panSpeed = 1.0;
    screenSpacePanning = false; // if true, pan in screen-space
    keyPanSpeed = 7.0; // pixels moved per arrow key push
    // Set to true to automatically rotate around the target
    // If auto-rotate is enabled, you must call controls.update() in your animation loop
    autoRotate = false;
    autoRotateSpeed = 2.0; // 30 seconds per round when fps is 60
    // Set to false to disable use of the keys
    enableKeys = true;
    // The four arrow keys
    keys = { LEFT: 37, UP: 38, RIGHT: 39, BOTTOM: 40 };
    // Mouse buttons
    mouseButtons = { LEFT: MOUSE.LEFT, MIDDLE: MOUSE.MIDDLE, RIGHT: MOUSE.RIGHT };

    // so camera.up is the orbit axis
    private cameraQuaternion: Quaternion;
    private cameraQuaternionInverse: Quaternion;
    private lastCameraPosition = new Vector3();
    private lastCameraQuaternion = new Quaternion();

    private target0: Vector3;
    private position0: Vector3;
    private zoom0: number;

    private changeEvent = { type: 'change' };
    private startEvent = { type: 'start' };
    private endEvent = { type: 'end' };
    private state = STATE.NONE;
    // current position in spherical coordinates
    private spherical = new Spherical();
    private sphericalDelta = new Spherical();
    private scale = 1;
    private panOffset = new Vector3();
    private zoomChanged = false;
    private rotateStart = new Vector2();
    private rotateEnd = new Vector2();
    private rotateDelta = new Vector2();
    private panStart = new Vector2();
    private panEnd = new Vector2();
    private panDelta = new Vector2();
    private dollyStart = new Vector2();
    private dollyEnd = new Vector2();
    private dollyDelta = new Vector2();

    constructor(camera: PerspectiveCamera | OrthographicCamera, domElement?: HTMLElement) {
        super();

        // so camera.up is the orbit axis
        this.cameraQuaternion = new Quaternion().setFromUnitVectors(camera.up, new Vector3(0, 1, 0));
        this.cameraQuaternionInverse = this.cameraQuaternion.clone().inverse();
        this.lastCameraPosition = new Vector3();
        this.lastCameraQuaternion = new Quaternion();

        this.cameraObject = camera;
        this.domElement = (domElement !== undefined) ? domElement : document.body;
        // for reset
        this.target0 = this.target.clone();
        this.position0 = this.cameraObject.position.clone();
        this.zoom0 = this.cameraObject.zoom;
        //
        this.domElement.addEventListener('contextmenu', this.onContextMenu.bind(this), false);
        this.domElement.addEventListener('mousedown', this.onMouseDown.bind(this), false);
        this.domElement.addEventListener('wheel', this.onMouseWheel.bind(this).bind(this), false);
        this.domElement.addEventListener('touchstart', this.onTouchStart.bind(this), false);
        this.domElement.addEventListener('touchend', this.onTouchEnd.bind(this), false);
        this.domElement.addEventListener('touchmove', this.onTouchMove.bind(this), false);
        window.addEventListener('keydown', this.onKeyDown.bind(this), false);

        // force an update at start
        this.update();
    }

    get center() {
        console.warn('THREE.OrbitControls: .center has been renamed to .target');
        return this.target;
    }

    get noZoom() {
        console.warn('THREE.OrbitControls: .noZoom has been deprecated. Use .enableZoom instead.');
        return !this.enableZoom;
    }

    set noZoom(value) {
        console.warn('THREE.OrbitControls: .noZoom has been deprecated. Use .enableZoom instead.');
        this.enableZoom = !value;
    }

    get noRotate() {
        console.warn('THREE.OrbitControls: .noRotate has been deprecated. Use .enableRotate instead.');
        return !this.enableRotate;
    }

    set noRotate(value) {
        console.warn('THREE.OrbitControls: .noRotate has been deprecated. Use .enableRotate instead.');
        this.enableRotate = !value;
    }

    get noPan() {
        console.warn('THREE.OrbitControls: .noPan has been deprecated. Use .enablePan instead.');
        return !this.enablePan;
    }

    set noPan(value) {
        console.warn('THREE.OrbitControls: .noPan has been deprecated. Use .enablePan instead.');
        this.enablePan = !value;
    }

    get noKeys() {
        console.warn('THREE.OrbitControls: .noKeys has been deprecated. Use .enableKeys instead.');
        return !this.enableKeys;
    }

    set noKeys(value) {
        console.warn('THREE.OrbitControls: .noKeys has been deprecated. Use .enableKeys instead.');
        this.enableKeys = !value;
    }

    get staticMoving() {
        console.warn('THREE.OrbitControls: .staticMoving has been deprecated. Use .enableDamping instead.');
        return !this.enableDamping;
    }

    set staticMoving(value) {
        console.warn('THREE.OrbitControls: .staticMoving has been deprecated. Use .enableDamping instead.');
        this.enableDamping = !value;
    }

    get dynamicDampingFactor() {
        console.warn('THREE.OrbitControls: .dynamicDampingFactor has been renamed. Use .dampingFactor instead.');
        return this.dampingFactor;
    }

    set dynamicDampingFactor(value) {
        console.warn('THREE.OrbitControls: .dynamicDampingFactor has been renamed. Use .dampingFactor instead.');
        this.dampingFactor = value;
    }

    getPolarAngle() {
        return this.spherical.phi;
    };

    getAzimuthalAngle() {
        return this.spherical.theta;
    };

    saveState() {
        this.target0.copy(this.target);
        this.position0.copy(this.cameraObject.position);
        this.zoom0 = this.cameraObject.zoom;
    };

    reset() {
        this.target.copy(this.target0);
        this.cameraObject.position.copy(this.position0);
        this.cameraObject.zoom = this.zoom0;
        this.cameraObject.updateProjectionMatrix();
        this.dispatchEvent(this.changeEvent);
        this.update();
        this.state = STATE.NONE;
    };

    // this method is exposed, but perhaps it would be better if we can make it private...
    update() {
        const offset = new Vector3();
        const position = this.cameraObject.position;
        offset.copy(position).sub(this.target);
        // rotate offset to "y-axis-is-up" space
        offset.applyQuaternion(this.cameraQuaternion);
        // angle from z-axis around y-axis
        this.spherical.setFromVector3(offset);
        if (this.autoRotate && this.state === STATE.NONE) {
            this.rotateLeft(this.getAutoRotationAngle());
        }
        this.spherical.theta += this.sphericalDelta.theta;
        this.spherical.phi += this.sphericalDelta.phi;
        // restrict theta to be between desired limits
        this.spherical.theta = Math.max(this.minAzimuthAngle, Math.min(this.maxAzimuthAngle, this.spherical.theta));
        // restrict phi to be between desired limits
        this.spherical.phi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, this.spherical.phi));
        this.spherical.makeSafe();
        this.spherical.radius *= this.scale;
        // restrict radius to be between desired limits
        this.spherical.radius = Math.max(this.minDistance, Math.min(this.maxDistance, this.spherical.radius));
        // move target to panned location
        this.target.add(this.panOffset);
        offset.setFromSpherical(this.spherical);
        // rotate offset back to "camera-up-vector-is-up" space
        offset.applyQuaternion(this.cameraQuaternionInverse);
        position.copy(this.target).add(offset);
        this.cameraObject.lookAt(this.target);
        if (this.enableDamping === true) {
            this.sphericalDelta.theta *= (1 - this.dampingFactor);
            this.sphericalDelta.phi *= (1 - this.dampingFactor);
            this.panOffset.multiplyScalar(1 - this.dampingFactor);
        }
        else {
            this.sphericalDelta.set(0, 0, 0);
            this.panOffset.set(0, 0, 0);
        }
        this.scale = 1;
        // update condition is:
        // min(camera displacement, camera rotation in radians)^2 > EPS
        // using small-angle approximation cos(x/2) = 1 - x^2 / 8
        if (this.zoomChanged ||
            this.lastCameraPosition.distanceToSquared(this.cameraObject.position) > EPS ||
            8 * (1 - this.lastCameraQuaternion.dot(this.cameraObject.quaternion)) > EPS) {
            this.dispatchEvent(this.changeEvent);
            this.lastCameraPosition.copy(this.cameraObject.position);
            this.lastCameraQuaternion.copy(this.cameraObject.quaternion);
            this.zoomChanged = false;
            return true;
        }
        return false;
    };

    dispose() {
        this.domElement.removeEventListener('contextmenu', this.onContextMenu, false);
        this.domElement.removeEventListener('mousedown', this.onMouseDown, false);
        this.domElement.removeEventListener('wheel', this.onMouseWheel, false);
        this.domElement.removeEventListener('touchstart', this.onTouchStart, false);
        this.domElement.removeEventListener('touchend', this.onTouchEnd, false);
        this.domElement.removeEventListener('touchmove', this.onTouchMove, false);
        document.removeEventListener('mousemove', this.onMouseMove, false);
        document.removeEventListener('mouseup', this.onMouseUp, false);
        window.removeEventListener('keydown', this.onKeyDown, false);
        //this.dispatchEvent( { type: 'dispose' } ); // should this be added here?
    };

    private getAutoRotationAngle() {
        return 2 * Math.PI / 60 / 60 * this.autoRotateSpeed;
    }
    private getZoomScale() {
        return Math.pow(0.95, this.zoomSpeed);
    }
    private rotateLeft(angle) {
        this.sphericalDelta.theta -= angle;
    }
    private rotateUp(angle) {
        this.sphericalDelta.phi -= angle;
    }

    private dollyIn(dollyScale) {
        const perspectiveCamera = this.perspectiveCamera();
        const orthographicCamera = this.orthographicCamera();
        if (perspectiveCamera !== undefined) {
            this.scale /= dollyScale;
        }
        else if (orthographicCamera !== undefined) {
            this.cameraObject.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.cameraObject.zoom * dollyScale));
            this.cameraObject.updateProjectionMatrix();
            this.zoomChanged = true;
        }
        else {
            console.warn('WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.');
            this.enableZoom = false;
        }
    }
    private dollyOut(dollyScale) {
        const perspectiveCamera = this.perspectiveCamera();
        const orthographicCamera = this.orthographicCamera();
        if (perspectiveCamera !== undefined) {
            this.scale *= dollyScale;
        }
        else if (orthographicCamera !== undefined) {
            this.cameraObject.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.cameraObject.zoom / dollyScale));
            this.cameraObject.updateProjectionMatrix();
            this.zoomChanged = true;
        }
        else {
            console.warn('WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.');
            this.enableZoom = false;
        }
    }
    //
    // event callbacks - update the cameraObject state
    //
    private handleMouseDownRotate(event) {
        //console.log( 'handleMouseDownRotate' );
        this.rotateStart.set(event.clientX, event.clientY);
    }
    private handleMouseDownDolly(event) {
        //console.log( 'handleMouseDownDolly' );
        this.dollyStart.set(event.clientX, event.clientY);
    }
    private handleMouseDownPan(event) {
        //console.log( 'handleMouseDownPan' );
        this.panStart.set(event.clientX, event.clientY);
    }
    private handleMouseMoveRotate(event) {
        //console.log( 'handleMouseMoveRotate' );
        this.rotateEnd.set(event.clientX, event.clientY);
        this.rotateDelta.subVectors(this.rotateEnd, this.rotateStart).multiplyScalar(this.rotateSpeed);
        this.rotateLeft(2 * Math.PI * this.rotateDelta.x / this.domElement.clientHeight); // yes, height
        this.rotateUp(2 * Math.PI * this.rotateDelta.y / this.domElement.clientHeight);
        this.rotateStart.copy(this.rotateEnd);
        this.update();
    }
    private handleMouseMoveDolly(event) {
        //console.log( 'handleMouseMoveDolly' );
        this.dollyEnd.set(event.clientX, event.clientY);
        this.dollyDelta.subVectors(this.dollyEnd, this.dollyStart);
        if (this.dollyDelta.y > 0) {
            this.dollyIn(this.getZoomScale());
        }
        else if (this.dollyDelta.y < 0) {
            this.dollyOut(this.getZoomScale());
        }
        this.dollyStart.copy(this.dollyEnd);
        this.update();
    }
    private handleMouseMovePan(event) {
        //console.log( 'handleMouseMovePan' );
        this.panEnd.set(event.clientX, event.clientY);
        this.panDelta.subVectors(this.panEnd, this.panStart).multiplyScalar(this.panSpeed);
        this.pan(this.panDelta.x, this.panDelta.y);
        this.panStart.copy(this.panEnd);
        this.update();
    }
    private handleMouseUp(event) {
        // console.log( 'handleMouseUp' );
    }
    private handleMouseWheel(event) {
        // console.log( 'handleMouseWheel' );
        if (event.deltaY < 0) {
            this.dollyOut(this.getZoomScale());
        }
        else if (event.deltaY > 0) {
            this.dollyIn(this.getZoomScale());
        }
        this.update();
    }
    private handleKeyDown(event) {
        // console.log( 'handleKeyDown' );
        var needsUpdate = false;
        switch (event.keyCode) {
            case this.keys.UP:
                this.pan(0, this.keyPanSpeed);
                needsUpdate = true;
                break;
            case this.keys.BOTTOM:
                this.pan(0, -this.keyPanSpeed);
                needsUpdate = true;
                break;
            case this.keys.LEFT:
                this.pan(this.keyPanSpeed, 0);
                needsUpdate = true;
                break;
            case this.keys.RIGHT:
                this.pan(-this.keyPanSpeed, 0);
                needsUpdate = true;
                break;
        }
        if (needsUpdate) {
            // prevent the browser from scrolling on cursor keys
            event.preventDefault();
            this.update();
        }
    }
    private handleTouchStartRotate(event) {
        //console.log( 'handleTouchStartRotate' );
        this.rotateStart.set(event.touches[0].pageX, event.touches[0].pageY);
    }
    private handleTouchStartDollyPan(event) {
        //console.log( 'handleTouchStartDollyPan' );
        if (this.enableZoom) {
            var dx = event.touches[0].pageX - event.touches[1].pageX;
            var dy = event.touches[0].pageY - event.touches[1].pageY;
            var distance = Math.sqrt(dx * dx + dy * dy);
            this.dollyStart.set(0, distance);
        }
        if (this.enablePan) {
            var x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
            var y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);
            this.panStart.set(x, y);
        }
    }
    private handleTouchMoveRotate(event) {
        //console.log( 'handleTouchMoveRotate' );
        this.rotateEnd.set(event.touches[0].pageX, event.touches[0].pageY);
        this.rotateDelta.subVectors(this.rotateEnd, this.rotateStart).multiplyScalar(this.rotateSpeed);
        this.rotateLeft(2 * Math.PI * this.rotateDelta.x / this.domElement.clientHeight); // yes, height
        this.rotateUp(2 * Math.PI * this.rotateDelta.y / this.domElement.clientHeight);
        this.rotateStart.copy(this.rotateEnd);
        this.update();
    }
    private handleTouchMoveDollyPan(event) {
        //console.log( 'handleTouchMoveDollyPan' );
        if (this.enableZoom) {
            var dx = event.touches[0].pageX - event.touches[1].pageX;
            var dy = event.touches[0].pageY - event.touches[1].pageY;
            var distance = Math.sqrt(dx * dx + dy * dy);
            this.dollyEnd.set(0, distance);
            this.dollyDelta.set(0, Math.pow(this.dollyEnd.y / this.dollyStart.y, this.zoomSpeed));
            this.dollyIn(this.dollyDelta.y);
            this.dollyStart.copy(this.dollyEnd);
        }
        if (this.enablePan) {
            var x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
            var y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);
            this.panEnd.set(x, y);
            this.panDelta.subVectors(this.panEnd, this.panStart).multiplyScalar(this.panSpeed);
            this.pan(this.panDelta.x, this.panDelta.y);
            this.panStart.copy(this.panEnd);
        }
        this.update();
    }
    private handleTouchEnd(event) {
        //console.log( 'handleTouchEnd' );
    }
    //
    // event handlers - FSM: listen for events and reset state
    //
    private onMouseDown(event) {
        if (this.enabled === false)
            return;
        // Prevent the browser from scrolling.
        event.preventDefault();
        // Manually set the focus since calling preventDefault above
        // prevents the browser from setting it automatically.
        this.domElement.focus ? this.domElement.focus() : window.focus();
        switch (event.button) {
            case this.mouseButtons.LEFT:
                if (event.ctrlKey || event.metaKey || event.shiftKey) {
                    if (this.enablePan === false)
                        return;
                    this.handleMouseDownPan(event);
                    this.state = STATE.PAN;
                }
                else {
                    if (this.enableRotate === false)
                        return;
                    this.handleMouseDownRotate(event);
                    this.state = STATE.ROTATE;
                }
                break;
            case this.mouseButtons.MIDDLE:
                if (this.enableZoom === false)
                    return;
                this.handleMouseDownDolly(event);
                this.state = STATE.DOLLY;
                break;
            case this.mouseButtons.RIGHT:
                if (this.enablePan === false)
                    return;
                this.handleMouseDownPan(event);
                this.state = STATE.PAN;
                break;
        }
        if (this.state !== STATE.NONE) {
            document.addEventListener('mousemove', this.onMouseMove.bind(this), false);
            document.addEventListener('mouseup', this.onMouseUp.bind(this), false);
            this.dispatchEvent(this.startEvent);
        }
    }
    private onMouseMove(event) {
        if (this.enabled === false)
            return;
        event.preventDefault();
        switch (this.state) {
            case STATE.ROTATE:
                if (this.enableRotate === false)
                    return;
                this.handleMouseMoveRotate(event);
                break;
            case STATE.DOLLY:
                if (this.enableZoom === false)
                    return;
                this.handleMouseMoveDolly(event);
                break;
            case STATE.PAN:
                if (this.enablePan === false)
                    return;
                this.handleMouseMovePan(event);
                break;
        }
    }
    private onMouseUp(event) {
        if (this.enabled === false)
            return;
        this.handleMouseUp(event);
        document.removeEventListener('mousemove', this.onMouseMove.bind(this), false);
        document.removeEventListener('mouseup', this.onMouseUp.bind(this), false);
        this.dispatchEvent(this.endEvent);
        this.state = STATE.NONE;
    }
    private onMouseWheel(event) {
        if (this.enabled === false || this.enableZoom === false || (this.state !== STATE.NONE && this.state !== STATE.ROTATE))
            return;
        event.preventDefault();
        event.stopPropagation();
        this.dispatchEvent(this.startEvent);
        this.handleMouseWheel(event);
        this.dispatchEvent(this.endEvent);
    }
    private onKeyDown(event) {
        if (this.enabled === false || this.enableKeys === false || this.enablePan === false)
            return;
        this.handleKeyDown(event);
    }
    private onTouchStart(event) {
        if (this.enabled === false)
            return;
        event.preventDefault();
        switch (event.touches.length) {
            case 1: // one-fingered touch: rotate
                if (this.enableRotate === false)
                    return;
                this.handleTouchStartRotate(event);
                this.state = STATE.TOUCH_ROTATE;
                break;
            case 2: // two-fingered touch: dolly-pan
                if (this.enableZoom === false && this.enablePan === false)
                    return;
                this.handleTouchStartDollyPan(event);
                this.state = STATE.TOUCH_DOLLY_PAN;
                break;
            default:
                this.state = STATE.NONE;
        }
        if (this.state !== STATE.NONE) {
            this.dispatchEvent(this.startEvent);
        }
    }

    private onTouchMove(event) {
        if (this.enabled === false)
            return;
        event.preventDefault();
        event.stopPropagation();
        switch (event.touches.length) {
            case 1: // one-fingered touch: rotate
                if (this.enableRotate === false)
                    return;
                if (this.state !== STATE.TOUCH_ROTATE)
                    return; // is this needed?
                this.handleTouchMoveRotate(event);
                break;
            case 2: // two-fingered touch: dolly-pan
                if (this.enableZoom === false && this.enablePan === false)
                    return;
                if (this.state !== STATE.TOUCH_DOLLY_PAN)
                    return; // is this needed?
                this.handleTouchMoveDollyPan(event);
                break;
            default:
                this.state = STATE.NONE;
        }
    }

    private onTouchEnd(event) {
        if (this.enabled === false)
            return;
        this.handleTouchEnd(event);
        this.dispatchEvent(this.endEvent);
        this.state = STATE.NONE;
    }

    private onContextMenu(event) {
        if (this.enabled === false)
            return;
        event.preventDefault();
    }

    private panLeft(distance, objectMatrix) {
        var v = new Vector3();
        v.setFromMatrixColumn(objectMatrix, 0); // get X column of objectMatrix
        v.multiplyScalar(-distance);
        this.panOffset.add(v);
    }

    private panUp(distance, objectMatrix) {
        var v = new Vector3();
        if (this.screenSpacePanning === true) {
            v.setFromMatrixColumn(objectMatrix, 1);
        }
        else {
            v.setFromMatrixColumn(objectMatrix, 0);
            v.crossVectors(this.cameraObject.up, v);
        }
        v.multiplyScalar(distance);
        this.panOffset.add(v);
    }

    // deltaX and deltaY are in pixels; right and down are positive
    private pan(deltaX: number, deltaY: number) {
        const offset = new Vector3();
        const perspectiveCamera = this.perspectiveCamera();
        const orthographicCamera = this.orthographicCamera();
        if (perspectiveCamera !== undefined) {
            // perspective
            var position = perspectiveCamera.position;
            offset.copy(position).sub(this.target);
            var targetDistance = offset.length();
            // half of the fov is center to top of screen
            targetDistance *= Math.tan((perspectiveCamera.fov / 2) * Math.PI / 180.0);
            // we use only clientHeight here so aspect ratio does not distort speed
            this.panLeft(2 * deltaX * targetDistance / this.domElement.clientHeight, this.cameraObject.matrix);
            this.panUp(2 * deltaY * targetDistance / this.domElement.clientHeight, this.cameraObject.matrix);
        }
        else if (this.orthographicCamera !== undefined) {
            // orthographic
            this.panLeft(deltaX * (orthographicCamera.right - orthographicCamera.left) / orthographicCamera.zoom / this.domElement.clientWidth, orthographicCamera.matrix);
            this.panUp(deltaY * (orthographicCamera.top - orthographicCamera.bottom) / orthographicCamera.zoom / this.domElement.clientHeight, orthographicCamera.matrix);
        }
        else {
            // camera neither orthographic nor perspective
            console.warn('WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.');
            this.enablePan = false;
        }
    }

    private perspectiveCamera(): PerspectiveCamera | undefined {
        const camera = this.cameraObject as PerspectiveCamera;
        return camera.isPerspectiveCamera ? camera : undefined;
    }

    private orthographicCamera(): OrthographicCamera | undefined {
        const camera = this.cameraObject as OrthographicCamera;
        return camera.isOrthographicCamera ? camera : undefined;
    }
}

export { OrbitControls };
