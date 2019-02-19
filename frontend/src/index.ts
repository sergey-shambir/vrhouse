import * as WebVRPolyfill from 'webvr-polyfill';
import * as THREE from 'three';

if (!navigator.getVRDisplays) {
    console.warn("no native WebVR support: starting polyfill");
    new WebVRPolyfill();
}

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const orbitControls = new THREE.OrbitControls(camera);

// Store the position of the VR HMD in a dummy camera.
const fakeCamera = new THREE.Camera();
const vrControls = new THREE.VRControls(fakeCamera);
const vrEffect = new THREE.VREffect(renderer, () => { });

function createScene(orbitControls: THREE.OrbitControls) {
    const scene = new THREE.Scene();
    scene.add(new THREE.PointLight());

    let cube = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshLambertMaterial({
            color: 'green'
        })
    );
    cube.position.set(-1, -2, -5);
    scene.add(cube);
    orbitControls.target = cube.position;

    for (var i = 0; i < 10; i++) {
        cube = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshLambertMaterial()
        );
        cube.position.set(
            (Math.random() - 0.5) * 20,
            (Math.random() - 0.5) * 20,
            (Math.random() - 0.5) * 20
        );
        scene.add(cube);
    }

    return scene;
}

const scene = createScene(orbitControls);

function render() {
    requestAnimationFrame(render);

    orbitControls.update();
    vrControls.update();

    // Temporarily save the orbited camera position
    var orbitPos = camera.position.clone();

    // Apply the VR HMD camera position and rotation
    // on top of the orbited camera.
    var rotatedPosition = fakeCamera.position.applyQuaternion(
        camera.quaternion);
    camera.position.add(rotatedPosition);
    camera.quaternion.multiply(fakeCamera.quaternion);

    vrEffect.render(scene, camera);

    // Restore the orbit position, so that the OrbitControls can
    // pickup where it left off.
    camera.position.copy(orbitPos);
}

window.addEventListener('resize', function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    vrEffect.setSize(window.innerWidth, window.innerHeight);
}, false);

document.body.appendChild(renderer.domElement);
render();
