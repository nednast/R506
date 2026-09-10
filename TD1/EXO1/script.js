function afficherPosition(position, cibleId) {
    const c = position.coords;
    const date = new Date(position.timestamp);

    document.getElementById(cibleId).innerHTML = `
        <li><span>Longitude</span><span>${c.longitude}</span></li>
        <li><span>Latitude</span><span>${c.latitude}</span></li>
        <li><span>Altitude</span><span>${c.altitude ?? "n/a"}</span></li>
        <li><span>Précision</span><span>${c.accuracy} m</span></li>
        <li><span>Vitesse</span><span>${c.speed ?? "n/a"}</span></li>
        <li><span>Date</span><span>${date.toLocaleString()}</span></li>
    `;
}

function afficherErreur(erreur, cibleId) {
    document.getElementById(cibleId).innerHTML = `<li><span>Erreur</span><span>${erreur.message}</span></li>`;
}

if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
        (pos) => afficherPosition(pos, "single"),
        (err) => afficherErreur(err, "single")
    );

    navigator.geolocation.watchPosition(
        (pos) => afficherPosition(pos, "watch"),
        (err) => afficherErreur(err, "watch")
    );
} else {
    document.body.innerHTML += "<p>Géolocalisation non supportée par ce navigateur.</p>";
}
