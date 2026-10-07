import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Conteneur du globe : la taille du rendu suit ce div (utile quand on ajoutera la carte Leaflet)
const container = document.getElementById('globe');

// Scène
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// Caméra : la Terre a un rayon de 1, on se place à 3 unités du centre
const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
camera.position.set(0, 0, 3);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

// Contrôles : tourner autour de la Terre et zoomer
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 1.3;  // ne pas rentrer dans la Terre
controls.maxDistance = 10;

// Lumières : ambiante pour voir toute la planète, directionnelle comme le Soleil
scene.add(new THREE.AmbientLight(0xffffff, 0.6));

const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(5, 3, 5);
scene.add(sun);

// La Terre : sphère de rayon 1 avec une texture équirectangulaire
const EARTH_RADIUS = 1;

const textureLoader = new THREE.TextureLoader();
const earthTexture = textureLoader.load('textures/earth.jpg');
earthTexture.colorSpace = THREE.SRGBColorSpace;

const earth = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_RADIUS, 64, 32),
    new THREE.MeshStandardMaterial({ map: earthTexture })
);
scene.add(earth);

// Conversion Lat/Lon -> coordonnées cartésiennes (x, y, z)
// Formule Wikipedia (axe Z vers le pôle Nord) :
//   X = r·cos(lat)·cos(lon)   Y = r·cos(lat)·sin(lon)   Z = r·sin(lat)
// Mais dans Three.js c'est l'axe Y qui monte, donc on adapte :
//   x = X, y = Z (pôle Nord en haut), z = -Y
// Le signe "-" vient de la façon dont SphereGeometry plaque la texture :
// la longitude 0 (Greenwich) se retrouve sur +x et la longitude 90°E sur -z.
function latLonToVector3(lat, lon, radius) {
    const latRad = THREE.MathUtils.degToRad(lat);
    const lonRad = THREE.MathUtils.degToRad(lon);

    return new THREE.Vector3(
        radius * Math.cos(latRad) * Math.cos(lonRad),
        radius * Math.sin(latRad),
        -radius * Math.cos(latRad) * Math.sin(lonRad)
    );
}

// Marqueur de ma position : petite sphère rouge posée sur la surface
function addMyPositionMarker(lat, lon) {
    const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.02, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    // Légèrement au-dessus de la surface pour ne pas être caché dans la sphère
    marker.position.copy(latLonToVector3(lat, lon, EARTH_RADIUS * 1.01));
    // Enfant de la Terre : le marqueur tournera avec elle
    earth.add(marker);

    // Placer la caméra au-dessus de ma position pour la voir directement
    camera.position.copy(latLonToVector3(lat, lon, 3));
}

// Marqueur de sélection (jaune) : montre sur le globe l'endroit choisi sur la carte
const selectionMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.015, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xffd84d })
);
selectionMarker.visible = false;
earth.add(selectionMarker);

// Vol de la caméra vers un point du globe
// Plutôt que de tourner la Terre (ce qui pencherait le pôle Nord), on fait tourner
// la caméra autour du centre : visuellement l'endroit vient se placer face à nous.
// On interpole une rotation (quaternion) pour suivre la courbe de la sphère,
// alors qu'une interpolation en ligne droite traverserait la Terre.
const flight = {
    active: false,
    t: 0,
    start: new THREE.Vector3(),
    rotation: new THREE.Quaternion(),
};
const flightStep = new THREE.Quaternion();

function flyTo(lat, lon) {
    flight.start.copy(camera.position);
    const from = camera.position.clone().normalize();
    const to = latLonToVector3(lat, lon, 1);
    flight.rotation.setFromUnitVectors(from, to);
    flight.t = 0;
    flight.active = true;

    selectionMarker.position.copy(latLonToVector3(lat, lon, EARTH_RADIUS * 1.01));
    selectionMarker.visible = true;
}

function updateFlight() {
    if (!flight.active) return;

    flight.t = Math.min(flight.t + 0.02, 1); // environ 50 images = ~1 seconde
    const eased = flight.t * flight.t * (3 - 2 * flight.t); // démarrage et arrivée en douceur

    // Rotation partielle (de 0 à 100 %) appliquée à la position de départ
    flightStep.identity().slerp(flight.rotation, eased);
    camera.position.copy(flight.start).applyQuaternion(flightStep);

    if (flight.t === 1) flight.active = false;
}

// Carte Leaflet
const map = L.map('map').setView([20, 0], 2);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

const selectionText = document.getElementById('selection');

// Leaflet -> 3D : un clic sur la carte fait tourner le globe vers cet endroit
map.on('click', (event) => {
    // wrap() ramène la longitude entre -180 et 180 (la carte se répète à l'infini)
    const { lat, lng } = event.latlng.wrap();
    selectionText.textContent = `Sélection : ${lat.toFixed(2)}, ${lng.toFixed(2)}`;
    flyTo(lat, lng);
});

// Pays avec leur drapeau
// Le TD indique restcountries.com, mais son ancienne API (v3.1) a été fermée et la v5
// exige une clé API. On utilise donc mledoze/countries : le jeu de données open source
// sur lequel restcountries est construit (mêmes champs : name, latlng, cca2...).
// Les images des drapeaux viennent de flagcdn.com (CORS autorisé, nécessaire pour WebGL).
const COUNTRIES_URL = 'https://raw.githubusercontent.com/mledoze/countries/master/countries.json';

const FLAG_WIDTH = 0.03;
const FLAG_HEIGHT = 0.02;
const flagGeometry = new THREE.PlaneGeometry(FLAG_WIDTH, FLAG_HEIGHT); // partagée par tous les drapeaux
const countryMarkers = []; // gardés pour les interactions (part 2)

function addCountryFlag(country) {
    const [lat, lon] = country.latlng;
    const code = country.cca2.toLowerCase();

    const flagTexture = textureLoader.load(`https://flagcdn.com/w80/${code}.png`);
    flagTexture.colorSpace = THREE.SRGBColorSpace;

    const flag = new THREE.Mesh(
        flagGeometry,
        new THREE.MeshBasicMaterial({ map: flagTexture, side: THREE.DoubleSide })
    );

    // Position : juste au-dessus de la surface
    const position = latLonToVector3(lat, lon, EARTH_RADIUS * 1.02);
    flag.position.copy(position);

    // Orientation : le plan regarde vers +z par défaut, on le tourne
    // pour qu'il regarde vers l'extérieur de la Terre (direction de la normale)
    const normal = position.clone().normalize();
    flag.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);

    // Infos du pays stockées dans l'objet, pour les retrouver au clic plus tard
    flag.userData = {
        name: country.translations.fra?.common ?? country.name.common,
        code: country.cca2,
        lat,
        lon,
    };

    earth.add(flag);
    countryMarkers.push(flag);

    // Le même pays sur la carte Leaflet : un clic sur ce marqueur fait tourner le globe
    L.circleMarker([lat, lon], {
        radius: 4,
        color: '#ffd84d',
        weight: 1,
        fillOpacity: 0.8,
        bubblingMouseEvents: false, // sinon le clic déclencherait aussi le clic de la carte
    })
        .bindTooltip(flag.userData.name)
        .on('click', () => {
            selectionText.textContent = `Sélection : ${flag.userData.name}`;
            flyTo(lat, lon);
        })
        .addTo(map);
}

fetch(COUNTRIES_URL)
    .then((response) => response.json())
    .then((countries) => {
        countries.forEach(addCountryFlag);
        console.log(`${countryMarkers.length} pays affichés`);
    })
    .catch((error) => console.error('Erreur de chargement des pays :', error));

// 3D -> Leaflet : clic sur le globe avec un Raycaster
// Le Raycaster lance un rayon depuis la caméra à travers le pixel cliqué
// et renvoie les objets traversés, du plus proche au plus loin.
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

// Coordonnées de la souris converties en NDC (-1 à 1), le repère qu'attend le Raycaster
function updatePointer(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

// Premier objet touché : un drapeau ou la Terre elle-même
// (un drapeau caché derrière la Terre ne sera jamais le premier, la Terre est plus proche)
function pick(event) {
    updatePointer(event);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects([...countryMarkers, earth], false);
    return hits[0] ?? null;
}

// Fonction inverse de latLonToVector3 : point de la sphère -> lat/lon
function vector3ToLatLon(point) {
    const r = point.length();
    return {
        lat: THREE.MathUtils.radToDeg(Math.asin(point.y / r)),
        lon: THREE.MathUtils.radToDeg(Math.atan2(-point.z, point.x)),
    };
}

// OrbitControls utilise aussi le clic pour tourner : on ne considère que les clics
// où la souris n'a (presque) pas bougé, sinon chaque rotation recentrerait la carte
let pointerDownAt = null;

renderer.domElement.addEventListener('pointerdown', (event) => {
    pointerDownAt = { x: event.clientX, y: event.clientY };
});

renderer.domElement.addEventListener('pointerup', (event) => {
    if (!pointerDownAt) return;
    const moved = Math.hypot(event.clientX - pointerDownAt.x, event.clientY - pointerDownAt.y);
    pointerDownAt = null;
    if (moved > 5) return;

    const hit = pick(event);
    if (!hit) return;

    if (hit.object === earth) {
        // Clic sur la Terre : on retrouve la lat/lon du point touché
        // (worldToLocal au cas où la Terre serait tournée)
        const { lat, lon } = vector3ToLatLon(earth.worldToLocal(hit.point.clone()));
        selectionText.textContent = `Sélection : ${lat.toFixed(2)}, ${lon.toFixed(2)}`;
        selectionMarker.position.copy(latLonToVector3(lat, lon, EARTH_RADIUS * 1.01));
        selectionMarker.visible = true;
        map.flyTo([lat, lon], 4);
    } else {
        // Clic sur un drapeau : on recentre la carte sur le pays
        const { name, lat, lon } = hit.object.userData;
        selectionText.textContent = `Sélection : ${name}`;
        selectionMarker.visible = false;
        map.flyTo([lat, lon], 5);
    }
});

// Curseur "main" quand on survole un drapeau
renderer.domElement.addEventListener('pointermove', (event) => {
    const hit = pick(event);
    renderer.domElement.style.cursor = hit && hit.object !== earth ? 'pointer' : '';
});

// Géolocalisation
const myPositionText = document.getElementById('my-position');

navigator.geolocation.getCurrentPosition(
    (position) => {
        const { latitude, longitude } = position.coords;
        myPositionText.textContent = `Ma position : ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        addMyPositionMarker(latitude, longitude);

        // Ma position aussi sur la carte (clic = retour du globe sur moi)
        L.marker([latitude, longitude])
            .bindTooltip('Ma position')
            .on('click', () => {
                selectionText.textContent = 'Sélection : ma position';
                flyTo(latitude, longitude);
            })
            .addTo(map);
        map.setView([latitude, longitude], 4);
    },
    (error) => {
        myPositionText.textContent = `Géolocalisation impossible : ${error.message}`;
    }
);

// Boucle d'animation
function animate() {
    updateFlight();
    controls.update();
    renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);

// Adapter le rendu à la taille du conteneur
window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
});
