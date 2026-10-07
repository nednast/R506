import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Scène
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101018);

// Brouillard : même couleur que le fond pour que les objets s'y fondent
// (near = 6 pour que les objets restent nets, far = 18)
scene.fog = new THREE.Fog(0x101018, 6, 18);

// Caméra : champ de vision 75°, ratio de la fenêtre, plans de clipping near/far
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 7;

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// Contrôles de la caméra : clic gauche = tourner, molette = zoom, clic droit = déplacer
// (au doigt sur smartphone : 1 doigt = tourner, 2 doigts = zoom / déplacer)
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;  // mouvement amorti, plus fluide
controls.dampingFactor = 0.05;
controls.minDistance = 3;       // on ne rentre pas dans les objets
controls.maxDistance = 15;      // on ne se perd pas dans le brouillard

// Lumières : ambiante pour éclairer partout + directionnelle pour le relief
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(3, 4, 5);
scene.add(directionalLight);

// Texture : chargée depuis une image locale (nécessite un serveur local)
const textureLoader = new THREE.TextureLoader();
const crateTexture = textureLoader.load('textures/crate.gif');
crateTexture.colorSpace = THREE.SRGBColorSpace;

// Objet générique : un cube texturé
const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
const material = new THREE.MeshStandardMaterial({ map: crateTexture });
const cube = new THREE.Mesh(geometry, material);
cube.position.x = 3.5;
scene.add(cube);

// Sphère texturée : la Terre (texture en projection équirectangulaire)
const earthTexture = textureLoader.load('textures/earth.jpg');
earthTexture.colorSpace = THREE.SRGBColorSpace;

const earth = new THREE.Mesh(
    new THREE.SphereGeometry(1.2, 64, 32), // rayon, segments horizontaux, verticaux
    new THREE.MeshStandardMaterial({ map: earthTexture })
);
earth.position.x = -3.5;
earth.rotation.z = THREE.MathUtils.degToRad(23.4); // inclinaison de l'axe terrestre
scene.add(earth);

// Modèle 3D glTF : le canard
let duck = null;
let duckBaseY = 0; // hauteur de repos du canard (utile pour le saut)
// duck.glb est compressé avec Draco : il faut un décodeur en plus du GLTFLoader
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/libs/draco/gltf/');

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);
gltfLoader.load(
    'models/duck.glb',
    (gltf) => {
        duck = gltf.scene;

        // On ne connaît pas l'échelle du modèle : on la calcule avec sa boîte englobante
        const box = new THREE.Box3().setFromObject(duck);
        const size = box.getSize(new THREE.Vector3());
        const scale = 2 / Math.max(size.x, size.y, size.z);
        duck.scale.setScalar(scale);

        // Recentrer le modèle sur sa position
        const center = box.getCenter(new THREE.Vector3()).multiplyScalar(scale);
        duck.position.set(-center.x, -center.y, -center.z);
        duckBaseY = duck.position.y;

        scene.add(duck);
    },
    undefined,
    (error) => console.error('Erreur de chargement du modèle :', error)
);

// Pluie : un nuage de particules (Points)
const RAIN_COUNT = 3000;
const rainPositions = new Float32Array(RAIN_COUNT * 3); // x, y, z pour chaque goutte
const rainSpeeds = new Float32Array(RAIN_COUNT);

for (let i = 0; i < RAIN_COUNT; i++) {
    rainPositions[i * 3] = THREE.MathUtils.randFloatSpread(20);      // x entre -10 et 10
    rainPositions[i * 3 + 1] = THREE.MathUtils.randFloat(-5, 10);    // y
    rainPositions[i * 3 + 2] = THREE.MathUtils.randFloat(-12, 4);    // z
    rainSpeeds[i] = THREE.MathUtils.randFloat(0.08, 0.15);
}

const rainGeometry = new THREE.BufferGeometry();
rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));

const rainMaterial = new THREE.PointsMaterial({
    color: 0x99bbff,
    size: 0.05,
    transparent: true,
    opacity: 0.7,
});

const rain = new THREE.Points(rainGeometry, rainMaterial);
scene.add(rain);

function updateRain() {
    for (let i = 0; i < RAIN_COUNT; i++) {
        rainPositions[i * 3 + 1] -= rainSpeeds[i];
        // Quand la goutte passe sous la scène, on la remet en haut
        if (rainPositions[i * 3 + 1] < -5) {
            rainPositions[i * 3 + 1] = 10;
        }
    }
    // Prévenir Three.js que les positions ont changé
    rainGeometry.attributes.position.needsUpdate = true;
}

// Capteurs du smartphone
let orientation = null;   // dernières valeurs alpha / beta / gamma
let duckJump = 0;         // vitesse verticale du saut du canard
let duckHeight = 0;       // hauteur actuelle du saut

function onOrientation(event) {
    if (event.beta === null) return; // pas de capteur (ordinateur)
    orientation = { alpha: event.alpha, beta: event.beta, gamma: event.gamma };
    document.getElementById('alpha').textContent = event.alpha.toFixed(1);
    document.getElementById('beta').textContent = event.beta.toFixed(1);
    document.getElementById('gamma').textContent = event.gamma.toFixed(1);
}

function onMotion(event) {
    const a = event.acceleration;
    if (!a || a.x === null) return;
    const force = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
    document.getElementById('accel').textContent = force.toFixed(2);

    // Secouer le téléphone fait sauter le canard
    if (force > 12 && duckHeight === 0) {
        duckJump = 0.15;
    }
}

async function enableSensors() {
    // iOS demande une autorisation explicite, déclenchée par un clic
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== 'granted') return;
        await DeviceMotionEvent.requestPermission();
    }
    window.addEventListener('deviceorientation', onOrientation);
    window.addEventListener('devicemotion', onMotion);
    document.getElementById('sensors-btn').disabled = true;
}

document.getElementById('sensors-btn').addEventListener('click', enableSensors);

// Boucle d'animation
function animate() {
    updateRain();

    // Obligatoire avec enableDamping : met à jour la caméra à chaque image
    controls.update();

    // La Terre tourne toujours sur elle-même
    earth.rotateY(0.005);

    if (orientation) {
        // Le cube suit l'inclinaison du téléphone (degrés -> radians)
        cube.rotation.x = THREE.MathUtils.degToRad(orientation.beta);
        cube.rotation.y = THREE.MathUtils.degToRad(orientation.gamma);
    } else {
        // Sans capteur : rotation automatique
        cube.rotation.x += 0.01;
        cube.rotation.y += 0.01;
    }

    if (duck) {
        if (orientation) {
            duck.rotation.y = THREE.MathUtils.degToRad(orientation.alpha);
        } else {
            duck.rotation.y += 0.01;
        }

        // Petite physique du saut : vitesse + gravité
        if (duckJump !== 0 || duckHeight > 0) {
            duckHeight += duckJump;
            duckJump -= 0.01;
            if (duckHeight <= 0) {
                duckHeight = 0;
                duckJump = 0;
            }
        }
        duck.position.y = duckBaseY + duckHeight;
    }
    renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);

// Adapter la scène quand la fenêtre change de taille
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
