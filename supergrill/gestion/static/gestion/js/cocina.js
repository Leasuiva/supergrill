/* ========================================================================== */
/* COCINA.JS - LÓGICA EXCLUSIVA PARA EL MONITOR DEL TELEVISOR Y CELULAR       */
/* ========================================================================== */

// --- DESACTIVAR SELECCIÓN DE TEXTO Y MENÚ DE COPIAR/CORTAR/PEGAR EN TODA LA PÁGINA ---
// (excepto en inputs/textarea, para poder seguir editando el número del modal)
(function() {
    const estilo = document.createElement('style');
    estilo.textContent = `
        * {
            -webkit-user-select: none;
            -moz-user-select: none;
            user-select: none;
            -webkit-touch-callout: none;
            -webkit-tap-highlight-color: transparent;
            touch-action: manipulation;
        }
        input, textarea {
            -webkit-user-select: text;
            -moz-user-select: text;
            user-select: text;
            -webkit-touch-callout: default;
        }
    `;
    document.head.appendChild(estilo);

    document.addEventListener('contextmenu', (e) => {
        const esCampoDeTexto = e.target.closest('input, textarea');
        if (!esCampoDeTexto) e.preventDefault();
    });
})();

// --- BLOQUEAR ZOOM POR DOBLE TOQUE (Exclusivo para iOS Safari) ---
let ultimoToque = 0;

document.addEventListener('touchend', function (e) {
    const tiempoActual = new Date().getTime();
    const tiempoTranscurrido = tiempoActual - ultimoToque;
    
    // Si el tiempo entre este toque y el anterior es menor a 300ms, es un "doble click"
    if (tiempoTranscurrido > 0 && tiempoTranscurrido <= 300) {
        // Excluimos los inputs para no bloquear el teclado en el modal de cantidades
        if (!e.target.closest('input, textarea')) {
            e.preventDefault(); // Detiene el zoom de Safari
            e.target.click();   // Mantiene la funcionalidad del clic simple por las dudas
        }
    }
    
    ultimoToque = tiempoActual;
}, { passive: false }); // Es OBLIGATORIO false para que el preventDefault() funcione

// --- BLOQUEAR ZOOM POR GESTO (evento propio de WebKit, canal aparte de touchend) ---
// gesturestart es el evento que WebKit dispara para pellizco/"smart zoom".
// No siempre pasa por touchstart/touchend, así que hay que frenarlo aparte.
document.addEventListener('gesturestart', function (e) {
    e.preventDefault();
});
document.addEventListener('gesturechange', function (e) {
    e.preventDefault();
});

// -------------------------------------------------

let versionActual = 0;

// --- MEMORIA DE PLATOS COCINADOS (Por Día) ---
function normalizarClave(texto) {
    // Evita que pequeñas diferencias (espacios de más, mayúsculas/minúsculas,
    // acentos con distinta codificación) generen una clave distinta y "pierdan"
    // el contador guardado.
    return (texto || "")
        .normalize('NFC')
        .trim()
        .replace(/\s+/g, ' ')
        .toUpperCase();
}

function obtenerKeyHechos(categoria, plato) {
    const hoy = new Date().toISOString().split('T')[0];
    return `hechos_${hoy}_${normalizarClave(categoria)}_${normalizarClave(plato)}`;
}

function obtenerPlatosHechos(categoria, plato) {
    return parseInt(localStorage.getItem(obtenerKeyHechos(categoria, plato))) || 0;
}

function sumarPlatosHechos(categoria, plato, cantidad) {
    const actual = obtenerPlatosHechos(categoria, plato);
    const nuevo = actual + cantidad;
    if (nuevo <= 0) {
        localStorage.removeItem(obtenerKeyHechos(categoria, plato)); // Nunca queda negativo: se resetea a 0
    } else {
        localStorage.setItem(obtenerKeyHechos(categoria, plato), nuevo);
    }
}
// -------------------------------------------------

// 1. RELOJ EN TIEMPO REAL
setInterval(() => {
    const reloj = document.getElementById('reloj');
    if (reloj) reloj.innerText = new Date().toLocaleTimeString();
}, 1000);

// 2. AJUSTE DINÁMICO DE PANTALLA (Zoom automático)
function ajustarLetra() {
    if (window.innerWidth <= 700) return; 
    const contenedor = document.getElementById("contenedor");
    if (!contenedor) return;

    const alturaDisponible = window.innerHeight - contenedor.getBoundingClientRect().top - 15; 
    contenedor.style.maxHeight = alturaDisponible + "px";
    contenedor.style.overflow = "hidden"; 

    let size = 28;
    document.documentElement.style.fontSize = size + "px";
    void contenedor.offsetHeight; 

    let loop = 0;
    while ((contenedor.scrollHeight > contenedor.clientHeight || contenedor.scrollWidth > contenedor.clientWidth) && size > 8 && loop < 15) {
        size = size * 0.9; 
        document.documentElement.style.fontSize = size + "px";
        void contenedor.offsetHeight; 
        loop++;
    }
}

/* // 3. FESTEJO DE 300 PLATOS
function verificarMeta300(totalPlatos) {
    const fechaHoy = new Date().toLocaleDateString('es-AR');
    const yaFestejamos = localStorage.getItem("festejo_300_" + fechaHoy);

    if (totalPlatos >= 500 && !yaFestejamos) {
        localStorage.setItem("festejo_300_" + fechaHoy, "true");
        dispararVideoCelebracion();
    }
}

function dispararVideoCelebracion() {
    if (document.getElementById("overlayFestejo")) return;

    const overlay = document.createElement("div");
    overlay.id = "overlayFestejo";
    overlay.style.cssText = "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); z-index: 9999; display: flex; justify-content: center; align-items: center;";

    const video = document.createElement("video");
    video.src = "/static/gestion/festejo300.mp4";
    video.style.cssText = "max-width: 95%; max-height: 95%; mix-blend-mode: screen; pointer-events: none;";
    video.controls = false;
    
    video.muted = true; 
    video.playsInline = true; 
    video.setAttribute("playsinline", ""); 
    video.setAttribute("webkit-playsinline", ""); 

    video.onended = () => overlay.remove();
    overlay.appendChild(video);
    document.body.appendChild(overlay);

    let promesaReproduccion = video.play();
    if (promesaReproduccion !== undefined) {
        promesaReproduccion.catch(() => {
            console.warn("Audio bloqueado por el navegador. Reproduciendo animación en silencio.");
            video.muted = true;
            video.play();
        });
    }
} */

// 4. OBTENER DATOS Y DIBUJAR TARJETAS
async function cargarDatos() {
    try {
        const dataP = await apiFetch(`/pedidos?t=${Date.now()}`);
        const dataC = await apiFetch(`/api/pedidos_cargados_data?t=${Date.now()}`);
        
        const todos = [...dataP, ...dataC.filter(p => (p[11] || "").toLowerCase() !== 'eliminado')];
        
        const conteoTipos = {};
        const conteoGuarnicion = {};
        let totalPlatosDelDia = 0; 
        let totalPedidosYa = 0; 

        todos.forEach(p => {
            const direccion = p[1]?.trim() || "";
            const cadete = p[8]?.trim() || "";
            const menu = p[4]?.trim();
            const guarnicion = p[5]?.trim();
            const cantidad = parseInt(p[7]) || 1;
            let tipo = p[13]?.trim() || "OTROS";

            const esPedidosYa = (direccion.toUpperCase() === "PEDIDOSYA" || cadete.toUpperCase() === "PEDIDOSYA");

            if (menu && menu !== "-" && menu !== "0") {
                totalPlatosDelDia += cantidad; 
                if (esPedidosYa) totalPedidosYa += cantidad; 

                if (!conteoTipos[tipo]) conteoTipos[tipo] = {};
                conteoTipos[tipo][menu] = (conteoTipos[tipo][menu] || 0) + cantidad;
            }
            if (guarnicion && guarnicion !== "-" && guarnicion !== "0") {
                conteoGuarnicion[guarnicion] = (conteoGuarnicion[guarnicion] || 0) + cantidad;
            }
        });
        
        dibujar(conteoTipos, conteoGuarnicion);
        
        const divTotalesCelu = document.getElementById("totales-celular");
        if (divTotalesCelu) {
            let htmlTotales = `<div style="display:flex; align-items:center;">TOTAL: <span class="badge-total-celu">${totalPlatosDelDia}</span></div>`;
            
            if (totalPedidosYa > 0) {
                htmlTotales += `<div class="pedidos-ya-celu">🛵 Incluye ${totalPedidosYa} de PedidosYa</div>`;
            }
            
            divTotalesCelu.innerHTML = htmlTotales;
        }

        // verificarMeta300(totalPlatosDelDia);
    } catch (e) { console.error("Error al cargar datos del monitor:", e); }
}

function dibujar(tipos, guarniciones) {
    const contenedor = document.getElementById("contenedor");
    if (!contenedor) return; 

    const esCelular = window.innerWidth <= 1024;

    const estadoAcordeones = {};
    if (esCelular) {
        document.querySelectorAll('.bloque').forEach(b => {
            const titulo = b.querySelector('.bloque-header span:first-child')?.innerText.trim();
            const lista = b.querySelector('.lista');
            if (titulo && lista && !lista.classList.contains('lista-oculta')) {
                estadoAcordeones[normalizarClave(titulo)] = true;
            }
        });
    }

    contenedor.innerHTML = "";
    const tarjetas = [];
    let totalLineas = 0;

    const crearBloqueElemento = (titulo, datos, esG) => {
        const div = document.createElement("div");
        div.className = "bloque";
        
        let html = `<div class="bloque-header ${esG ? 'guarnicion' : ''}">
                        <span>${titulo}</span>
                        <span class="icono-desplegable">▼</span>
                    </div>
                    <ul class="lista">`;
                    
        const nombres = Object.keys(datos).sort();
        nombres.forEach(n => { 
            const total = datos[n];
            
            if (esCelular) {
                const totalSeguro = Math.max(0, total);
                const hechos = Math.max(0, obtenerPlatosHechos(titulo, n));
                const diferencia = hechos - totalSeguro; // positivo = sobran, negativo = faltan
                const faltan = diferencia < 0 ? -diferencia : 0;
                const sobran = diferencia > 0 ? diferencia : 0;

                let extra = "";
                if (faltan > 0) {
                    extra += ` | <span style="color: #dc3545;">Faltan: <b>${faltan}</b></span>`;
                }
                if (sobran > 0) {
                    extra += ` | <span style="color: #f97316;">Sobran: <b>${sobran}</b></span>`;
                }
                
                html += `
                <li class="item-plato celular-item" style="user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; cursor: pointer; width: 100%; box-sizing: border-box;">
                    <div style="display:flex; flex-direction:column; width: 100%;">
                        <span class="nombre-plato" style="font-size: 1.1em;">${n}</span>
                        <div style="font-size: 0.75em; margin-top: 4px;">
                            <span style="color: #eab308;">Total: <b>${totalSeguro}</b></span> | <span style="color: #07b647;">Hechos: <b>${hechos}</b></span>${extra}
                        </div>
                    </div>
                </li>`;
            } else {
                html += `
                <li class="item-plato tv-item" style="display: flex; justify-content: space-between; align-items: center; width: 100%; box-sizing: border-box; cursor: default;">
                    <span class="nombre-plato">${n}</span>
                    <span class="badge">${total}</span>
                </li>`;
            }
        });
        div.innerHTML = html + "</ul>";

        if (esCelular) {
            const header = div.querySelector('.bloque-header');
            const lista = div.querySelector('.lista');
            const icono = div.querySelector('.icono-desplegable');

            if (!estadoAcordeones[normalizarClave(titulo)]) {
                lista.classList.add('lista-oculta');
            } else {
                icono.classList.add('rotado');
            }

            header.addEventListener('click', () => {
                lista.classList.toggle('lista-oculta');
                icono.classList.toggle('rotado');
            });
        }

        const lineas = nombres.length + 2;
        totalLineas += lineas;
        return { elemento: div, cantidadItems: lineas };
    };

    if (esCelular && Object.keys(guarniciones).length > 0) {
        tarjetas.push(crearBloqueElemento("GUARNICIONES", guarniciones, true));
    }

    Object.keys(tipos).sort().forEach(t => tarjetas.push(crearBloqueElemento(t, tipos[t], false)));

    if (!esCelular && Object.keys(guarniciones).length > 0) {
        tarjetas.push(crearBloqueElemento("GUARNICIONES", guarniciones, true));
    }

    const maxColumnasPermitidas = Math.max(1, Math.floor(window.innerWidth / 300));
    const MAX_FILAS_COLUMNA = Math.max(12, Math.ceil(totalLineas / maxColumnasPermitidas));

    const columnasFinales = [];
    let columnaActual = [];
    let filasEnColumnaActual = 0;

    tarjetas.forEach(tarjeta => {
        if (columnaActual.length > 0 && (filasEnColumnaActual + tarjeta.cantidadItems > MAX_FILAS_COLUMNA)) {
            columnasFinales.push(columnaActual);
            columnaActual = [tarjeta];
            filasEnColumnaActual = tarjeta.cantidadItems;
        } else {
            columnaActual.push(tarjeta);
            filasEnColumnaActual += tarjeta.cantidadItems;
        }
    });

    if (columnaActual.length > 0) columnasFinales.push(columnaActual);

    contenedor.style.display = "flex";
    contenedor.style.flexWrap = "nowrap"; 
    contenedor.style.justifyContent = "center";
    contenedor.style.gap = "10px";
    contenedor.style.width = "100vw"; 
    contenedor.style.boxSizing = "border-box";
    contenedor.style.overflow = "hidden"; 

    const porcentajeAncho = (100 / columnasFinales.length) - 1; 

    columnasFinales.forEach(grupo => {
        const colDiv = document.createElement("div");
        colDiv.className = "columna";
        colDiv.style.flex = "1 1 0"; 
        colDiv.style.minWidth = "0"; 
        colDiv.style.maxWidth = `${porcentajeAncho}%`; 
        
        grupo.forEach(tarjeta => { colDiv.appendChild(tarjeta.elemento); });
        contenedor.appendChild(colDiv);
    });

    ajustarLetra();
}

// 5. ESCUCHA DE CAMBIOS DESDE EL SERVIDOR (Polling)
async function vigilarCambios() {
    try {
        const data = await apiFetch('/api/estado_monitor');
        if (data.version !== versionActual) {
            versionActual = data.version;
            cargarDatos(); 
        }
    } catch (e) { console.error("Error vigilando servidor:", e); }
}

if (document.getElementById("contenedor")) {
    setInterval(vigilarCambios, 2000);
    vigilarCambios(); 
}

// --- BOTÓN REFRESCAR CELULAR (ILUMINA SOLO LOS CAMBIOS) ---
const botonRefrescar = document.getElementById('boton-refrescar');

if (botonRefrescar) {
    botonRefrescar.addEventListener('click', async function() {
        const valoresViejos = obtenerCantidadesActuales();
        await cargarDatos(); 
        resaltarCambios(valoresViejos);
    });
}

function obtenerCantidadesActuales() {
    const estado = {};
    document.querySelectorAll('.lista li').forEach(li => {
        const categoria = li.closest('.bloque').querySelector('.bloque-header span:first-child').innerText.trim();
        const nombrePlato = li.querySelector('.nombre-plato').innerText.trim();
        
        const badgeTV = li.querySelector('.badge');
        let cantidad = 0;
        
        if (badgeTV) {
            cantidad = parseInt(badgeTV.innerText.trim());
        } else {
            const textoProgreso = li.innerText;
            const matchTotal = textoProgreso.match(/Total:\s*(\d+)/);
            if(matchTotal) cantidad = parseInt(matchTotal[1]);
        }
        
        estado[`${categoria}-${nombrePlato}`] = cantidad;
    });

    const badgeTotal = document.querySelector('.badge-total-celu');
    if (badgeTotal) estado['TOTAL'] = parseInt(badgeTotal.innerText.trim());
    return estado;
}

function resaltarCambios(valoresViejos) {
    const esCelular = window.innerWidth <= 1024;

    document.querySelectorAll('.lista li').forEach(li => {
        const categoria = li.closest('.bloque').querySelector('.bloque-header span:first-child').innerText.trim();
        const nombrePlato = li.querySelector('.nombre-plato').innerText.trim();
        
        let cantidadNueva = 0;
        const badgeTV = li.querySelector('.badge');
        if (badgeTV) {
            cantidadNueva = parseInt(badgeTV.innerText.trim());
        } else {
            const textoProgreso = li.innerText;
            const matchTotal = textoProgreso.match(/Total:\s*(\d+)/);
            if(matchTotal) cantidadNueva = parseInt(matchTotal[1]);
        }
        
        const clave = `${categoria}-${nombrePlato}`;
        if (valoresViejos[clave] !== cantidadNueva) {
            aplicarDestello(esCelular ? li : badgeTV);
        }
    });

    const badgeTotal = document.querySelector('.badge-total-celu');
    if (badgeTotal) {
        if (valoresViejos['TOTAL'] !== parseInt(badgeTotal.innerText.trim())) {
            aplicarDestello(badgeTotal);
        }
    }
}

function aplicarDestello(elemento) {
    elemento.classList.add('badge-actualizado');
    setTimeout(() => {
        elemento.classList.remove('badge-actualizado');
    }, 1500); 
}

// --- MODAL PARA CARGAR CANTIDAD DE PLATOS HECHOS (contador editable +/-) ---
function crearModalCantidadSiNoExiste() {
    if (document.getElementById("modalCantidadOverlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "modalCantidadOverlay";
    // touch-action: none mata cualquier gesto en el contenedor
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0,0,0,0.6); z-index: 999999;
        display: none; justify-content: center; align-items: center;
        padding: 20px; box-sizing: border-box; touch-action: none;
    `;

    overlay.innerHTML = `
        <div id="modalCantidadCaja" style="
            background: #18181b; border: 1px solid #27272a; border-radius: 14px; padding: 24px 20px;
            width: 100%; max-width: 340px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            text-align: center; font-family: inherit; color: #f4f4f5; touch-action: none;
        ">
            <div id="modalCantidadTitulo" style="font-size: 1.15em; font-weight: bold; margin-bottom: 4px;"></div>

            <div style="display:flex; align-items:center; justify-content:center; gap: 12px; margin-bottom: 20px;">
                <button id="modalCantidadMenos" style="
                    width: 52px; height: 52px; border: none; border-radius: 10px;
                    background: #27272a; color: #fff; font-size: 1.6em; font-weight: bold;
                    cursor: pointer; line-height: 1; -webkit-user-select:none; user-select:none;
                    touch-action: none;">−</button>

                <input id="modalCantidadInput" type="number" inputmode="numeric"
                    style="width: 90px; box-sizing: border-box; font-size: 22px; font-weight: bold; text-align: center;
                           padding: 8px 4px; border: 2px solid #3f3f46; border-radius: 10px; background:#0a0a0c; color:#fff;
                           touch-action: manipulation;">

                <button id="modalCantidadMas" style="
                    width: 52px; height: 52px; border: none; border-radius: 10px;
                    background: #07b647; color: #000; font-size: 1.6em; font-weight: bold;
                    cursor: pointer; line-height: 1; -webkit-user-select:none; user-select:none;
                    touch-action: none;">+</button>
            </div>

            <div style="display: flex; gap: 10px;">
                <button id="modalCantidadCancelar" style="
                    flex: 1; padding: 12px; border: none; border-radius: 8px;
                    background: #27272a; color: #f4f4f5; font-size: 1em; cursor: pointer; touch-action: none;">Cancelar</button>
                <button id="modalCantidadGuardar" style="
                    flex: 1; padding: 12px; border: none; border-radius: 8px;
                    background: #07b647; color: #000; font-size: 1em; font-weight: bold; cursor: pointer; touch-action: none;">Guardar</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const input = document.getElementById("modalCantidadInput");
    const leerValor = () => parseInt(input.value) || 0;
    const escribirValor = (v) => { input.value = v; };

    function guardarYcerrar() {
        const cantidad = leerValor();
        const datos = overlay._datosActuales || {};
        if (datos.categoria && datos.plato) {
            sumarPlatosHechos(datos.categoria, datos.plato, cantidad);
            cargarDatos();
        }
        cerrarModalCantidad();
    }

    // --- PROTECCIÓN TÁCTIL ABSOLUTA ---
    function blindarBoton(id, accion) {
        const btn = document.getElementById(id);
        
        // Dispara la acción al instante en que el dedo toca la pantalla y mata el evento
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault(); 
            e.stopPropagation();
            accion();
        }, { passive: false });
        
        // Fallback por si la pantalla no es táctil (PC con Mouse)
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            accion();
        });
    }

    blindarBoton('modalCantidadMas', () => escribirValor(leerValor() + 1));
    blindarBoton('modalCantidadMenos', () => escribirValor(leerValor() - 1));
    blindarBoton('modalCantidadGuardar', guardarYcerrar);
    blindarBoton('modalCantidadCancelar', cerrarModalCantidad);

    // Cerrar al tocar fondo negro (bloqueando también el zoom)
    overlay.addEventListener('touchstart', (e) => {
        if (e.target === overlay && overlay._listoParaCerrar) {
            e.preventDefault();
            cerrarModalCantidad();
        }
    }, { passive: false });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay && overlay._listoParaCerrar) cerrarModalCantidad();
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === "Enter") guardarYcerrar();
    });
}

function abrirModalCantidad(categoria, plato) {
    crearModalCantidadSiNoExiste();
    const overlay = document.getElementById("modalCantidadOverlay");
    overlay._datosActuales = { categoria, plato };
    overlay._listoParaCerrar = false;

    document.getElementById("modalCantidadTitulo").innerText = `Menú: ${plato}`;
    const input = document.getElementById("modalCantidadInput");
    input.value = 0;

    overlay.style.display = "flex";
    setTimeout(() => { overlay._listoParaCerrar = true; }, 400);
    setTimeout(() => { input.focus(); input.select(); }, 50);
}

function cerrarModalCantidad() {
    const overlay = document.getElementById("modalCantidadOverlay");
    if (overlay) overlay.style.display = "none";
}
// -------------------------------------------------

// --- LÓGICA DE PULSACIÓN LARGA A PRUEBA DE ANDROID/IOS ---
let temporizadorPresion;
let elementoPresionado = null;
let inicioTouchX = 0;
let inicioTouchY = 0;

document.addEventListener("DOMContentLoaded", () => {
    const contenedor = document.getElementById("contenedor");
    if(!contenedor) return;

    const limpiarEfecto = () => {
        if (elementoPresionado) {
            elementoPresionado.classList.remove('fila-presionada'); 
            elementoPresionado = null;
        }
        clearTimeout(temporizadorPresion);
    };

    contenedor.addEventListener('touchstart', (e) => {
        if (window.innerWidth > 1024) return; 
        
        const li = e.target.closest('.item-plato');
        if (!li || li.classList.contains('tv-item')) return;
        
        inicioTouchX = e.touches[0].clientX;
        inicioTouchY = e.touches[0].clientY;
        
        elementoPresionado = li;
        elementoPresionado.classList.add('fila-presionada');

        const bloqueHeader = li.closest('.bloque').querySelector('.bloque-header span:first-child');
        if (!bloqueHeader) return;
        
        const categoria = bloqueHeader.innerText.trim();
        const plato = li.querySelector('.nombre-plato').innerText.trim();

        temporizadorPresion = setTimeout(() => {
            limpiarEfecto();
            
            if (navigator.vibrate) navigator.vibrate(50);
            
            setTimeout(() => {
                abrirModalCantidad(categoria, plato);
            }, 50);
        }, 450); 
    }, {passive: true});

    contenedor.addEventListener('touchmove', (e) => {
        if (!elementoPresionado) return;
        let movX = Math.abs(e.touches[0].clientX - inicioTouchX);
        let movY = Math.abs(e.touches[0].clientY - inicioTouchY);
        
        if (movX > 10 || movY > 10) {
            limpiarEfecto();
        }
    }, {passive: true});

    contenedor.addEventListener('touchend', limpiarEfecto);
    contenedor.addEventListener('touchcancel', limpiarEfecto);
    
    contenedor.addEventListener('contextmenu', (e) => {
        if(e.target.closest('.item-plato') && window.innerWidth <= 1024) {
            e.preventDefault();
        }
    });
});