import * as THREE from 'three';

// Scène
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101018);

// Caméra : champ de vision 75°, ratio de la fenêtre, plans de clipping near/far
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// Lumières : ambiante pour éclairer partout + directionnelle pour le relief
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(3, 4, 5);
scene.add(directionalLight);

// Objet générique : un cube
const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
const material = new THREE.MeshStandardMaterial({ color: 0xaa0000 });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

// Boucle d'animation
function animate() {
    cube.rotation.x += 0.01;
    cube.rotation.y += 0.01;
    renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);

// Adapter la scène quand la fenêtre change de taille
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
