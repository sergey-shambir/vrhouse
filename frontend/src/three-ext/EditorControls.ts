/**
 * @author qiao / https://github.com/qiao
 * @author mrdoob / http://mrdoob.com
 * @author alteredq / http://alteredqualia.com/
 * @author WestLangley / http://github.com/WestLangley
 */
import * as THREE from 'three';

enum State {
    NONE = -1,
    ROTATE = 0,
    ZOOM = 1,
    PAN = 2,
}

const changeEvent = { type: 'change' };

export class EditorControls extends THREE.EventDispatcher {
    public enabled = true;
    public center = new THREE.Vector3();
    public panSpeed = 0.002;
    public zoomSpeed = 0.1;
    public rotationSpeed = 0.005;

    private object: THREE.Object3D;
    private domElement: Node;
    private vector = new THREE.Vector3();
    private box = new THREE.Box3();
    private state = State.NONE;
    private normalMatrix = new THREE.Matrix3();
    private pointer = new THREE.Vector2();
    private pointerOld = new THREE.Vector2();
    private spherical = new THREE.Spherical();
    private sphere = new THREE.Sphere();
    private touches = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    private prevTouches = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    private prevDistance: number | undefined = undefined;

    constructor(object: THREE.Object3D, domElement: Node | undefined) {
        super();
        // API
        this.enabled = true;
        this.center = new THREE.Vector3();
        this.panSpeed = 0.002;
        this.zoomSpeed = 0.1;
        this.rotationSpeed = 0.005;
        // events
        this.object = object;
        this.domElement = (domElement !== undefined) ? domElement : document;
        // mouse
        domElement.addEventListener('contextmenu', this.contextmenu, false);
        domElement.addEventListener('mousedown', this.onMouseDown, false);
        domElement.addEventListener('wheel', this.onMouseWheel, false);
        // touch
        domElement.addEventListener('touchstart', this.touchStart, false);
        domElement.addEventListener('touchmove', this.touchMove, false);
    }

    focus(target: THREE.Object3D) {
        let distance = 0;
        this.box.setFromObject(target);
        if (this.box.isEmpty() === false) {
            this.box.getCenter(this.center);
            distance = this.box.getBoundingSphere(this.sphere).radius;
        }
        else {
            // Focusing on an Group, AmbientLight, etc
            this.center.setFromMatrixPosition(target.matrixWorld);
            distance = 0.1;
        }
        const delta = new THREE.Vector3(0, 0, 1);
        delta.applyQuaternion(this.object.quaternion);
        delta.multiplyScalar(distance * 4);
        this.object.position.copy(this.center).add(delta);
        this.dispatchEvent(changeEvent);
    }

    pan(delta: THREE.Vector3) {
        const distance = this.object.position.distanceTo(this.center);
        delta.multiplyScalar(distance * this.panSpeed);
        delta.applyMatrix3(this.normalMatrix.getNormalMatrix(this.object.matrix));
        this.object.position.add(delta);
        this.center.add(delta);
        this.dispatchEvent(changeEvent);
    }

    zoom(delta: THREE.Vector3) {
        const distance = this.object.position.distanceTo(this.center);
        delta.multiplyScalar(distance * this.zoomSpeed);
        if (delta.length() > distance)
            return;
        delta.applyMatrix3(this.normalMatrix.getNormalMatrix(this.object.matrix));
        this.object.position.add(delta);
        this.dispatchEvent(changeEvent);
    }

    rotate(delta: THREE.Vector2 | THREE.Vector3) {
        this.vector.copy(this.object.position).sub(this.center);
        this.spherical.setFromVector3(this.vector);
        this.spherical.theta += delta.x * this.rotationSpeed;
        this.spherical.phi += delta.y * this.rotationSpeed;
        this.spherical.makeSafe();
        this.vector.setFromSpherical(this.spherical);
        this.object.position.copy(this.center).add(this.vector);
        this.object.lookAt(this.center);
        this.dispatchEvent(changeEvent);
    };

    dispose() {
        this.domElement.removeEventListener('contextmenu', this.contextmenu, false);
        this.domElement.removeEventListener('mousedown', this.onMouseDown, false);
        this.domElement.removeEventListener('wheel', this.onMouseWheel, false);
        this.domElement.removeEventListener('mousemove', this.onMouseMove, false);
        this.domElement.removeEventListener('mouseup', this.onMouseUp, false);
        this.domElement.removeEventListener('mouseout', this.onMouseUp, false);
        this.domElement.removeEventListener('dblclick', this.onMouseUp, false);
        this.domElement.removeEventListener('touchstart', this.touchStart, false);
        this.domElement.removeEventListener('touchmove', this.touchMove, false);
    };

    private onMouseDown(event: MouseEvent) {
        if (this.enabled === false)
            return;
        if (event.button === 0) {
            this.state = State.ROTATE;
        }
        else if (event.button === 1) {
            this.state = State.ZOOM;
        }
        else if (event.button === 2) {
            this.state = State.PAN;
        }
        this.pointerOld.set(event.clientX, event.clientY);
        this.domElement.addEventListener('mousemove', this.onMouseMove, false);
        this.domElement.addEventListener('mouseup', this.onMouseUp, false);
        this.domElement.addEventListener('mouseout', this.onMouseUp, false);
        this.domElement.addEventListener('dblclick', this.onMouseUp, false);
    }

    private onMouseMove(event: MouseEvent) {
        if (this.enabled === false)
            return;
        this.pointer.set(event.clientX, event.clientY);
        const movementX = this.pointer.x - this.pointerOld.x;
        const movementY = this.pointer.y - this.pointerOld.y;
        if (this.state === State.ROTATE) {
            this.rotate(new THREE.Vector3(-movementX, -movementY, 0));
        }
        else if (this.state === State.ZOOM) {
            this.zoom(new THREE.Vector3(0, 0, movementY));
        }
        else if (this.state === State.PAN) {
            this.pan(new THREE.Vector3(-movementX, movementY, 0));
        }
        this.pointerOld.set(event.clientX, event.clientY);
    }

    private onMouseUp(event: MouseEvent) {
        this.domElement.removeEventListener('mousemove', this.onMouseMove, false);
        this.domElement.removeEventListener('mouseup', this.onMouseUp, false);
        this.domElement.removeEventListener('mouseout', this.onMouseUp, false);
        this.domElement.removeEventListener('dblclick', this.onMouseUp, false);
        this.state = State.NONE;
    }

    private onMouseWheel(event: WheelEvent) {
        event.preventDefault();
        // Normalize deltaY due to https://bugzilla.mozilla.org/show_bug.cgi?id=1392460
        this.zoom(new THREE.Vector3(0, 0, event.deltaY > 0 ? 1 : -1));
    }

    private contextmenu(event: MouseEvent) {
        event.preventDefault();
    }

    private touchStart(event: TouchEvent) {
        if (this.enabled === false)
            return;
        switch (event.touches.length) {
            case 1:
                this.touches[0].set(event.touches[0].pageX, event.touches[0].pageY, 0).divideScalar(window.devicePixelRatio);
                this.touches[1].set(event.touches[0].pageX, event.touches[0].pageY, 0).divideScalar(window.devicePixelRatio);
                break;
            case 2:
                this.touches[0].set(event.touches[0].pageX, event.touches[0].pageY, 0).divideScalar(window.devicePixelRatio);
                this.touches[1].set(event.touches[1].pageX, event.touches[1].pageY, 0).divideScalar(window.devicePixelRatio);
                this.prevDistance = this.touches[0].distanceTo(this.touches[1]);
                break;
        }
        this.prevTouches[0].copy(this.touches[0]);
        this.prevTouches[1].copy(this.touches[1]);
    }

    private touchMove(event: TouchEvent) {
        if (this.enabled === false)
            return;
        event.preventDefault();
        event.stopPropagation();
        function getClosest(touch, touches) {
            const closest = touches[0];
            for (const i in touches) {
                if (closest.distanceTo(touch) > touches[i].distanceTo(touch))
                    this.closest = touches[i];
            }
            return closest;
        }
        switch (event.touches.length) {
            case 1:
                this.touches[0].set(event.touches[0].pageX, event.touches[0].pageY, 0).divideScalar(window.devicePixelRatio);
                this.touches[1].set(event.touches[0].pageX, event.touches[0].pageY, 0).divideScalar(window.devicePixelRatio);
                this.rotate(this.touches[0].sub(getClosest(this.touches[0], this.prevTouches)).multiplyScalar(-1));
                break;
            case 2:
                this.touches[0].set(event.touches[0].pageX, event.touches[0].pageY, 0).divideScalar(window.devicePixelRatio);
                this.touches[1].set(event.touches[1].pageX, event.touches[1].pageY, 0).divideScalar(window.devicePixelRatio);
                const distance = this.touches[0].distanceTo(this.touches[1]);
                this.zoom(new THREE.Vector3(0, 0, this.prevDistance - distance));
                this.prevDistance = distance;
                const offset0 = this.touches[0].clone().sub(getClosest(this.touches[0], this.prevTouches));
                const offset1 = this.touches[1].clone().sub(getClosest(this.touches[1], this.prevTouches));
                offset0.x = -offset0.x;
                offset1.x = -offset1.x;
                this.pan(offset0.add(offset1));
                break;
        }
        this.prevTouches[0].copy(this.touches[0]);
        this.prevTouches[1].copy(this.touches[1]);
    }
}
