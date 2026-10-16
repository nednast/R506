import * as THREE from 'three';

const video = document.getElementById('camera');
const statusText = document.getElementById('status');
const positionText = document.getElementById('position');
const headingText = document.getElementById('heading');
const startButton = document.getElementById('start-btn');

// Scène Three.js
const scene = new THREE.Scene(); // pas de background : on veut voir la vidéo derrière

// La caméra Three.js reste au centre (0, 0, 0) : c'est nous. Seule son orientation change.
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

// Étiquette texte : on dessine le texte dans un canvas 2D qui sert de texture à un Sprite
// (un Sprite est toujours tourné face à la caméra)
// sprite.userData.setText() permet de changer le texte (ex : la distance qui évolue)
function makeLabel(text, color, width = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
    sprite.scale.set(2 * (width / 256), 1, 1);

    function setText(lines) {
        const rows = Array.isArray(lines) ? lines : [lines];
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // 1 ligne en gros, ou 2 lignes plus petites (nom + distance)
        const size = rows.length === 1 ? 72 : 44;
        ctx.font = `bold ${size}px sans-serif`;
        rows.forEach((row, i) => {
            const y = canvas.height * (i + 1) / (rows.length + 1);
            ctx.fillText(row, canvas.width / 2, y);
        });
        texture.needsUpdate = true; // la texture doit être renvoyée à la carte graphique
    }

    setText(text);
    sprite.userData.setText = setText;
    return sprite;
}

// Repère des points cardinaux, à 10 m autour de nous
// Convention du monde 3D : -Z = Nord, +X = Est, +Y = haut (voir orientationToQuaternion)
const cardinals = [
    { text: 'N', color: '#ff4d4d', position: [0, 0, -10] },
    { text: 'E', color: '#ffffff', position: [10, 0, 0] },
    { text: 'S', color: '#ffffff', position: [0, 0, 10] },
    { text: 'O', color: '#ffffff', position: [-10, 0, 0] },
];
cardinals.forEach(({ text, color, position }) => {
    const label = makeLabel(text, color);
    label.position.set(...position);
    scene.add(label);
});

// Objets géolocalisés
const EARTH_RADIUS = 6371000; // en mètres
const MAX_DISPLAY_DISTANCE = 100; // au-delà, on rapproche l'objet (mais on garde sa direction)

// Distance entre deux points GPS, formule de haversine (en mètres)
function distanceBetween(from, to) {
    const lat1 = THREE.MathUtils.degToRad(from.lat);
    const lat2 = THREE.MathUtils.degToRad(to.lat);
    const dLat = lat2 - lat1;
    const dLon = THREE.MathUtils.degToRad(to.lon - from.lon);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(a));
}

// Cap pour aller de "from" à "to" (en radians, 0 = Nord, sens horaire)
function bearingBetween(from, to) {
    const lat1 = THREE.MathUtils.degToRad(from.lat);
    const lat2 = THREE.MathUtils.degToRad(to.lat);
    const dLon = THREE.MathUtils.degToRad(to.lon - from.lon);
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    return Math.atan2(y, x);
}

// Point situé à "north" mètres au nord et "east" mètres à l'est d'une position
// (approximation locale, valable pour quelques centaines de mètres)
function offsetPosition(origin, north, east) {
    const dLat = north / EARTH_RADIUS;
    const dLon = east / (EARTH_RADIUS * Math.cos(THREE.MathUtils.degToRad(origin.lat)));
    return {
        lat: origin.lat + THREE.MathUtils.radToDeg(dLat),
        lon: origin.lon + THREE.MathUtils.radToDeg(dLon),
    };
}

function formatDistance(meters) {
    return meters < 1000 ? `${meters.toFixed(0)} m` : `${(meters / 1000).toFixed(1)} km`;
}

// Lieux réels, loin d'ici : on les verra dans leur direction, rapprochés à 100 m
const PLACES = [
    { name: 'Tour Eiffel', lat: 48.8584, lon: 2.2945, color: 0xc08040 },
    { name: 'Mont Blanc', lat: 45.8326, lon: 6.8652, color: 0xffffff },
    { name: 'Mont-Saint-Michel', lat: 48.6361, lon: -1.5115, color: 0x9999aa },
    { name: 'Notre-Dame de la Garde', lat: 43.2840, lon: 5.3712, color: 0xffd700 },
];

const geoObjects = [];

function addGeoObject({ name, lat, lon, color, geometry }) {
    const group = new THREE.Group();

    const mesh = new THREE.Mesh(
        geometry ?? new THREE.ConeGeometry(0.5, 1.5, 16),
        new THREE.MeshStandardMaterial({ color })
    );
    group.add(mesh);

    const label = makeLabel([name, '…'], '#ffffff', 512);
    label.position.y = 1.6; // au-dessus de l'objet
    group.add(label);

    group.visible = false; // invisible tant qu'on ne connaît pas notre position
    scene.add(group);
    geoObjects.push({ name, lat, lon, color, group, mesh, label, mapLine: null });
}

// Mini-carte Leaflet : boussole 2D
// Elle suit notre position ; une ligne relie chaque objet à nous pour montrer sa direction
const minimapElement = document.getElementById('minimap');
const minimap = L.map(minimapElement, { zoomControl: false }).setView([0, 0], 17);
minimap.attributionControl.setPrefix(false); // juste le crédit OSM, obligatoire, sans "Leaflet"

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap',
}).addTo(minimap);

// Notre position : une flèche (divIcon) qui tourne selon le cap du téléphone
const headingIcon = L.divIcon({
    className: '', // pas le style par défaut (carré blanc)
    html: '<div class="heading-arrow"></div>',
    iconSize: [16, 22],
    iconAnchor: [8, 15], // centre de rotation de la flèche
});
let myMapMarker = null;

function toCssColor(color) {
    return `#${color.toString(16).padStart(6, '0')}`;
}

function updateMinimap() {
    const me = [myPosition.lat, myPosition.lon];

    if (!myMapMarker) {
        myMapMarker = L.marker(me, { icon: headingIcon }).addTo(minimap);
        minimapElement.style.visibility = 'visible';
    }
    myMapMarker.setLatLng(me);
    minimap.setView(me, minimap.getZoom(), { animate: false });

    geoObjects.forEach((object) => {
        const target = [object.lat, object.lon];
        if (!object.mapLine) {
            // Créés une seule fois, ensuite on déplace juste le point de départ
            object.mapLine = L.polyline([me, target], {
                color: toCssColor(object.color),
                weight: 3,
                dashArray: '6 4',
            }).addTo(minimap);
            L.circleMarker(target, {
                radius: 5,
                color: '#000',
                weight: 1,
                fillColor: toCssColor(object.color),
                fillOpacity: 1,
            })
                .bindTooltip(object.name)
                .addTo(minimap);
        } else {
            object.mapLine.setLatLngs([me, target]);
        }
    });
}

function rotateMinimapArrow(heading) {
    const arrow = myMapMarker?.getElement()?.querySelector('.heading-arrow');
    if (arrow) arrow.style.transform = `rotate(${heading}deg)`;
}

PLACES.forEach(addGeoObject);

// Objets de test, créés autour de notre première position pour pouvoir marcher jusqu'à eux
// (ensuite ils restent fixes : ce sont de vraies coordonnées GPS)
let testObjectsCreated = false;

function createTestObjects(origin) {
    const tests = [
        { name: 'Cube rouge', north: 20, east: 0, color: 0xff3333, geometry: new THREE.BoxGeometry(1, 1, 1) },
        { name: 'Sphère verte', north: 0, east: 30, color: 0x33ff66, geometry: new THREE.SphereGeometry(0.6, 32, 16) },
        { name: 'Anneau bleu', north: -15, east: -15, color: 0x3399ff, geometry: new THREE.TorusGeometry(0.5, 0.2, 16, 32) },
    ];
    tests.forEach(({ north, east, ...object }) => {
        addGeoObject({ ...object, ...offsetPosition(origin, north, east) });
    });
    testObjectsCreated = true;
}

// Place chaque objet dans la scène selon notre position actuelle
// Monde 3D : -Z = Nord, +X = Est (même convention que la caméra)
function updateGeoObjects() {
    if (!myPosition) return;

    geoObjects.forEach(({ lat, lon, group, label, name }) => {
        const distance = distanceBetween(myPosition, { lat, lon });
        const bearing = bearingBetween(myPosition, { lat, lon });
        const displayDistance = Math.min(distance, MAX_DISPLAY_DISTANCE);

        group.position.set(
            Math.sin(bearing) * displayDistance,
            0,
            -Math.cos(bearing) * displayDistance
        );

        // Plus l'objet est loin, plus on l'agrandit, pour qu'il reste lisible à l'écran
        group.scale.setScalar(Math.max(1, displayDistance / 15));

        label.userData.setText([name, formatDistance(distance)]);
        group.visible = true;
    });
}

// Petite animation : les objets tournent sur eux-mêmes
function spinGeoObjects() {
    geoObjects.forEach(({ mesh }) => {
        mesh.rotation.y += 0.02;
    });
}

// Boussole 3D : une flèche devant la caméra qui pointe vers l'objet choisi
// La flèche est enfant de la caméra : elle reste toujours en bas de l'écran,
// mais lookAt() l'oriente vers la position de la cible dans le monde.
scene.add(camera); // nécessaire pour afficher les enfants de la caméra

const arrowMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
const compassArrow = new THREE.Group();

// lookAt() oriente l'axe +Z d'un objet vers la cible : on construit donc la flèche le long de +Z
// (cône et cylindre sont verticaux (+Y) par défaut, on les couche avec rotation.x = 90°)
const arrowHead = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 16), arrowMaterial);
arrowHead.rotation.x = Math.PI / 2;
arrowHead.position.z = 0.25;
const arrowBody = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 12), arrowMaterial);
arrowBody.rotation.x = Math.PI / 2;
compassArrow.add(arrowHead, arrowBody);

compassArrow.position.set(0, -0.7, -2); // devant nous, en bas de l'écran
compassArrow.visible = false;
camera.add(compassArrow);

const targetText = document.getElementById('target');
const targetButton = document.getElementById('target-btn');
let target = null;
const targetWorldPosition = new THREE.Vector3();

function selectTarget(object) {
    target = object;
    arrowMaterial.color.setHex(object.color);
    compassArrow.visible = true;
    updateTargetText();
}

function updateTargetText() {
    if (!target || !myPosition) return;
    const distance = distanceBetween(myPosition, target);
    targetText.textContent = `Cible : ${target.name} — ${formatDistance(distance)}`;
}

// Bouton : passe à l'objet suivant de la liste
targetButton.addEventListener('click', () => {
    const index = target ? geoObjects.indexOf(target) : -1;
    selectTarget(geoObjects[(index + 1) % geoObjects.length]);
});

// Toucher un objet à l'écran le choisit comme cible (Raycaster, comme dans l'exercice 1)
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

renderer.domElement.addEventListener('pointerup', (event) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    const groups = geoObjects.filter((o) => o.group.visible).map((o) => o.group);
    const hit = raycaster.intersectObjects(groups, true)[0];
    if (!hit) return;

    // L'objet touché est le mesh ou l'étiquette : on remonte jusqu'à son groupe
    const touched = geoObjects.find((o) => o.group === hit.object.parent);
    if (touched) selectTarget(touched);
});

function updateCompassArrow() {
    if (!target) return;
    // La matrice de la caméra doit être à jour avant lookAt (elle vient de tourner)
    camera.updateMatrixWorld();
    target.group.getWorldPosition(targetWorldPosition);
    compassArrow.lookAt(targetWorldPosition);
}

// Orientation du téléphone -> orientation de la caméra
// alpha : rotation autour de l'axe vertical (boussole), beta : avant/arrière, gamma : gauche/droite
// Même principe que l'ancien DeviceOrientationControls de Three.js :
//  1. angles d'Euler dans l'ordre 'YXZ' (alpha autour de Y, beta autour de X, gamma autour de Z)
//  2. -90° autour de X : la caméra regarde par l'arrière du téléphone, pas par le haut
//  3. compensation de la rotation de l'écran (portrait / paysage)
const euler = new THREE.Euler();
const backCamera = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // -90° autour de X
const screenRotation = new THREE.Quaternion();
const zAxis = new THREE.Vector3(0, 0, 1);

function orientationToQuaternion(quaternion, alpha, beta, gamma, screenAngle) {
    euler.set(
        THREE.MathUtils.degToRad(beta),
        THREE.MathUtils.degToRad(alpha),
        THREE.MathUtils.degToRad(-gamma),
        'YXZ'
    );
    quaternion.setFromEuler(euler);
    quaternion.multiply(backCamera);
    quaternion.multiply(screenRotation.setFromAxisAngle(zAxis, -THREE.MathUtils.degToRad(screenAngle)));
}

let deviceOrientation = null;

function onOrientation(event) {
    if (event.beta === null) return; // pas de capteur (ordinateur)

    // alpha doit être mesuré par rapport au Nord, sinon les objets ne seront pas au bon endroit
    let alpha = event.alpha;
    if (typeof event.webkitCompassHeading === 'number') {
        // iOS : cap boussole dans le sens horaire, alpha est dans le sens inverse
        alpha = 360 - event.webkitCompassHeading;
    }

    deviceOrientation = { alpha, beta: event.beta, gamma: event.gamma };

    const heading = (360 - alpha) % 360; // cap affiché : 0 = Nord, 90 = Est
    headingText.textContent = `Cap : ${heading.toFixed(0)}°`;
    rotateMinimapArrow(heading);
}

// Géolocalisation : watchPosition suit nos déplacements en continu
let myPosition = null;

function startGeolocation() {
    navigator.geolocation.watchPosition(
        (position) => {
            const { latitude, longitude, accuracy } = position.coords;
            myPosition = { lat: latitude, lon: longitude };
            positionText.textContent =
                `Position : ${latitude.toFixed(5)}, ${longitude.toFixed(5)} (± ${accuracy.toFixed(0)} m)`;

            if (!testObjectsCreated) createTestObjects(myPosition);
            updateGeoObjects();
            updateMinimap();
            updateTargetText();
            targetButton.disabled = false;
        },
        (error) => {
            positionText.textContent = `Géolocalisation impossible : ${error.message}`;
        },
        { enableHighAccuracy: true }
    );
}

// Capteurs d'orientation
async function startOrientation() {
    // iOS demande une autorisation, qui doit être appelée directement dans le clic
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== 'granted') throw new Error('orientation refusée');
    }

    // Android (Chrome) : "deviceorientationabsolute" donne alpha par rapport au Nord
    if ('ondeviceorientationabsolute' in window) {
        window.addEventListener('deviceorientationabsolute', onOrientation);
    } else {
        window.addEventListener('deviceorientation', onOrientation);
    }
}

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
    startButton.disabled = true;
    const errors = [];

    // L'orientation d'abord : sur iOS, la demande doit suivre le clic sans autre attente
    try {
        await startOrientation();
    } catch (error) {
        errors.push(`orientation : ${error.message}`);
    }

    try {
        await startCamera();
    } catch (error) {
        errors.push(`caméra : ${error.message}`);
    }

    startGeolocation();

    statusText.textContent = errors.length ? `Erreurs — ${errors.join(' ; ')}` : 'Capteurs actifs';
});

// Boucle d'animation
function animate() {
    if (deviceOrientation) {
        const screenAngle = screen.orientation?.angle ?? window.orientation ?? 0;
        orientationToQuaternion(
            camera.quaternion,
            deviceOrientation.alpha,
            deviceOrientation.beta,
            deviceOrientation.gamma,
            screenAngle
        );
    }
    spinGeoObjects();
    updateCompassArrow();
    renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
