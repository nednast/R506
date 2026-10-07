import * as THREE from 'three';

const video = document.getElementById('camera');
const statusText = document.getElementById('status');
const startButton = document.getElementById('start-btn');

// Scène Three.js
const scene = new THREE.Scene(); // pas de background : on veut voir la vidéo derrière

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

// alpha: true -> le fond du canvas est transparent
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const light = new THREE.DirectionalLight(0xffffff, 1.5);
light.position.set(2, 3, 4);
scene.add(light);

// Cube de test, devant la caméra, pour vérifier que la 3D s'affiche bien sur la vidéo
const testCube = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x00aaff })
);
testCube.position.z = -4;
scene.add(testCube);

// Flux de la caméra
// facingMode "environment" = caméra arrière du téléphone (sur PC : la webcam)
// getUserMedia ne marche qu'en HTTPS ou sur localhost
async function startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
    });
    video.srcObject = stream;
}

// Le navigateur exige une action de l'utilisateur pour demander les autorisations
startButton.addEventListener('click', async () => {
    try {
        await startCamera();
        startButton.disabled = true;
        statusText.textContent = 'Caméra active';
    } catch (error) {
        statusText.textContent = `Caméra impossible : ${error.message}`;
    }
});

// Boucle d'animation
function animate() {
    testCube.rotation.x += 0.01;
    testCube.rotation.y += 0.01;
    renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
