/* ========================================================================== */
/* PEDIDOS_CARGADOS.JS - LÓGICA EXCLUSIVA PARA DIBUJAR LA TABLA HISTORIAL     */
/* ========================================================================== */

document.addEventListener("DOMContentLoaded", function () {
    const tablaCargados = document.getElementById("tablaCargados");
    
    if (tablaCargados) {
        cargarTablaCargados(); // Carga inicial

        // Auto-actualización (si no se está escribiendo en el filtro)
        setInterval(async () => {
            const inputFiltro = document.getElementById("filtroCargados");
            if (!inputFiltro || inputFiltro.value === "") {
                await cargarTablaCargados();
            }
        }, 350000); 

        // Botón Refrescar Historial
        const btnRefrescar = document.getElementById("btnRefrescarCargados");
        if (btnRefrescar) {
            btnRefrescar.addEventListener("click", () => {
                const inputFiltro = document.getElementById("filtroCargados");
                if(inputFiltro) inputFiltro.value = "";
                cargarTablaCargados();
            });
        }
    }
});

async function cargarTablaCargados() {
    if (!document.getElementById("estilo-ojos")) {
        const style = document.createElement('style');
        style.id = "estilo-ojos";
        style.innerHTML = `
        .btn-ojo-animado { background: transparent; border: none; font-size: 16px; cursor: pointer; margin: 0 4px; transition: all 0.2s ease; display: inline-block; }
        .btn-ojo-animado:hover { transform: scale(1.4); filter: drop-shadow(0px 2px 3px rgba(0,0,0,0.3)); }
        .btn-ojo-animado:active { transform: scale(0.9); }
        .btn-restaurar { background: transparent; border: none; font-size: 16px; cursor: pointer; margin: 0 4px; transition: all 0.2s ease; display: inline-block; }
        .btn-restaurar:hover { transform: scale(1.3) rotate(-15deg); filter: drop-shadow(0px 2px 3px rgba(0,0,0,0.3)); }
        `;
        document.head.appendChild(style);
    }

    try {
        const listaCompleta = await apiFetch("/api/pedidos_cargados_data"); 
        const inputFiltro = document.getElementById("filtroCargados");

        if (inputFiltro && !document.getElementById("chkMostrarOcultos")) {
            const contenedorFiltro = inputFiltro.parentElement;
            contenedorFiltro.style.display = "flex";
            contenedorFiltro.style.alignItems = "center";
            const divOcultos = document.createElement("div");
            divOcultos.style.display = "inline-flex"; divOcultos.style.alignItems = "center"; divOcultos.style.gap = "8px"; divOcultos.style.marginLeft = "15px";
            
            const estadoGuardado = localStorage.getItem("estado_chk_ocultos") === "true";
            
            divOcultos.innerHTML = `<input type="checkbox" id="chkMostrarOcultos" onchange="localStorage.setItem('estado_chk_ocultos', this.checked); cargarTablaCargados();" ${estadoGuardado ? 'checked' : ''} style="cursor:pointer; width:18px; height:18px; accent-color:#042505; margin:0;"><label for="chkMostrarOcultos" style="cursor:pointer; font-weight:bold; color:#333; margin:0; user-select:none; display: flex; align-items: center; white-space: nowrap;">Mostrar ocultos <span id="contadorOcultos" style="color:#ea044e; font-size:15px; margin-left:5px;"></span></label>`;
            contenedorFiltro.appendChild(divOcultos);
        }

        const idsEditadosFijos = new Set(JSON.parse(localStorage.getItem("ids_azul_fijo") || "[]"));
        const flagsMemoria = JSON.parse(localStorage.getItem("flags_edicion") || "{}");
        const textosMemoria = JSON.parse(localStorage.getItem("textos_edicion") || "{}");
        const idsOcultos = JSON.parse(localStorage.getItem("ids_ocultos_historial") || "[]"); 

        const renderizar = (textoBusqueda = "") => {
            const tbody = document.querySelector("#tablaCargados tbody");
            if (!tbody) return;
            tbody.innerHTML = "";
            
            const chkOcultos = document.getElementById("chkMostrarOcultos");
            const mostrarOcultos = chkOcultos ? chkOcultos.checked : (localStorage.getItem("estado_chk_ocultos") === "true");
            
            const termino = textoBusqueda.toLowerCase().trim();
            const listaBusqueda = listaCompleta.filter(item => item.join(" ").toLowerCase().includes(termino));

            const activosBusqueda = listaBusqueda.filter(p => (p[11] || "").toLowerCase().trim() !== 'eliminado');
            const idsOcultosNumeros = idsOcultos.map(id => parseInt(id));
            let cantidadOcultos = activosBusqueda.filter(p => idsOcultosNumeros.includes(parseInt(p[0]))).length;

            const spanContador = document.getElementById("contadorOcultos");
            if (spanContador) spanContador.innerText = cantidadOcultos > 0 ? `(${cantidadOcultos})` : "";

            const listaFiltrada = listaBusqueda.filter(item => { 
                const estaOculto = idsOcultosNumeros.includes(parseInt(item[0])); 
                if (estaOculto && !mostrarOcultos) return false; 
                return true; 
            });
            const activos = []; const eliminados = [];
            listaFiltrada.forEach(p => { const registro = (p[11] || "").toLowerCase().trim(); if (registro === 'eliminado') eliminados.push(p); else activos.push(p); });
            activos.sort((a, b) => b[0] - a[0]); eliminados.sort((a, b) => b[0] - a[0]);

            const dibujarSublista = (listaPedidos, esPapelera) => {
                const gruposDireccion = {};
                listaPedidos.forEach(p => { let dir = p[1] || p[2]; if (!dir || dir === "0") { dir = "🏠 RETIRA EN LOCAL"; } if (!gruposDireccion[dir]) gruposDireccion[dir] = []; gruposDireccion[dir].push(p); });

                let groupCounter = 0; let contadorGruposVisual = 0;
                for (const direccion in gruposDireccion) {
                    const pedidosDir = gruposDireccion[direccion];
                    const subGruposCadete = {};
                    pedidosDir.forEach(p => { let cad = (!p[8] || p[8] === "0") ? "Sin Cadete" : p[8]; if (direccion === "🏠 RETIRA EN LOCAL") { cad = "Retira"; } if (!subGruposCadete[cad]) subGruposCadete[cad] = []; subGruposCadete[cad].push(p); });

                    for (const nombreCadete in subGruposCadete) {
                        const pedidosSubGrupo = subGruposCadete[nombreCadete];
                        const groupId = `hist-group-${groupCounter++}`;
                        const idsGlobales = pedidosSubGrupo.map(p => p[0]).join(",");
                        
                        const esGrupoGris = (contadorGruposVisual % 2 !== 0);
                        const claseFondoZebra = esGrupoGris ? "grupo-fondo-gris" : "";
                        const grupoEditadoDireccion = pedidosSubGrupo.some(p => (flagsMemoria[p[0]] || []).includes("dir"));
                        const grupoEditadoCadete = pedidosSubGrupo.some(p => (flagsMemoria[p[0]] || []).includes("cad"));
                        const grupoEstaOculto = pedidosSubGrupo.every(p => idsOcultos.includes(parseInt(p[0])));

                        let etiquetaDireccion = ""; let msjDireccion = "";
                        let etiquetaCadete = ""; let msjCadete = ""; 
                        let claseFondoEstructural = ""; 

                        if (!esPapelera) {
                            if (grupoEditadoDireccion) {
                                claseFondoEstructural = "fila-editada"; 
                                let recoleccion = [];
                                pedidosSubGrupo.forEach(p => { if (textosMemoria[p[0]]) recoleccion.push(...textosMemoria[p[0]].filter(c => c.startsWith("Dir") || c.startsWith("Emp"))); });
                                if (recoleccion.length > 0) msjDireccion = `Destino editado:\n• ` + [...new Set(recoleccion)].join('\n• ');
                                etiquetaDireccion = `<span class="texto-editado" style="display:inline-block; font-size:0.85em; margin-top:2px; padding: 0 10px;">&nbsp;</span>`;
                            }
                            if (grupoEditadoCadete) {
                                claseFondoEstructural = "fila-editada"; 
                                let recoleccion = [];
                                pedidosSubGrupo.forEach(p => { if (textosMemoria[p[0]]) recoleccion.push(...textosMemoria[p[0]].filter(c => c.startsWith("Cadete"))); });
                                if (recoleccion.length > 0) msjCadete = `Cadete reasignado:\n• ` + [...new Set(recoleccion)].join('\n• ');
                                etiquetaCadete = `<span class="texto-editado" style="display:inline-block; font-size:0.85em; padding: 0 10px;">&nbsp;</span>`;
                            }
                            if (grupoEstaOculto) { claseFondoEstructural = "fila-oculta"; etiquetaDireccion += `<span style="display:block; font-size:0.85em; color:#666; font-style:italic; margin-top:2px;"></span>`; }
                        }

                        const subGruposNombre = {};
                        pedidosSubGrupo.forEach(p => { let nombre = p[3] ? p[3].trim() : ""; let key = nombre !== "" ? nombre.toLowerCase() : "SIN_NOMBRE_" + p[0]; if (!subGruposNombre[key]) subGruposNombre[key] = []; subGruposNombre[key].push(p); });

                        let filasTotales = Object.keys(subGruposNombre).length;
                        let contadorFilasLocal = 0;

                        for (const keyNombre in subGruposNombre) {
                            const itemsPersona = subGruposNombre[keyNombre];
                            contadorFilasLocal++;
                            const esUltimaFila = (contadorFilasLocal === filasTotales);
                            const claseBorde = esUltimaFila ? "borde-grupo" : "borde-interno";
                            
                            const p = itemsPersona[0];
                            const idsPersonaStr = itemsPersona.map(it => it[0]).join(",");
                            const tr = document.createElement("tr");
                            tr.setAttribute("data-group", groupId);
                            
                            const esEditado = itemsPersona.some(it => idsEditadosFijos.has(parseInt(it[0])));
                            const cambioContenido = itemsPersona.some(it => (flagsMemoria[parseInt(it[0])] || []).includes("item"));
                            const itemEstaOculto = itemsPersona.every(it => idsOcultos.includes(parseInt(it[0])));

                            let claseFondoPedido = "";
                            if (esPapelera) { 
                                tr.classList.add("fila-eliminada"); 
                            } else if (grupoEstaOculto || itemEstaOculto) {
                                tr.classList.add("fila-oculta"); 
                                tr.style.opacity = "0.6"; 
                            }
                            else {
                                if (esEditado || cambioContenido) { 
                                    claseFondoPedido = "fila-editada"; tr.classList.add("fila-editada"); 
                                } else if (claseFondoZebra) { 
                                    tr.classList.add(claseFondoZebra); 
                                } 
                            }

                            let partesTexto = itemsPersona.map(it => { 
                                // Si el menú es "0", devolvemos un texto vacío
                                if (!it[4] || it[4] === "0") return ""; 
                                
                                let desc = (it[6] && it[6] !== "0") ? ` <span style="font-size:0.9em; color:#555;">[${it[6]}]</span>` : ""; 
                                let guarn = (it[5] && it[5] !== "0") ? ` con ${it[5]}` : "";
                                return `(${it[7]}) ${it[4]}${guarn}${desc}`; 
                            }).filter(t => t !== ""); // Filtramos los vacíos
                            
                            let texto = partesTexto.length > 0 ? partesTexto.join(" - ") : "";
                            
                            // Si hay nombre, lo agregamos
                            if (p[3] && p[3] !== "0" && p[3].trim() !== "") { 
                                texto += texto === "" ? p[3] : ` - ${p[3]}`; 
                            }

                            let msjItem = "";
                            if ((esEditado || cambioContenido) && !esPapelera) {
                                let recoleccion = [];
                                itemsPersona.forEach(it => { if (textosMemoria[it[0]]) recoleccion.push(...textosMemoria[it[0]].filter(c => !c.startsWith("Dir") && !c.startsWith("Cadete") && !c.startsWith("Emp"))); });
                                if (recoleccion.length > 0) msjItem = `Modificaciones:\n• ` + [...new Set(recoleccion)].join('\n• ');
                                texto += ` <span class="texto-editado" style="display:inline-block; padding: 0 10px; cursor: help;">&nbsp;</span>`;
                            }

                            // LLamadas a las funciones compartidas de main.js
                            let btnEditarItem = itemsPersona.length > 1 ? `<button class="btn-editar" onclick="editarGrupo('${idsPersonaStr}')" title="Editar">✏️</button>` : `<button class="btn-editar" onclick="editarPedido(${p[0]})" title="Editar">✏️</button>`;
                            let btnBorrarItem = itemsPersona.length > 1 ? `<button class="btn-borrar-item" onclick="eliminarGrupoPersona('${idsPersonaStr}')" title="Borrar">🗑️</button>` : `<button class="btn-borrar-item" onclick="eliminarPedido(${p[0]})" title="Borrar">🗑️</button>`;

                            const titleOjoItem = itemEstaOculto ? "Mostrar pedido" : "Ocultar pedido";
                            const iconoOjoItem = itemEstaOculto ? "🙈" : "👁️";
                            const btnOjoItem = `<button type="button" class="btn-ojo-animado" onclick="toggleOcultarGrupoHistorial('${idsPersonaStr}', ${!itemEstaOculto})" title="${titleOjoItem}">${iconoOjoItem}</button>`;
                            
                            //  Botón Restaurar Ítem
                            const btnRestaurarItem = `<button type="button" class="btn-restaurar" onclick="restaurarPedidos('${idsPersonaStr}')" title="Devolver a pendientes">↩️</button>`;

                            let html = "";
                            if (contadorFilasLocal === 1) {
                                const claseEliminada = (esPapelera || grupoEstaOculto) ? "eliminada" : "";
                                const claseFondoCelda = (esPapelera || grupoEstaOculto) ? "" : (claseFondoEstructural || claseFondoZebra);
                                const direccionFormateada = typeof formatearDireccionHtml === 'function' ? formatearDireccionHtml(direccion) : direccion;
                                
                                const titleOjo = grupoEstaOculto ? "Mostrar grupo completo" : "Ocultar grupo completo"; 
                                const iconoOjo = grupoEstaOculto ? "🙈" : "👁️"; 
                                const btnOjo = `<button type="button" class="btn-ojo-animado" onclick="toggleOcultarGrupoHistorial('${idsGlobales}', ${!grupoEstaOculto})" title="${titleOjo}">${iconoOjo}</button>`;
                                
                                //  Botón Restaurar Grupo
                                const btnRestaurarGrupo = `<button type="button" class="btn-restaurar" onclick="restaurarPedidos('${idsGlobales}')" title="Devolver todo el grupo a pendientes">↩️</button>`;
                                
                                // Se inyecta btnRestaurarGrupo a la izquierda de Editar
                                html += `<td class="celda-direccion ${claseEliminada} ${claseFondoCelda} borde-grupo" rowspan="${filasTotales}" title="${msjDireccion}"><div class="contenedor-direccion"><span class="titulo-direccion">${direccionFormateada}</span>${etiquetaDireccion}<div class="acciones-grupo">${!esPapelera ? `${btnOjo}${btnRestaurarGrupo}<button class="btn-editar" onclick="editarGrupo('${idsGlobales}')">✏️</button><button class="btn-borrar" onclick="eliminarGrupo('${idsGlobales}')">🗑️</button>` : ''}</div></div></td>`;
                            }

                            // Se inyecta btnRestaurarItem a la izquierda de Editar
                            html += `<td class="celda-pedido ${claseBorde} ${claseFondoPedido}" title="${msjItem}"><div class="item-pedido-container"><span class="texto-pedido">${texto}</span><div class="acciones-item">${!esPapelera ? `${btnOjoItem}${btnRestaurarItem}${btnEditarItem}${btnBorrarItem}` : ''}</div></div></td>`;

                            if (contadorFilasLocal === 1) { 
                                const claseFondoCelda = (esPapelera || grupoEstaOculto) ? "" : (claseFondoEstructural || claseFondoZebra); 
                                
                                const btnLapizCadete = !esPapelera ? `<button class="btn-editar-celda btn-editar-celda-rapida" onclick="abrirMenuRapido(event, '${idsGlobales}', 'cadete')" title="Reasignar Cadete">✏️</button>` : '';
                                
                                html += `<td class="texto-centro celda-cadete borde-grupo ${claseFondoCelda}" rowspan="${filasTotales}" title="${msjCadete}" style="position:relative;">
                                    ${nombreCadete} ${etiquetaCadete} ${btnLapizCadete}
                                </td>`; 
                            }

                            const generarBadge = (t) => { let v=t; if(!v||v==='-'||v==='0') v='Pendiente'; let c='badge-efectivo'; const txt=String(v).toLowerCase(); if(txt.includes('pendiente')) c='badge-pendiente'; else if(txt.includes('mp')||txt.includes('mercado')) c='badge-mp'; else if(txt.includes('pagado')) c='badge-pagado'; return `<span class="badge ${c}">${v}</span>`; };
                            
                            // --- BOTONES INDEPENDIENTES PARA EDICIÓN RÁPIDA EN EL HISTORIAL ---
                            const btnLapizPago = !esPapelera ? `<button class="btn-editar-celda btn-editar-celda-rapida" onclick="abrirMenuRapido(event, '${idsPersonaStr}', 'forma_pago')" title="Cambiar Forma de Pago">✏️</button>` : '';
                            const btnLapizEstado = !esPapelera ? `<button class="btn-editar-celda btn-editar-celda-rapida" onclick="abrirMenuRapido(event, '${idsPersonaStr}', 'estado')" title="Cambiar Estado">✏️</button>` : '';

                            html += `<td class="texto-centro ${claseBorde} ${claseFondoPedido}" style="vertical-align: middle;"><div class="contenedor-badge-centro">${generarBadge(p[9])}${btnLapizPago}</div></td>`;
                            html += `<td class="texto-centro ${claseBorde} borde-izquierdo-estado ${claseFondoPedido}" style="vertical-align: middle;"><div class="contenedor-badge-centro">${generarBadge(p[10])}${btnLapizEstado}</div></td>`;

                            tr.innerHTML = html;
                            tbody.appendChild(tr);
                        }
                        contadorGruposVisual++; 
                    }
                }
            };

            if (activos.length > 0) dibujarSublista(activos, false);
            if (eliminados.length > 0) { const separador = document.createElement("tr"); separador.innerHTML = `<td colspan="5" style="background:#333;color:#fff;text-align:center;font-size:11px;font-weight:bold;padding:4px;">🔻 ELIMINADOS 🔻</td>`; tbody.appendChild(separador); dibujarSublista(eliminados, true); }
            if (typeof inicializarHoverGrupal === 'function') inicializarHoverGrupal();
        };

        renderizar(inputFiltro ? inputFiltro.value : "");
        if (inputFiltro) inputFiltro.oninput = (e) => renderizar(e.target.value);

    } catch (err) { console.error(err); }
}
window.cargarTablaCargados = cargarTablaCargados;

function toggleOcultarGrupoHistorial(idsStr, ocultar) {
    if (!idsStr) return;
    const ids = idsStr.split(",").map(Number);
    let ocultos = JSON.parse(localStorage.getItem("ids_ocultos_historial") || "[]");

    if (ocultar) {
        ids.forEach(id => { if (!ocultos.includes(id)) ocultos.push(id); });
    } else {
        ocultos = ocultos.filter(id => !ids.includes(id));
    }

    localStorage.setItem("ids_ocultos_historial", JSON.stringify(ocultos));
    cargarTablaCargados(); 
}
window.toggleOcultarGrupoHistorial = toggleOcultarGrupoHistorial;

/* ========================================================================== */
/* LÓGICA DE ARCHIVADO MASIVO CON VALIDACIÓN DE PENDIENTES                    */
/* ========================================================================== */
async function confirmarNuevaTabla() {
    try {
        const resPendientes = await fetch(`/pedidos?t=${Date.now()}`);
        const pedidosHojaCarga = await resPendientes.json();

        if (pedidosHojaCarga && pedidosHojaCarga.length > 0) {
            alert(
                `⛔ BLOQUEO DE SEGURIDAD: No se puede archivar el día.\n\n` +
                `Hay ${pedidosHojaCarga.length} pedido(s) pendientes en la tabla principal.\n\n` +
                `Por favor, confirma o elimina estos pedidos antes de cerrar el día.`
            );
            return; 
        }

        const mensajeConfirmacion = "¿Confirmas que deseas archivar todos los pedidos cargados y limpiar las tablas para iniciar un nuevo día?";
        
        if (confirm(mensajeConfirmacion)) {
            const response = await fetch('/api/nueva_tabla', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

                if (response.ok) {
                // 🔥 LIMPIEZA MASIVA DE TODAS LAS MEMORIAS DEL DÍA
                localStorage.removeItem("ids_verde_fijo");
                localStorage.removeItem("ids_azul_fijo");
                localStorage.removeItem("flags_edicion");
                localStorage.removeItem("textos_edicion");
                localStorage.removeItem("ids_al_principio");
                localStorage.removeItem("ids_ocultos_historial"); 
                localStorage.removeItem("estado_chk_ocultos"); 
                
                // 👇 ESTA LÍNEA ES LA NUEVA 👇
                localStorage.setItem("dia_iniciado", "false"); 

                alert("✅ Día archivado correctamente. Iniciando nueva jornada.");
                window.location.href = '/'; 
            } else {
                const err = await response.json();
                alert("❌ Error al archivar: " + (err.error || "Error desconocido"));
            }
        }
    } catch (error) {
        console.error("Error en el proceso de cierre:", error);
        alert("❌ Error de comunicación con el servidor.");
    }
}
window.confirmarNuevaTabla = confirmarNuevaTabla;

/* ========================================================================== */
/* FUNCIÓN PARA DEVOLVER PEDIDOS CARGADOS A LA TABLA PRINCIPAL                */
/* ========================================================================== */
window.restaurarPedidos = async function(ids_str) {
    if (!confirm("¿Querés devolver estos pedidos a la pantalla principal? (Volverán a estar pendientes)")) return;
    
    try {
        const ids = String(ids_str).split(",").map(id => parseInt(id));
        const res = await fetch("/api/restaurar_pedidos", {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: ids })
        });
        
        if (res.ok) {
            cargarTablaCargados();
        } else {
            alert("Error al intentar restaurar el pedido.");
        }
    } catch (e) {
        console.error("Error al intentar restaurar:", e);
    }
};