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
                mesas(numero),
                pedido_detalle(
                    *,
                    productos(nombre, categoria)
                )
            `)
            .in('estado', ['enviado', 'preparado'])
            .order('created_at', { ascending: true });

        if (error) throw error;

        pedidosPendientes = data;
        renderizarPedidos();
    } catch (error) {
        console.error('Error al cargar pedidos:', error);
    }
}

function renderizarPedidos() {
    ordersContainer.innerHTML = '';

    // Filtrar pedidos que tienen al menos un producto de la categoría 'Bar'
    const pedidosFiltrados = pedidosPendientes.map(pedido => {
        const itemsBar = pedido.pedido_detalle.filter(d => d.productos.categoria === 'Bar');
        if (itemsBar.length > 0) {
            return { ...pedido, pedido_detalle: itemsBar };
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
        const timeAgo = Math.floor((new Date() - new Date(pedido.created_at)) / 60000);
        const isNew = timeAgo < 1 && pedido.estado === 'enviado';

        const card = document.createElement('div');
        card.className = `order-card p-6 shadow-xl border-l-[10px] transform hover:scale-[1.02] ${isNew ? 'new-order border-[#588157]' : 'border-gray-200'}`;

        let actionBtn = '';
        let badgeColor = '';
        let statusLabel = '';

        if (pedido.estado === 'enviado') {
            badgeColor = 'text-[#a3b18a]';
            statusLabel = 'Recibido';
            actionBtn = `
                <button onclick="cambiarEstado('${pedido.id}', 'preparado')" class="w-full bg-[#588157] hover:bg-[#3a5a40] text-white font-black py-4 rounded-2xl transition-all shadow-lg active:scale-95 uppercase tracking-widest text-xs flex items-center justify-center gap-2">
                    <i class="fas fa-cocktail"></i>
                    <span>Empezar Preparación</span>
                </button>
            `;
        } else { // pedido.estado === 'preparado'
            badgeColor = 'text-yellow-500';
            statusLabel = 'Preparando';
            actionBtn = `
                <button onclick="cambiarEstado('${pedido.id}', 'servido')" class="w-full bg-[#a3b18a] hover:bg-[#588157] text-white font-black py-4 rounded-2xl transition-all shadow-lg active:scale-95 uppercase tracking-widest text-xs flex items-center justify-center gap-2">
                    <i class="fas fa-check-double"></i>
                    <span>Listo para Servir</span>
                </button>
            `;
        }

        const itemsHtml = pedido.pedido_detalle.map(d => `
            <div class="flex items-start gap-3 py-4 border-b border-gray-100 last:border-0">
                <div class="bg-[#3a5a40] text-white font-black px-2.5 py-1 rounded-lg text-xs">${d.cantidad}x</div>
                <div class="flex-1">
                    <p class="font-bold text-gray-800">${d.productos.nombre}</p>
                    ${d.observaciones ? `<p class="text-[11px] text-[#588157] italic font-semibold mt-1.5 flex items-center gap-1.5"><i class="fas fa-comment-dots opacity-50"></i>${d.observaciones}</p>` : ''}
                </div>
            </div>
        `).join('');

        card.innerHTML = `
            <div class="flex justify-between items-start mb-6">
                <div>
                    <span class="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] block mb-1">Mesa</span>
                    <h3 class="text-4xl font-black text-[#3a5a40] tracking-tighter">${pedido.mesas.numero}</h3>
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
    });
}

async function cambiarEstado(pedidoId, nuevoEstado) {
    try {
        const { error } = await window.supabase
            .from('pedidos')
            .update({ estado: nuevoEstado })
            .eq('id', pedidoId);

        if (error) throw error;

        showToast(`Orden de Barra marcada como ${nuevoEstado}`);
    } catch (error) {
        console.error('Error al cambiar estado:', error);
    }
}

function suscribirACambios() {
    window.supabase
        .channel('barra-cambios')
        .on('postgres_changes', { event: '*', table: 'pedidos' }, payload => {
            console.log('Cambio recibido en pedidos (Barra):', payload);

            if (payload.eventType === 'INSERT') {
                const sound = document.getElementById('notification-sound');
                if (sound) {
                    sound.play().catch(e => console.log('Audio play blocked:', e));
                }
            }

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
