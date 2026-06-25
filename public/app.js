const contenedor = document.getElementById("partidos");
const actualizacion = document.getElementById("actualizacion");
const tablasContenedor = document.getElementById("tablas");
const bracketContenedor = document.getElementById("bracket");

// ---------------------------------------------------------------------------
// Mapeo de nombre de equipo (en inglés, como vienen de la API) a código ISO
// de país de 2 letras, usado para mostrar la bandera vía flagcdn.com.
// Cubre todos los equipos que aparecen en los datos del Mundial 2026.
// ---------------------------------------------------------------------------
const CODIGOS_PAIS = {
    "Mexico": "mx",
    "South Africa": "za",
    "South Korea": "kr",
    "Czech Republic": "cz",
    "United States": "us",
    "Paraguay": "py",
    "Canada": "ca",
    "Bosnia and Herzegovina": "ba",
    "Brazil": "br",
    "Morocco": "ma",
    "Netherlands": "nl",
    "Japan": "jp",
    "Australia": "au",
    "Turkey": "tr",
    "Qatar": "qa",
    "Switzerland": "ch",
    "Germany": "de",
    "Curaçao": "cw",
    "Ivory Coast": "ci",
    "Ecuador": "ec",
    "Sweden": "se",
    "Tunisia": "tn",
    "Iran": "ir",
    "New Zealand": "nz",
    "Egypt": "eg",
    "Belgium": "be",
    "Spain": "es",
    "Cape Verde": "cv",
    "Saudi Arabia": "sa",
    "Uruguay": "uy",
    "France": "fr",
    "Senegal": "sn",
    "Norway": "no",
    "Iraq": "iq",
    "Argentina": "ar",
    "Austria": "at",
    "Algeria": "dz",
    "Jordan": "jo",
    "Colombia": "co",
    "Democratic Republic of the Congo": "cd",
    "Portugal": "pt",
    "Uzbekistan": "uz",
    "England": "gb-eng",
    "Croatia": "hr",
    "Panama": "pa",
    "Ghana": "gh",
    "Haiti": "ht",
    "Scotland": "gb-sct"
};

function codigoBandera(nombreEquipo) {
    return CODIGOS_PAIS[nombreEquipo] || null;
}

function urlBandera(nombreEquipo) {
    const codigo = codigoBandera(nombreEquipo);
    return codigo ? `https://flagcdn.com/48x36/${codigo}.png` : "";
}

function htmlBandera(nombreEquipo) {
    const url = urlBandera(nombreEquipo);
    if (!url) return "";
    return `<img class="bandera" src="${url}" alt="${nombreEquipo}" loading="lazy">`;
}

// ---------------------------------------------------------------------------
// Carga y filtrado de partidos
// ---------------------------------------------------------------------------

async function obtenerPartidos() {
    const respuesta = await fetch("/api/partidos");

    if (!respuesta.ok) {
        const cuerpoError = await respuesta.json().catch(() => ({}));
        throw new Error(cuerpoError.detalle || `Error del servidor (${respuesta.status})`);
    }

    const datos = await respuesta.json();

    return Array.isArray(datos)
        ? datos
        : (datos.games || datos.matches || datos.data || []);
}

function esPartidoDeGrupos(partido) {
    return partido.type === "group" && partido.home_team_name_en && partido.away_team_name_en;
}

function esPartidoEnVivo(partido) {
    return partido.time_elapsed === "live";
}

// ---------------------------------------------------------------------------
// Render de partidos en vivo
// ---------------------------------------------------------------------------

function renderPartidosEnVivo(partidosEnVivo) {

    contenedor.innerHTML = "";

    if (partidosEnVivo.length === 0) {
        contenedor.innerHTML = `<p class="mensaje">No hay partidos en vivo ahora.</p>`;
        return;
    }

    partidosEnVivo.forEach(partido => {

        const div = document.createElement("div");
        div.className = "partido en-vivo";

        div.innerHTML = `
            <div class="etiqueta-vivo">🔴 EN VIVO · Grupo ${partido.group}</div>
            <div class="equipos">
                <span class="equipo">${htmlBandera(partido.home_team_name_en)} ${partido.home_team_name_en}</span>
                <span class="marcador">${partido.home_score} - ${partido.away_score}</span>
                <span class="equipo">${partido.away_team_name_en} ${htmlBandera(partido.away_team_name_en)}</span>
            </div>
        `;

        contenedor.appendChild(div);
    });
}

// ---------------------------------------------------------------------------
// Cálculo de tabla de posiciones por grupo, a partir de los partidos
// (no depende de un endpoint de standings: la calculamos nosotros, así
// siempre queda consistente con los resultados que se están mostrando)
// ---------------------------------------------------------------------------

function calcularTablaGrupo(partidosDelGrupo) {

    const equipos = {};

    function asegurarEquipo(nombre) {
        if (!equipos[nombre]) {
            equipos[nombre] = {
                nombre,
                pj: 0, g: 0, e: 0, p: 0,
                gf: 0, gc: 0, dg: 0, pts: 0
            };
        }
        return equipos[nombre];
    }

    partidosDelGrupo.forEach(partido => {
        // Solo contamos partidos que ya empezaron o terminaron, para no
        // mezclar "0-0 todavía no jugado" con un 0-0 real.
        if (partido.time_elapsed === "notstarted") {
            // Igual registramos los equipos para que aparezcan en la tabla
            // con 0 partidos jugados.
            asegurarEquipo(partido.home_team_name_en);
            asegurarEquipo(partido.away_team_name_en);
            return;
        }

        const local = asegurarEquipo(partido.home_team_name_en);
        const visitante = asegurarEquipo(partido.away_team_name_en);

        const golesLocal = parseInt(partido.home_score, 10) || 0;
        const golesVisitante = parseInt(partido.away_score, 10) || 0;

        local.pj++;
        visitante.pj++;
        local.gf += golesLocal;
        local.gc += golesVisitante;
        visitante.gf += golesVisitante;
        visitante.gc += golesLocal;

        if (golesLocal > golesVisitante) {
            local.g++; local.pts += 3;
            visitante.p++;
        } else if (golesLocal < golesVisitante) {
            visitante.g++; visitante.pts += 3;
            local.p++;
        } else {
            local.e++; local.pts += 1;
            visitante.e++; visitante.pts += 1;
        }
    });

    const tabla = Object.values(equipos).map(eq => ({
        ...eq,
        dg: eq.gf - eq.gc
    }));

    // Orden FIFA simplificado: puntos, luego diferencia de gol, luego goles a favor
    tabla.sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);

    return tabla;
}

function renderTablaGrupo(letraGrupo, tabla) {

    const filas = tabla.map((eq, indice) => `
        <tr class="${indice < 2 ? 'clasifica' : ''}">
            <td>${indice + 1}</td>
            <td class="celda-equipo">${htmlBandera(eq.nombre)} ${eq.nombre}</td>
            <td>${eq.pj}</td>
            <td>${eq.g}</td>
            <td>${eq.e}</td>
            <td>${eq.p}</td>
            <td>${eq.dg > 0 ? '+' + eq.dg : eq.dg}</td>
            <td><strong>${eq.pts}</strong></td>
        </tr>
    `).join("");

    return `
        <div class="tabla-grupo">
            <h3>Grupo ${letraGrupo}</h3>
            <table>
                <thead>
                    <tr>
                        <th>#</th><th>Equipo</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>DG</th><th>Pts</th>
                    </tr>
                </thead>
                <tbody>
                    ${filas}
                </tbody>
            </table>
        </div>
    `;
}

function renderTablas(partidosDeGrupos, gruposAMostrar) {

    if (gruposAMostrar.size === 0) {
        tablasContenedor.innerHTML = "";
        return;
    }

    const porGrupo = {};
    partidosDeGrupos.forEach(partido => {
        const g = partido.group;
        if (!porGrupo[g]) porGrupo[g] = [];
        porGrupo[g].push(partido);
    });

    const letrasOrdenadas = Array.from(gruposAMostrar).sort();

    tablasContenedor.innerHTML = letrasOrdenadas
        .filter(letra => porGrupo[letra])
        .map(letra => renderTablaGrupo(letra, calcularTablaGrupo(porGrupo[letra])))
        .join("");
}

// ---------------------------------------------------------------------------
// Tabla de mejores terceros: toma el equipo en 3er puesto de CADA uno de
// los 12 grupos (A-L) y los ordena entre sí con el mismo criterio FIFA.
// Se calcula siempre sobre los 12 grupos completos, sin importar cuáles
// se estén mostrando arriba, porque la comparación es entre todos ellos.
// ---------------------------------------------------------------------------

function calcularMejoresTerceros(partidosDeGrupos) {

    const porGrupo = {};
    partidosDeGrupos.forEach(partido => {
        const g = partido.group;
        if (!porGrupo[g]) porGrupo[g] = [];
        porGrupo[g].push(partido);
    });

    const terceros = [];

    Object.keys(porGrupo).forEach(letraGrupo => {
        const tabla = calcularTablaGrupo(porGrupo[letraGrupo]);
        if (tabla.length >= 3) {
            terceros.push({ ...tabla[2], grupo: letraGrupo });
        }
    });

    terceros.sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);

    return terceros;
}

function renderTablaMejoresTerceros(terceros) {

    if (terceros.length === 0) return "";

    const filas = terceros.map((eq, indice) => `
        <tr class="${indice < 8 ? 'clasifica' : ''}">
            <td>${indice + 1}</td>
            <td>${eq.grupo}</td>
            <td class="celda-equipo">${htmlBandera(eq.nombre)} ${eq.nombre}</td>
            <td>${eq.pj}</td>
            <td>${eq.g}</td>
            <td>${eq.e}</td>
            <td>${eq.p}</td>
            <td>${eq.dg > 0 ? '+' + eq.dg : eq.dg}</td>
            <td><strong>${eq.pts}</strong></td>
        </tr>
    `).join("");

    return `
        <div class="tabla-grupo">
            <h3>Mejores terceros (clasifican los primeros 8)</h3>
            <table>
                <thead>
                    <tr>
                        <th>#</th><th>Grupo</th><th>Equipo</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>DG</th><th>Pts</th>
                    </tr>
                </thead>
                <tbody>
                    ${filas}
                </tbody>
            </table>
        </div>
    `;
}

// ---------------------------------------------------------------------------
// Cuadro de eliminación (16avos, octavos, cuartos, semifinales)
//
// Las etiquetas como "Winner Group J", "Runner-up Group H" o
// "3rd Group A/B/C/D/F" vienen tal cual de la API. Mientras el equipo real
// no esté resuelto en el JSON (campo *_team_name_en vacío), se muestra la
// etiqueta traducida. No inventamos ni estimamos equipos: solo mostramos lo
// que la propia fuente de datos ya confirmó.
// ---------------------------------------------------------------------------

const TIPOS_BRACKET = ["r32", "r16", "qf", "sf"];

const TITULOS_RONDA = {
    r32: "16avos de Final",
    r16: "Octavos de Final",
    qf: "Cuartos de Final",
    sf: "Semifinales"
};

// Traduce las etiquetas en inglés que trae la API a español,
// conservando la estructura (letras de grupo, números de partido).
function traducirEtiqueta(etiqueta) {
    if (!etiqueta) return "Por definir";

    return etiqueta
        .replace(/^Winner Match (\d+)/, "Ganador del partido $1")
        .replace(/^Loser Match (\d+)/, "Perdedor del partido $1")
        .replace(/^Winner Group ([A-L])/, "1º Grupo $1")
        .replace(/^Runner-up Group ([A-L])/, "2º Grupo $1")
        .replace(/^(\d)(st|nd|rd|th) Group (.+)/, "$1º Grupo $3")
        .replace(/^3rd Group (.+)/, "3º Grupo $1");
}

// Dado un partido del bracket y el mapa de todos los partidos por id,
// devuelve el nombre real del equipo si ya se puede resolver, o null.
function resolverEquipoBracket(label, nombreYaConocido, partidosPorId) {
    if (nombreYaConocido) return nombreYaConocido;
    if (!label) return null;

    // Caso "Winner Match N" / "Loser Match N": miramos ese partido puntual.
    const coincidenciaGanador = label.match(/^Winner Match (\d+)/);
    const coincidenciaPerdedor = label.match(/^Loser Match (\d+)/);

    if (coincidenciaGanador) {
        const partidoOrigen = partidosPorId[coincidenciaGanador[1]];
        if (partidoOrigen && partidoOrigen.finished === "TRUE") {
            const gl = parseInt(partidoOrigen.home_score, 10) || 0;
            const gv = parseInt(partidoOrigen.away_score, 10) || 0;
            if (gl > gv) return partidoOrigen.home_team_name_en;
            if (gv > gl) return partidoOrigen.away_team_name_en;
        }
        return null;
    }

    if (coincidenciaPerdedor) {
        const partidoOrigen = partidosPorId[coincidenciaPerdedor[1]];
        if (partidoOrigen && partidoOrigen.finished === "TRUE") {
            const gl = parseInt(partidoOrigen.home_score, 10) || 0;
            const gv = parseInt(partidoOrigen.away_score, 10) || 0;
            if (gl > gv) return partidoOrigen.away_team_name_en;
            if (gv > gl) return partidoOrigen.home_team_name_en;
        }
        return null;
    }

    // Casos "Winner Group X" / "Runner-up Group X" / "3rd Group ...":
    // estos los deja sin resolver el código del bracket; se resuelven
    // aparte usando las tablas de grupo cuando el grupo ya cerró,
    // mediante resolverPorTablaDeGrupo() más abajo.
    return null;
}

// Para "Winner Group X" / "Runner-up Group X", si ese grupo ya jugó sus
// 3 fechas, devolvemos el 1º o 2º real según la tabla calculada.
function resolverPorTablaDeGrupo(label, partidosDeGrupos) {
    const ganador = label.match(/^Winner Group ([A-L])$/);
    const segundo = label.match(/^Runner-up Group ([A-L])$/);

    const letra = (ganador && ganador[1]) || (segundo && segundo[1]);
    if (!letra) return null;

    const partidosGrupo = partidosDeGrupos.filter(p => p.group === letra);
    if (partidosGrupo.length === 0) return null;

    const quedanPartidos = partidosGrupo.some(p => p.time_elapsed === "notstarted");
    if (quedanPartidos) return null;

    const tabla = calcularTablaGrupo(partidosGrupo);
    if (tabla.length < 2) return null;

    return ganador ? tabla[0].nombre : tabla[1].nombre;
}

// Para una etiqueta sin resolver, devuelve el HTML con las banderas de
// los equipos candidatos. Importante: en TODOS los casos se calcula la
// tabla actual del grupo (con los resultados que haya hasta el momento,
// terminados o en vivo) y se excluye a cualquier equipo que ya tenga
// asegurado matemáticamente un puesto distinto al que se evalúa. Así, un
// equipo que ya ganó su grupo en forma irreversible (como Argentina en el
// Grupo J) nunca puede aparecer como candidato a 3er puesto de ese mismo
// grupo, ni un eliminado matemático aparecer como candidato a clasificar.
//
// - "1º/2º Grupo G"      -> candidatos: equipos del grupo que matemática-
//                           mente todavía pueden alcanzar ese puesto.
// - "3º Grupo A/E/H/I/J" -> por cada grupo de la lista: si ya está claro
//                           quién es el 3ro de ESE grupo, se muestra solo
//                           ese equipo. Si no, se muestran los candidatos
//                           que todavía pueden terminar en esa posición.
function htmlBanderasCandidatas(label, partidosDeGrupos) {
    if (!label) return "";

    const unGrupo = label.match(/^(?:Winner|Runner-up) Group ([A-L])$/);
    if (unGrupo) {
        const candidatos = candidatosAPosicion(unGrupo[1], partidosDeGrupos, unGrupo[0].startsWith("Winner") ? 0 : 1);
        if (candidatos.length === 0) return "";
        return `<div class="candidatos">${candidatos.map(htmlBandera).join("")}</div>`;
    }

    const variosGrupos = label.match(/^3rd Group ([A-L](?:\/[A-L])*)$/);
    if (variosGrupos) {
        const letras = variosGrupos[1].split("/");
        const bloques = letras.map(letra => {
            const candidatos = candidatosAPosicion(letra, partidosDeGrupos, 2);
            return `<span class="candidatos-subgrupo">${candidatos.map(htmlBandera).join("")}</span>`;
        });
        return `<div class="candidatos">${bloques.join('<span class="separador-candidatos">/</span>')}</div>`;
    }

    return "";
}

// Cuántos partidos le quedan a un equipo dentro de su grupo (cuenta los
// partidos "notstarted" en los que participa).
function partidosRestantes(nombreEquipo, partidosGrupo) {
    return partidosGrupo.filter(p =>
        p.time_elapsed === "notstarted" &&
        (p.home_team_name_en === nombreEquipo || p.away_team_name_en === nombreEquipo)
    ).length;
}

// Devuelve los equipos del grupo que todavía pueden matemáticamente
// terminar en la posición de tabla "indicePosicion" (0=1º, 1=2º, 2=3º).
//
// Se calcula, para cada equipo, su rango de puntos posible al cierre del
// grupo: mínimo (si pierde todo lo que le queda) y máximo (si gana todo
// lo que le queda, suma 3 por partido restante). Un equipo es candidato
// a la posición X si existe al menos una combinación de resultados
// donde su puntaje final podría dejarlo en ese lugar de la tabla — en
// concreto, se descarta cuando su máximo posible es estrictamente menor
// al mínimo asegurado por suficientes rivales como para sacarlo de esa
// posición (o, simétricamente, cuando su mínimo asegurado ya lo deja por
// encima de esa posición sin que nadie pueda alcanzarlo).
//
// Este cálculo no usa diferencia de gol como criterio de desempate (sería
// necesario simular resultados exactos), así que es deliberadamente
// conservador: ante la duda, incluye al equipo como candidato en vez de
// excluirlo. Lo que sí garantiza con certeza es no excluir nunca a un
// candidato real, y sí excluir a quien esté matemáticamente imposibilitado
// de ocupar esa posición (como un líder que ya no puede ser tercero).
function candidatosAPosicion(letra, partidosDeGrupos, indicePosicion) {
    const partidosGrupo = partidosDeGrupos.filter(p => p.group === letra);
    if (partidosGrupo.length === 0) return [];

    const tabla = calcularTablaGrupo(partidosGrupo);
    if (tabla.length <= indicePosicion) return [];

    const quedanPartidos = partidosGrupo.some(p => p.time_elapsed === "notstarted");

    if (!quedanPartidos) {
        // Grupo completo: la tabla ya es definitiva. Único candidato real.
        return [tabla[indicePosicion].nombre];
    }

    // Puntos mínimos y máximos posibles de cada equipo al cierre del grupo.
    const rangos = tabla.map(eq => {
        const restantes = partidosRestantes(eq.nombre, partidosGrupo);
        return {
            nombre: eq.nombre,
            ptsMin: eq.pts,                  // si pierde todo lo que le queda
            ptsMax: eq.pts + (restantes * 3) // si gana todo lo que le queda
        };
    });

    return rangos
        .filter(equipo => {
            // ¿Cuántos rivales pueden, en el mejor de los casos, terminar
            // con MÁS puntos que el máximo posible de este equipo?
            const rivalesQuePuedenSuperarlo = rangos.filter(otro =>
                otro.nombre !== equipo.nombre && otro.ptsMax > equipo.ptsMin
            ).length;

            // Si el equipo llega a su máximo y aun así puede haber al menos
            // "indicePosicion" rivales por encima o igualados a él, sigue
            // siendo candidato a esa posición. Para mantenerlo conservador,
            // basta con comprobar que no esté matemáticamente descartado:
            // un equipo está descartado de la posición X si más de X
            // rivales tienen garantizado (con su propio mínimo) más puntos
            // que el máximo que este equipo puede alcanzar.
            const rivalesQueYaLoSuperanSeguro = rangos.filter(otro =>
                otro.nombre !== equipo.nombre && otro.ptsMin > equipo.ptsMax
            ).length;

            if (rivalesQueYaLoSuperanSeguro > indicePosicion) return false;

            // Simétricamente: el equipo está descartado de la posición X
            // si, incluso en su peor escenario (ptsMin), siguen sin existir
            // suficientes rivales que puedan alcanzarlo o superarlo como
            // para empujarlo hasta esa posición (es decir, su mínimo ya lo
            // deja en una posición mejor que X, sin que nadie pueda
            // alcanzarlo ni con su propio máximo).
            const rivalesQuePuedenIgualarOSuperarSuMinimo = rangos.filter(otro =>
                otro.nombre !== equipo.nombre && otro.ptsMax >= equipo.ptsMin
            ).length;

            if (rivalesQuePuedenIgualarOSuperarSuMinimo < indicePosicion) return false;

            return true;
        })
        .map(equipo => equipo.nombre);
}

function renderCasillaBracket(equipoTexto, esReal, banderasCandidatas) {
    const clase = esReal ? "equipo-bracket resuelto" : "equipo-bracket pendiente";
    const bandera = esReal ? htmlBandera(equipoTexto) : "";
    const candidatos = esReal ? "" : (banderasCandidatas || "");
    return `
        <div class="${clase}">
            <div class="equipo-bracket-fila">${bandera}<span>${equipoTexto}</span></div>
            ${candidatos}
        </div>
    `;
}

function renderPartidoBracket(partido, partidosDeGrupos, partidosPorId) {

    let nombreLocal = resolverEquipoBracket(
        partido.home_team_label, partido.home_team_name_en, partidosPorId
    );
    let nombreVisitante = resolverEquipoBracket(
        partido.away_team_label, partido.away_team_name_en, partidosPorId
    );

    if (!nombreLocal && partido.home_team_label) {
        nombreLocal = resolverPorTablaDeGrupo(partido.home_team_label, partidosDeGrupos);
    }
    if (!nombreVisitante && partido.away_team_label) {
        nombreVisitante = resolverPorTablaDeGrupo(partido.away_team_label, partidosDeGrupos);
    }

    const textoLocal = nombreLocal || traducirEtiqueta(partido.home_team_label);
    const textoVisitante = nombreVisitante || traducirEtiqueta(partido.away_team_label);

    const banderasLocal = nombreLocal ? "" : htmlBanderasCandidatas(partido.home_team_label, partidosDeGrupos);
    const banderasVisitante = nombreVisitante ? "" : htmlBanderasCandidatas(partido.away_team_label, partidosDeGrupos);

    return `
        <div class="partido-bracket">
            ${renderCasillaBracket(textoLocal, Boolean(nombreLocal), banderasLocal)}
            ${renderCasillaBracket(textoVisitante, Boolean(nombreVisitante), banderasVisitante)}
        </div>
    `;
}

function renderBracket(todosLosPartidos, partidosDeGrupos) {

    const partidosPorId = {};
    todosLosPartidos.forEach(p => { partidosPorId[p.id] = p; });

    const columnas = TIPOS_BRACKET.map(tipo => {
        const partidosRonda = todosLosPartidos
            .filter(p => p.type === tipo)
            .sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10));

        if (partidosRonda.length === 0) return "";

        const tarjetas = partidosRonda
            .map(p => renderPartidoBracket(p, partidosDeGrupos, partidosPorId))
            .join("");

        return `
            <div class="columna-bracket">
                <h3>${TITULOS_RONDA[tipo]}</h3>
                ${tarjetas}
            </div>
        `;
    }).join("");

    bracketContenedor.innerHTML = `<div class="bracket">${columnas}</div>`;
}

// ---------------------------------------------------------------------------
// Ciclo principal
// ---------------------------------------------------------------------------

function mostrarError(mensaje) {
    contenedor.innerHTML = `<p class="mensaje error">⚠️ ${mensaje}</p>`;
}

async function cargarPartidos() {
    try {
        const todos = await obtenerPartidos();

        const partidosDeGrupos = todos.filter(esPartidoDeGrupos);
        const enVivo = partidosDeGrupos.filter(esPartidoEnVivo);

        renderPartidosEnVivo(enVivo);

        // Mostramos la tabla de los grupos que tienen partidos en vivo.
        // Si no hay ninguno en vivo, mostramos las tablas de los grupos
        // con partidos en la última fecha jugada/por jugar, para tener
        // panorama igual.
        let gruposAMostrar = new Set(enVivo.map(p => p.group));

        if (gruposAMostrar.size === 0) {
            const ultimaFecha = Math.max(
                ...partidosDeGrupos.map(p => parseInt(p.matchday, 10) || 0)
            );
            partidosDeGrupos
                .filter(p => parseInt(p.matchday, 10) === ultimaFecha)
                .forEach(p => gruposAMostrar.add(p.group));
        }

        renderTablas(partidosDeGrupos, gruposAMostrar);

        // La tabla de mejores terceros se calcula sobre los 12 grupos
        // completos y se agrega siempre al final, debajo de las demás.
        const mejoresTerceros = calcularMejoresTerceros(partidosDeGrupos);
        tablasContenedor.innerHTML += renderTablaMejoresTerceros(mejoresTerceros);

        renderBracket(todos, partidosDeGrupos);

        actualizacion.textContent =
            "Última actualización: " + new Date().toLocaleTimeString();

    } catch (error) {
        console.error("Error cargando partidos:", error);
        mostrarError("No se pudieron cargar los resultados. Reintentando en 30s...");
        actualizacion.textContent =
            "Última actualización: " + new Date().toLocaleTimeString() + " (con error)";
    }
}

cargarPartidos();

setInterval(cargarPartidos, 30000);
