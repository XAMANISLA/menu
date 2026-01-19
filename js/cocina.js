// Estado global
let pedidosPendientes = [];

// Elementos del DOM
const ordersContainer = document.getElementById('orders-container');
const emptyState = document.getElementById('empty-state');
const toast = document.getElementById('kitchen-toast');
const toastMsg = document.getElementById('kitchen-toast-msg');

document.addEventListener('DOMContentLoaded', async () => {
    await cargarPedidos();
    suscribirACambios();
});

async function cargarPedidos() {
    try {
        // Obtenemos pedidos que no han sido servidos aún (enviado o preparado)
        const { data, error } = await window.supabase
            .from('pedidos')
            .select(`
                *,
                mesas:mesa_id(*),
                pedido_detalle(
                    *,
                    productos(nombre, categoria)
                )
            `)
            .in('estado_cocina', ['enviado', 'preparado'])
            .order('created_at', { ascending: true });

        if (error) throw error;

        console.log('Pedidos cargados (Cocina):', data); // Diagnóstico
        pedidosPendientes = data || [];
        renderizarPedidos();
    } catch (error) {
        console.error('Error al cargar pedidos:', error);
    }
}

function renderizarPedidos() {
    ordersContainer.innerHTML = '';

    // Filtrar pedidos que tienen al menos un producto que no es de la categoría 'Bar'
    const pedidosFiltrados = pedidosPendientes.map(pedido => {
        if (!pedido.pedido_detalle) return null;

        const itemsCocina = pedido.pedido_detalle.filter(d => {
            const prod = d.productos;
            const categoria = prod ? (Array.isArray(prod) ? prod[0]?.categoria : prod.categoria) : '';
            return categoria && categoria.toLowerCase() !== 'bar';
        });

        if (itemsCocina.length > 0) {
            return { ...pedido, pedido_detalle: itemsCocina };
        }
        return null;
    }).filter(p => p !== null);

    if (pedidosFiltrados.length === 0) {
        emptyState.classList.remove('hidden');
        emptyState.classList.add('flex');
        return;
    } else {
        emptyState.classList.add('hidden');
        emptyState.classList.remove('flex');
    }

    pedidosFiltrados.forEach(pedido => {
        try {
            const timeAgo = Math.floor((new Date() - new Date(pedido.created_at)) / 60000);
            const isNew = timeAgo < 1 && pedido.estado_cocina === 'enviado';

            // Datos de mesa robustos
            const finalMesa = pedido.mesas ? (Array.isArray(pedido.mesas) ? pedido.mesas[0] : pedido.mesas) : null;
            const mesaNombre = finalMesa ? (finalMesa.nombre || `Mesa ${finalMesa.numero}`) : `Mesa ${pedido.mesa_id?.substring(0, 4) || '?'}`;
            const mesaID = finalMesa ? finalMesa.numero : '';

            const card = document.createElement('div');
            card.className = `order-card p-6 shadow-xl border-l-[10px] transform hover:scale-[1.02] ${isNew ? 'new-order border-[#588157]' : 'border-gray-200'}`;

            let statusBadge = '';
            let actionBtn = '';
            let badgeColor = '';
            let statusLabel = '';

            if (pedido.estado_cocina === 'enviado') {
                const date = new Date(pedido.created_at);
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                badgeColor = 'text-[#a3b18a]';
                statusLabel = `Recibido ${hours} : ${minutes}`;
                actionBtn = `
                    <button onclick="cambiarEstado('${pedido.id}', 'preparado')" class="w-full bg-[#588157] hover:bg-[#3a5a40] text-white font-black py-5 rounded-2xl transition-all shadow-lg active:scale-95 uppercase tracking-widest text-xs flex items-center justify-center gap-2">
                        <i class="fas fa-play"></i>
                        <span>Empezar Preparación</span>
                    </button>
                `;
            } else { // pedido.estado === 'preparado'
                badgeColor = 'text-yellow-500';
                statusLabel = 'Preparando';
                actionBtn = `
                    <button onclick="cambiarEstado('${pedido.id}', 'servido')" class="w-full bg-[#a3b18a] hover:bg-[#588157] text-white font-black py-5 rounded-2xl transition-all shadow-lg active:scale-95 uppercase tracking-widest text-xs flex items-center justify-center gap-2">
                        <i class="fas fa-check-double"></i>
                        <span>Listo para Servir</span>
                    </button>
                `;
            }

            const itemsHtml = pedido.pedido_detalle.map(d => {
                const prod = d.productos;
                const prodNombre = prod ? (Array.isArray(prod) ? prod[0]?.nombre : prod.nombre) : 'Producto';

                return `
                <div class="flex items-start gap-3 py-4 border-b border-gray-100 last:border-0 relative group">
                    <div class="bg-[#588157] text-white font-black px-2.5 py-1 rounded-lg text-xs">${d.cantidad}x</div>
                    <div class="flex-1">
                        <p class="font-bold text-[#3a5a40]">${prodNombre}</p>
                        ${d.observaciones ? `<p class="text-[11px] text-[#a3b18a] italic font-semibold mt-1.5 flex items-center gap-1.5"><i class="fas fa-comment-dots opacity-50"></i>${d.observaciones}</p>` : ''}
                    </div>
                    ${pedido.estado === 'enviado' ? `
                    <button onclick="eliminarItemPedido('${d.id}', '${pedido.id}', ${d.subtotal})" class="bg-red-50 text-red-500 hover:bg-red-100 p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100" title="Eliminar producto">
                        <i class="fas fa-trash-alt text-xs"></i>
                    </button>
                    ` : ''}
                </div>
            `}).join('');

            card.innerHTML = `
                <div class="flex justify-between items-start mb-6">
                    <div>
                        <span class="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] block mb-1">Mesa / Espacio</span>
                        <h3 class="text-3xl font-black text-[#3a5a40] tracking-tighter">${mesaNombre}</h3>
                        ${mesaID && mesaID !== mesaNombre ? `<span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">ID: ${mesaID}</span>` : ''}
                    </div>
                    <div class="text-right">
                        <span class="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] block mb-1">Status</span>
                        <span class="${badgeColor} text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest border border-current bg-opacity-10">${statusLabel}</span>
                    </div>
                </div>
                <div class="flex-1 p-6 space-y-1">
                    ${itemsHtml}
                </div>
                <div class="mt-auto flex flex-col gap-3">
                    ${actionBtn}
                </div>
            `;
            ordersContainer.appendChild(card);
        } catch (e) {
            console.error('Error renderizando pedido:', pedido.id, e);
        }
    });
}

async function cambiarEstado(pedidoId, nuevoEstado) {
    try {
        const updateData = { estado_cocina: nuevoEstado };

        const { error } = await window.supabase
            .from('pedidos')
            .update(updateData)
            .eq('id', pedidoId);

        if (error) throw error;

        // Comprobar si el pedido global ya puede pasar a 'servido'
        if (nuevoEstado === 'servido') {
            await actualizarEstadoGlobal(pedidoId);
        }

        showToast(`Platillos marcados como ${nuevoEstado}`);
        // El refresco sucederá por la suscripción realtime
    } catch (error) {
        console.error('Error al cambiar estado:', error);
    }
}

async function actualizarEstadoGlobal(pedidoId) {
    try {
        // Obtenemos el pedido completo con sus detalles
        const { data: pedido, error } = await window.supabase
            .from('pedidos')
            .select('*, pedido_detalle(*, productos(categoria))')
            .eq('id', pedidoId)
            .single();

        if (error) throw error;

        const itemsBar = pedido.pedido_detalle.some(d => d.productos.categoria === 'Bar');
        const cocinaServida = pedido.estado_cocina === 'servido';
        const barraServida = pedido.estado_barra === 'servido';

        // Si la cocina ya terminó y (no hay bar o el bar ya terminó)
        if (cocinaServida && (!itemsBar || barraServida)) {
            await window.supabase
                .from('pedidos')
                .update({
                    estado: 'servido',
                    finished_at: new Date().toISOString()
                })
                .eq('id', pedidoId);
        }
    } catch (error) {
        console.error('Error al actualizar estado global:', error);
    }
}

async function eliminarItemPedido(detalleId, pedidoId, subtotal) {
    if (!confirm('¿Estás seguro de que deseas eliminar este producto del pedido?')) return;

    try {
        // 1. Eliminar el item del detalle
        const { error: errorDetalle } = await window.supabase
            .from('pedido_detalle')
            .delete()
            .eq('id', detalleId);

        if (errorDetalle) throw errorDetalle;

        // 2. Verificar cuántos items quedan en el pedido
        const { data: itemsRestantes, error: errorConteo } = await window.supabase
            .from('pedido_detalle')
            .select('id')
            .eq('pedido_id', pedidoId);

        if (errorConteo) throw errorConteo;

        if (itemsRestantes.length === 0) {
            // 3a. Si no quedan items, eliminar el pedido
            const { error: errorPedido } = await window.supabase
                .from('pedidos')
                .delete()
                .eq('id', pedidoId);

            if (errorPedido) throw errorPedido;
            showToast('Pedido cancelado (se quedó sin productos)');
        } else {
            // 3b. Si quedan items, actualizar el total del pedido
            // Obtenemos el pedido actual para saber su total actual
            const { data: pedidoActual, error: errorPedidoInfo } = await window.supabase
                .from('pedidos')
                .select('total')
                .eq('id', pedidoId)
                .single();

            if (errorPedidoInfo) throw errorPedidoInfo;

            const nuevoTotal = Math.max(0, pedidoActual.total - subtotal);

            const { error: errorUpdate } = await window.supabase
                .from('pedidos')
                .update({ total: nuevoTotal })
                .eq('id', pedidoId);

            if (errorUpdate) throw errorUpdate;
            showToast('Producto eliminado y total actualizado');
        }

        // El refresco sucederá por la suscripción realtime
    } catch (error) {
        console.error('Error al eliminar item:', error);
        alert('Hubo un error al intentar eliminar el producto.');
    }
}

function suscribirACambios() {
    // Escuchar cambios en la tabla 'pedidos' y 'pedido_detalle'
    window.supabase
        .channel('cocina-cambios')
        .on('postgres_changes', { event: '*', table: 'pedidos' }, payload => {
            console.log('Cambio recibido en pedidos:', payload);

            // Si es un nuevo pedido, reproducir sonido
            if (payload.eventType === 'INSERT') {
                const sound = document.getElementById('notification-sound');
                if (sound) {
                    sound.play().catch(e => console.log('Audio play blocked:', e));
                }
            }

            cargarPedidos(); // Recargar todo para simplificar consistencia
        })
        .on('postgres_changes', { event: '*', table: 'pedido_detalle' }, payload => {
            console.log('Cambio recibido en detalles:', payload);
            cargarPedidos();
        })
        .subscribe();
}

function showToast(msg) {
    toastMsg.innerText = msg;
    toast.classList.remove('opacity-0', 'translate-y-10');
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-10');
    }, 3000);
}

function activarSonido() {
    const sound = document.getElementById('notification-sound');
    if (sound) {
        sound.play().then(() => {
            sound.pause();
            sound.currentTime = 0;
            document.getElementById('btn-unmute').classList.add('hidden');
            showToast('Sonido activado correctamente');
        }).catch(e => {
            console.error('Error al activar sonido:', e);
            alert('Por favor, haz clic nuevamente para permitir el sonido.');
        });
    }
}

function testSonido() {
    const sound = document.getElementById('notification-sound');
    if (sound) {
        sound.play().catch(e => {
            console.error('Audio play blocked:', e);
            alert('Haz clic en "Activar Sonido" primero.');
        });
    }
}
