import * as THREE from 'three';
import { WEBVR, BoxLineGeometry } from './three-ext';
import { mockWebVR } from './mocks';

if (!navigator.getVRDisplays) {
    console.warn("no native WebVR support: starting polyfill");
    mockWebVR().then(run);
} else {
    run();
}

function run() {
    const view = new RoomSceneView();
}

class RoomSceneView {
    clock = new THREE.Clock();

    container: HTMLElement;
    camera: THREE.PerspectiveCamera;
    scene: THREE.Scene;
    raycaster: THREE.Raycaster;
    renderer: THREE.WebGLRenderer;

    room: THREE.LineSegments;
    isMouseDown = false;

    intersectedObject: THREE.Object3D;
    crosshair: THREE.Mesh;

    constructor() {
        this.container = document.createElement('div');
        document.body.appendChild(this.container);

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x505050);

        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 10);
        this.scene.add(this.camera);

        this.crosshair = new THREE.Mesh(
            new THREE.RingBufferGeometry(0.02, 0.04, 32),
            new THREE.MeshBasicMaterial({
                color: 0xffffff,
                opacity: 0.5,
                transparent: true
            })
        );
        this.crosshair.position.z = - 2;
        this.camera.add(this.crosshair);

        this.room = new THREE.LineSegments(
            new BoxLineGeometry(6, 6, 6, 10, 10, 10),
            new THREE.LineBasicMaterial({ color: 0x808080 })
        );
        this.room.position.y = 3;
        this.scene.add(this.room);

        this.scene.add(new THREE.HemisphereLight(0x606060, 0x404040));

        const light = new THREE.DirectionalLight(0xffffff);
        light.position.set(1, 1, 1).normalize();
        this.scene.add(light);

        const geometry = new THREE.BoxBufferGeometry(0.15, 0.15, 0.15);

        for (let i = 0; i < 200; i++) {
            const object = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color: Math.random() * 0xffffff }));

            object.position.x = Math.random() * 4 - 2;
            object.position.y = Math.random() * 4 - 2;
            object.position.z = Math.random() * 4 - 2;

            object.rotation.x = Math.random() * 2 * Math.PI;
            object.rotation.y = Math.random() * 2 * Math.PI;
            object.rotation.z = Math.random() * 2 * Math.PI;

            object.scale.x = Math.random() + 0.5;
            object.scale.y = Math.random() + 0.5;
            object.scale.z = Math.random() + 0.5;

            object.userData.velocity = new THREE.Vector3();
            object.userData.velocity.x = Math.random() * 0.01 - 0.005;
            object.userData.velocity.y = Math.random() * 0.01 - 0.005;
            object.userData.velocity.z = Math.random() * 0.01 - 0.005;

            this.room.add(object);
        }

        this.raycaster = new THREE.Raycaster();

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.vr.enabled = true;
        this.container.appendChild(this.renderer.domElement);

        this.renderer.domElement.addEventListener('mousedown', this.onMouseDown.bind(this), false);
        this.renderer.domElement.addEventListener('mouseup', this.onMouseUp.bind(this), false);
        this.renderer.domElement.addEventListener('touchstart', this.onMouseDown.bind(this), false);
        this.renderer.domElement.addEventListener('touchend', this.onMouseUp.bind(this), false);

        window.addEventListener('resize', this.onWindowResize.bind(this), false);
        window.addEventListener('vrdisplaypointerrestricted', this.onPointerRestricted.bind(this), false);
        window.addEventListener('vrdisplaypointerunrestricted', this.onPointerUnrestricted.bind(this), false);

        document.body.appendChild(WEBVR.createButton(this.renderer));

        this.animate();
    }

    private animate() {
        this.renderer.setAnimationLoop(this.render.bind(this));
    }

    private onMouseDown() {
        this.isMouseDown = true;
    }

    private onMouseUp() {
        this.isMouseDown = false;
    }

    private onPointerRestricted() {
        const pointerLockElement = this.renderer.domElement;
        if (pointerLockElement && typeof (pointerLockElement.requestPointerLock) === 'function') {
            pointerLockElement.requestPointerLock();
        }
    }

    private onPointerUnrestricted() {
        const currentPointerLockElement = document.pointerLockElement;
        const expectedPointerLockElement = this.renderer.domElement;
        if (currentPointerLockElement && currentPointerLockElement === expectedPointerLockElement && typeof (document.exitPointerLock) === 'function') {
            document.exitPointerLock();
        }
    }

    private onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    private render() {
        const delta = this.clock.getDelta() * 60;
        if (this.isMouseDown === true) {
            const cube = this.room.children[0];
            this.room.remove(cube);
            cube.position.set(0, 0, - 0.75);
            cube.position.applyQuaternion(this.camera.quaternion);
            cube.userData.velocity.x = (Math.random() - 0.5) * 0.02 * delta;
            cube.userData.velocity.y = (Math.random() - 0.5) * 0.02 * delta;
            cube.userData.velocity.z = (Math.random() * 0.01 - 0.05) * delta;
            cube.userData.velocity.applyQuaternion(this.camera.quaternion);
            this.room.add(cube);
        }

        // find intersections
        this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
        const intersects = this.raycaster.intersectObjects(this.room.children);
        if (intersects.length > 0) {
            if (this.intersectedObject != intersects[0].object) {
                this.intersectedObject = intersects[0].object;
            }
        } else {
            this.intersectedObject = undefined;
        }

        // Keep cubes inside room
        for (let i = 0; i < this.room.children.length; i++) {
            const cube = this.room.children[i];
            cube.userData.velocity.multiplyScalar(1 - (0.001 * delta));
            cube.position.add(cube.userData.velocity);
            if (cube.position.x < - 3 || cube.position.x > 3) {
                cube.position.x = THREE.Math.clamp(cube.position.x, - 3, 3);
                cube.userData.velocity.x = - cube.userData.velocity.x;
            }
            if (cube.position.y < - 3 || cube.position.y > 3) {
                cube.position.y = THREE.Math.clamp(cube.position.y, - 3, 3);
                cube.userData.velocity.y = - cube.userData.velocity.y;
            }
            if (cube.position.z < - 3 || cube.position.z > 3) {
                cube.position.z = THREE.Math.clamp(cube.position.z, - 3, 3);
                cube.userData.velocity.z = - cube.userData.velocity.z;
            }
            cube.rotation.x += cube.userData.velocity.x * 2 * delta;
            cube.rotation.y += cube.userData.velocity.y * 2 * delta;
            cube.rotation.z += cube.userData.velocity.z * 2 * delta;
        }
        this.renderer.render(this.scene, this.camera);
    }
}
