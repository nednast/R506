const nice = [43.7102, 7.2620];

const triangleDesBermudes = [
    [25.7617, -80.1918],
    [32.3078, -64.7505],
    [18.4655, -66.1057]
];

const map = L.map('map');

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

L.marker(nice).addTo(map).bindPopup("Nice");

L.polygon(triangleDesBermudes, { color: "red" }).addTo(map).bindPopup("Triangle des Bermudes");

function centrerSurPosition(position) {
    const position_utilisateur = [position.coords.latitude, position.coords.longitude];
    map.setView(position_utilisateur, 13);
    L.marker(position_utilisateur).addTo(map).bindPopup("Ma position");
}

if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(centrerSurPosition, () => map.setView(nice, 13));
} else {
    map.setView(nice, 13);
}
