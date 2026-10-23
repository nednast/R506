import * as THREE from 'three';

const video = document.getElementById('camera');
const statusText = document.getElementById('status');
const predictionText = document.getElementById('prediction');
const startButton = document.getElementById('start-btn');
const infoBox = document.getElementById('info');
const infoPhoto = document.getElementById('info-photo');
const infoTitle = document.getElementById('info-title');
const infoText = document.getElementById('info-text');
const infoLink = document.getElementById('info-link');

// ---------------------------------------------------------------------------
// Scène Three.js, transparente, par-dessus la vidéo
// ---------------------------------------------------------------------------

const scene = new THREE.Scene(); // pas de background : on veut voir la vidéo derrière

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.5, 7);
camera.lookAt(0, 0.6, 0); // on vise sous le modèle pour qu'il soit dans la moitié haute (la fiche est en bas)

// alpha: true -> le fond du canvas est transparent
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const light = new THREE.DirectionalLight(0xffffff, 1.5);
light.position.set(2, 3, 4);
scene.add(light);

// Le modèle du lieu reconnu est mis dans ce pivot, qui tourne sur lui-même
const pivot = new THREE.Group();
scene.add(pivot);

// ---------------------------------------------------------------------------
// Modèles 3D des lieux, construits avec des formes simples (pas de fichier à charger)
// ---------------------------------------------------------------------------

function mesh(geometry, color, x = 0, y = 0, z = 0) {
    const material = new THREE.MeshStandardMaterial({ color, flatShading: true });
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    return m;
}

// Pyramide ou tronc à base carrée : un cylindre à 4 côtés, tourné de 45° pour avoir les faces alignées
function squareCylinder(radiusTop, radiusBottom, height) {
    return new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 4).rotateY(Math.PI / 4);
}

function eiffelTower() {
    const g = new THREE.Group();
    const color = 0x8d6e4b;
    // 4 pieds penchés vers le centre
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const leg = mesh(new THREE.BoxGeometry(0.22, 1.7, 0.22), color, sx * 0.7, 0.8, sz * 0.7);
        leg.rotation.z = sx * 0.35;
        leg.rotation.x = -sz * 0.35;
        g.add(leg);
    }
    g.add(mesh(new THREE.BoxGeometry(1.1, 0.12, 1.1), color, 0, 1.6));    // 1er étage
    g.add(mesh(squareCylinder(0.12, 0.55, 1.6), color, 0, 2.46));         // partie centrale
    g.add(mesh(new THREE.BoxGeometry(0.5, 0.1, 0.5), color, 0, 3.26));    // 2e étage
    g.add(mesh(squareCylinder(0.02, 0.12, 1.4), color, 0, 4.0));          // sommet
    g.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.4), color, 0, 4.9)); // antenne
    return g;
}

function triumphalArch() {
    const g = new THREE.Group();
    const color = 0xe8dcc0;
    g.add(mesh(new THREE.BoxGeometry(0.9, 2, 0.9), color, -0.95, 1));
    g.add(mesh(new THREE.BoxGeometry(0.9, 2, 0.9), color, 0.95, 1));
    g.add(mesh(new THREE.BoxGeometry(2.8, 1, 0.9), color, 0, 2.5));
    g.add(mesh(new THREE.BoxGeometry(3, 0.15, 1), color, 0, 3.07)); // corniche
    return g;
}

function church() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.BoxGeometry(1.4, 1.2, 2.4), 0xd7ccc8, 0, 0.6)); // nef
    const roof = mesh(new THREE.ConeGeometry(1, 0.8, 4).rotateY(Math.PI / 4), 0x795548, 0, 1.6);
    roof.scale.set(1, 1, 1.7); // toit allongé sur toute la nef
    g.add(roof);
    g.add(mesh(new THREE.BoxGeometry(0.6, 2.4, 0.6), 0xbcaaa4, 0, 1.2, 1.3)); // clocher
    g.add(mesh(new THREE.ConeGeometry(0.45, 1, 4).rotateY(Math.PI / 4), 0x546e7a, 0, 2.9, 1.3));
    g.add(mesh(new THREE.BoxGeometry(0.06, 0.5, 0.06), 0xffd54f, 0, 3.65, 1.3)); // croix
    g.add(mesh(new THREE.BoxGeometry(0.3, 0.06, 0.06), 0xffd54f, 0, 3.7, 1.3));
    return g;
}

function castle() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.BoxGeometry(2, 1.2, 2), 0x9e9e9e, 0, 0.6));
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        g.add(mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.8, 12), 0x8d8d8d, sx, 0.9, sz));
        g.add(mesh(new THREE.ConeGeometry(0.45, 0.7, 12), 0x3b5ba5, sx, 2.15, sz));
    }
    return g;
}

function lighthouse() {
    const g = new THREE.Group();
    // 5 bandes rouges et blanches, de plus en plus fines
    for (let i = 0; i < 5; i++) {
        const geometry = new THREE.CylinderGeometry(0.6 - (i + 1) * 0.05, 0.6 - i * 0.05, 0.6, 16);
        g.add(mesh(geometry, i % 2 ? 0xffffff : 0xd32f2f, 0, 0.3 + i * 0.6));
    }
    const lamp = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.4, 16), 0xffeb3b, 0, 3.2);
    lamp.material.emissive.set(0xffc107); // la lanterne brille
    g.add(lamp);
    g.add(mesh(new THREE.ConeGeometry(0.4, 0.4, 16), 0xd32f2f, 0, 3.6));
    return g;
}

function bridge() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.BoxGeometry(5, 0.15, 0.8), 0x607d8b, 0, 1)); // tablier
    for (const sx of [-1, 1]) {
        g.add(mesh(new THREE.BoxGeometry(0.4, 2.3, 0.9), 0xa1887f, sx * 2.3, -0.1)); // piles
    }
    // 2 arches : un demi-tore sous le tablier, et des poteaux entre l'arche et le tablier
    for (const z of [-0.35, 0.35]) {
        g.add(mesh(new THREE.TorusGeometry(2.2, 0.08, 8, 32, Math.PI), 0xc0392b, 0, -1.2, z));
        for (let x = -1.6; x <= 1.6; x += 0.8) {
            const archY = -1.2 + Math.sqrt(2.2 ** 2 - x ** 2);
            const height = 1 - archY;
            g.add(mesh(new THREE.BoxGeometry(0.06, height, 0.06), 0xc0392b, x, archY + height / 2, z));
        }
    }
    return g;
}

function mountain() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.ConeGeometry(2, 2.5, 7), 0x6d6d6d, 0, 1.25));
    g.add(mesh(new THREE.ConeGeometry(0.7, 0.88, 7), 0xffffff, 0, 2.07)); // neige au sommet
    g.add(mesh(new THREE.ConeGeometry(1.3, 1.6, 7), 0x7b8a6b, 1.4, 0.8, 0.5));
    return g;
}

function obelisk() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.BoxGeometry(1, 0.3, 1), 0xbdb6a8, 0, 0.15)); // socle
    g.add(mesh(squareCylinder(0.2, 0.3, 3), 0xd2b48c, 0, 1.8));
    g.add(mesh(new THREE.ConeGeometry(0.2, 0.3, 4).rotateY(Math.PI / 4), 0xffd54f, 0, 3.45)); // pyramidion doré
    return g;
}

function fountain() {
    const g = new THREE.Group();
    const water = 0x4fc3f7;
    g.add(mesh(new THREE.CylinderGeometry(1.5, 1.6, 0.4, 24), 0xbdb6a8, 0, 0.2)); // bassin
    g.add(mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.06, 24), water, 0, 0.4));
    g.add(mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.2, 12), 0xbdb6a8, 0, 1));
    g.add(mesh(new THREE.CylinderGeometry(0.6, 0.25, 0.25, 24), 0xbdb6a8, 0, 1.6)); // vasque
    g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6), water, 0, 2)); // jet d'eau
    return g;
}

// ---------------------------------------------------------------------------
// Lieux reconnus
// MobileNet connaît les 1000 classes d'ImageNet (en anglais). Il ne sait pas ce qu'est
// « la tour Eiffel », mais il reconnaît des types de lieux : on relie ces classes à nos lieux.
// labels = noms de classes ImageNet ; wiki = titre de la page Wikipédia en français
// ---------------------------------------------------------------------------

const PLACES = [
    // Sur une photo de la tour Eiffel, MobileNet répond souvent « grue » ou « plateforme pétrolière »
    { id: 'tour-eiffel', name: 'Tour Eiffel', labels: ['drilling platform', 'crane', 'pole'], wiki: 'Tour_Eiffel', build: eiffelTower },
    { id: 'arc-de-triomphe', name: 'Arc de triomphe', labels: ['triumphal arch'], wiki: "Arc_de_triomphe_de_l'Étoile", build: triumphalArch },
    { id: 'eglise', name: 'Église', labels: ['church', 'church building', 'monastery', 'bell cote', 'bell cot'], wiki: 'Église_(édifice)', build: church },
    { id: 'chateau', name: 'Château', labels: ['castle', 'palace'], wiki: 'Château', build: castle },
    { id: 'phare', name: 'Phare', labels: ['beacon', 'lighthouse'], wiki: 'Phare', build: lighthouse },
    { id: 'pont', name: 'Pont', labels: ['suspension bridge', 'steel arch bridge', 'viaduct'], wiki: 'Pont', build: bridge },
    { id: 'montagne', name: 'Montagne', labels: ['alp', 'volcano', 'valley', 'cliff'], wiki: 'Montagne', build: mountain },
    { id: 'obelisque', name: 'Obélisque', labels: ['obelisk'], wiki: 'Obélisque', build: obelisk },
    { id: 'fontaine', name: 'Fontaine', labels: ['fountain'], wiki: 'Fontaine', build: fountain },
];

// Remplace le modèle affiché, en le mettant à l'échelle et en le posant au centre
function showModel(place) {
    place.model ??= place.build(); // construit une seule fois, puis réutilisé
    const model = place.model;

    model.scale.setScalar(1);
    model.position.set(0, 0, 0);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = 2.6 / Math.max(size.x, size.y, size.z);
    model.scale.setScalar(scale);
    model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale); // base en y = 0

    pivot.clear();
    pivot.add(model);
    pivot.scale.setScalar(0.01); // petite animation d'apparition (voir animate)
}

// ---------------------------------------------------------------------------
// Fiche Wikipédia : photo 2D + résumé + lien
// L'API REST de Wikipédia autorise les appels depuis n'importe quel site (CORS)
// ---------------------------------------------------------------------------

const wikiCache = new Map(); // on ne télécharge chaque page qu'une fois

function fetchWiki(page) {
    if (!wikiCache.has(page)) {
        const url = `https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page)}`;
        const request = fetch(url).then((response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        });
        request.catch(() => wikiCache.delete(page)); // en cas d'erreur on réessaiera la prochaine fois
        wikiCache.set(page, request);
    }
    return wikiCache.get(page);
}

async function showInfo(place) {
    infoBox.hidden = false;
    infoTitle.textContent = place.name;
    infoText.textContent = 'Chargement de Wikipédia…';
    infoPhoto.removeAttribute('src');
    infoLink.href = `https://fr.wikipedia.org/wiki/${encodeURIComponent(place.wiki)}`;

    try {
        const page = await fetchWiki(place.wiki);
        if (place !== currentPlace) return; // un autre lieu a été reconnu pendant le chargement
        infoText.textContent = page.extract;
        if (page.thumbnail) infoPhoto.src = page.thumbnail.source;
        infoLink.href = page.content_urls.mobile.page;
    } catch (error) {
        if (place === currentPlace) infoText.textContent = `Wikipédia indisponible : ${error.message}`;
    }
}

// ---------------------------------------------------------------------------
// IA : classification de l'image de la caméra avec ml5.js
// Par défaut MobileNet. On peut aussi donner son propre modèle Teachable Machine :
//   index.html?model=https://teachablemachine.withgoogle.com/models/XXXX/
// Dans ce cas, les classes du modèle doivent porter l'id du lieu (ex : « tour-eiffel »)
// ---------------------------------------------------------------------------

const modelUrl = new URLSearchParams(location.search).get('model');

// Le modèle est créé au clic sur Démarrer, après la caméra :
// si ml5 plante sur le téléphone, la caméra marche quand même et l'erreur est affichée
let classifier = null;

const MIN_CONFIDENCE = 0.15;  // en dessous, la réponse de l'IA est ignorée
const FRAMES_TO_CONFIRM = 5;  // le même lieu doit être vu 5 fois de suite (évite le clignotement)

let candidate = null;
let candidateCount = 0;
let currentPlace = null;

// Cherche, parmi les meilleures réponses de l'IA, une classe qui correspond à un de nos lieux
function findPlace(results) {
    for (const { label, confidence } of results) {
        if (confidence < MIN_CONFIDENCE) continue;
        // Une classe ImageNet a plusieurs noms : « beacon, lighthouse, beacon light, pharos »
        // On compare nom par nom (sinon « fountain » trouverait aussi « fountain pen »)
        const names = label.toLowerCase().split(',').map((name) => name.trim());
        const place = PLACES.find((p) => names.includes(p.id) || p.labels.some((l) => names.includes(l)));
        if (place) return place;
    }
    return null;
}

// Appelée par ml5 à chaque image analysée, avec les 3 meilleures réponses
function gotResults(results) {
    const [best] = results;
    predictionText.textContent = `IA : ${best.label.split(',')[0]} (${Math.round(best.confidence * 100)} %)`;

    const place = findPlace(results);
    if (place === candidate) {
        candidateCount++;
    } else {
        candidate = place;
        candidateCount = 1;
    }

    if (place && candidateCount === FRAMES_TO_CONFIRM && place !== currentPlace) {
        currentPlace = place;
        statusText.textContent = `Lieu reconnu : ${place.name}`;
        showModel(place);
        showInfo(place);
    }
}

// ---------------------------------------------------------------------------
// Démarrage
// ---------------------------------------------------------------------------

// Sur le téléphone on n'a pas la console : on affiche les erreurs à l'écran
window.addEventListener('error', (event) => {
    statusText.textContent = `Erreur : ${event.message}`;
});
window.addEventListener('unhandledrejection', (event) => {
    statusText.textContent = `Erreur : ${event.reason?.message ?? event.reason}`;
});

// getUserMedia ne marche qu'en HTTPS ou sur localhost
async function startCamera() {
    if (!navigator.mediaDevices) {
        throw new Error('caméra indisponible (il faut ouvrir la page en HTTPS)');
    }
    const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, // caméra arrière du smartphone
        audio: false,
    });
    video.srcObject = stream;
}

// ml5 et Three.js sont chargés : on peut démarrer
startButton.disabled = false;
startButton.textContent = 'Démarrer';

// Le navigateur exige une action de l'utilisateur pour demander l'autorisation
startButton.addEventListener('click', async () => {
    startButton.disabled = true;

    try {
        await startCamera();
    } catch (error) {
        statusText.textContent = `Erreur caméra : ${error.message}`;
        startButton.disabled = false;
        return;
    }

    statusText.textContent = 'Chargement du modèle IA…';
    try {
        // Sans p5.js, ml5.imageClassifier() renvoie une promesse : on attend le classifieur chargé
        classifier = await ml5.imageClassifier(modelUrl ?? 'MobileNet');
    } catch (error) {
        statusText.textContent = `Erreur modèle IA : ${error.message}`;
        return;
    }

    statusText.textContent = modelUrl ? 'Modèle Teachable Machine actif' : 'MobileNet actif : vise un monument';
    classifier.classifyStart(video, gotResults); // classe la vidéo en boucle
});

// ---------------------------------------------------------------------------
// Rendu
// ---------------------------------------------------------------------------

const fullSize = new THREE.Vector3(1, 1, 1);

function animate() {
    pivot.rotation.y += 0.01;
    pivot.scale.lerp(fullSize, 0.1); // le modèle grossit doucement jusqu'à sa taille normale
    renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
