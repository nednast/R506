const nice = [43.7102, 7.2620];
const marseille = [43.2965, 5.3698];
const stadiaApiKey = "eed6a6b4-d171-43e4-8215-e5f8490b4245";

const triangleDesBermudes = [
    [25.7617, -80.1918],
    [32.3078, -64.7505],
    [18.4655, -66.1057]
];

const map = L.map('map');

L.tileLayer(`https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg?api_key=${stadiaApiKey}`, {
    maxZoom: 16,
    attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

L.marker(nice).addTo(map).bindPopup("Nice");

L.polygon(triangleDesBermudes, { color: "red" }).addTo(map).bindPopup("Triangle des Bermudes");

function centrerSurPosition(position) {
    const position_utilisateur = [position.coords.latitude, position.coords.longitude];
    map.setView(position_utilisateur, 13);

    L.marker(position_utilisateur).addTo(map).bindPopup("Ma position");

    L.circle(position_utilisateur, { radius: position.coords.accuracy, color: "blue" })
        .addTo(map)
        .bindPopup(`Précision : ${Math.round(position.coords.accuracy)} m`);

    const distanceMarseille = L.latLng(position_utilisateur).distanceTo(L.latLng(marseille)) / 1000;
    const distanceNice = L.latLng(position_utilisateur).distanceTo(L.latLng(nice)) / 1000;

    L.polyline([marseille, position_utilisateur], { color: "orange" })
        .addTo(map)
        .bindPopup(`Distance depuis Marseille : ${distanceMarseille.toFixed(1)} km`);

    ajouterDistance(`Distance depuis Marseille : ${distanceMarseille.toFixed(1)} km`);
    ajouterDistance(`Distance jusqu'à Nice : ${distanceNice.toFixed(1)} km`);

    afficherTrajet(position_utilisateur, nice);
}

function ajouterDistance(texte) {
    const item = document.createElement("li");
    item.textContent = texte;
    document.getElementById("distances").appendChild(item);
}

async function afficherTrajet(depart, arrivee) {
    const url = `https://router.project-osrm.org/route/v1/driving/${depart[1]},${depart[0]};${arrivee[1]},${arrivee[0]}?overview=full&geometries=geojson`;
    const reponse = await fetch(url);
    const donnees = await reponse.json();

    const trace = donnees.routes[0].geometry.coordinates.map(([lon, lat]) => [lat, lon]);
    L.polyline(trace, { color: "green" }).addTo(map).bindPopup("Trajet vers Nice");

    const distanceRoute = donnees.routes[0].distance / 1000;
    ajouterDistance(`Trajet routier jusqu'à Nice : ${distanceRoute.toFixed(1)} km`);
}

L.marker(marseille).addTo(map).bindPopup("Marseille");
L.polyline([marseille, nice], { color: "purple" }).addTo(map).bindPopup("Marseille - Nice");

const distanceMarseilleNice = L.latLng(marseille).distanceTo(L.latLng(nice)) / 1000;
ajouterDistance(`Distance Marseille - Nice : ${distanceMarseilleNice.toFixed(1)} km`);

fetch("https://geo.api.gouv.fr/communes/06088?format=geojson&geometry=contour")
    .then((reponse) => reponse.json())
    .then((geojson) => L.geoJSON(geojson, { style: { color: "teal" } }).addTo(map).bindPopup("Commune de Nice"));

if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(centrerSurPosition, () => map.setView(nice, 13));
} else {
    map.setView(nice, 13);
}
