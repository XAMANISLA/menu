// Estado
let mesas = [];
let mesaSeleccionada = null;
let metodoSeleccionado = null;
let subtotalActual = 0;
let descuentoActual = 0;
let porcentajeActual = 0;
let propinaActual = 0;

// Elementos DOM
const tablesContainer = document.getElementById('tables-container');
const modalCuenta = document.getElementById('modal-cuenta');
const modalPanel = document.getElementById('modal-panel');
const cuentaItems = document.getElementById('cuenta-items');
const modalTotal = document.getElementById('modal-total');
const modalSubtotal = document.getElementById('modal-subtotal');
const modalTitle = document.getElementById('modal-title');
const btnCobrar = document.getElementById('btn-cobrar');
const toast = document.getElementById('caja-toast');
const toastMsg = document.getElementById('caja-toast-msg');

document.addEventListener('DOMContentLoaded', async () => {
    await cargarDatos();
    suscribirRealtime();
});

async function cargarDatos() {
    try {
        // Cargar mesas
        const { data: mesasData, error: mesasError } = await window.supabase
            .from('mesas')
            .select('*')
            .order('numero', { ascending: true });

        if (mesasError) throw mesasError;

        // Cargar pedidos abiertos
        const { data: pedidosData, error: pedidosError } = await window.supabase
            .from('pedidos')
            .select('*')
            .neq('estado', 'pagado');

        if (pedidosError) throw pedidosError;

        // Mapear totales a las mesas
        mesas = mesasData.map(m => {
            const pedidosMesa = pedidosData.filter(p => p.mesa_id === m.id);
            const acumulado = pedidosMesa.reduce((acc, p) => acc + (p.total || 0), 0);
            return { ...m, acumulado };
        });

        renderizarMesas();
        calcularVentasHoy();
    } catch (error) {
        console.error('Error al cargar datos:', error);
    }
}

async function calcularVentasHoy() {
    const hoy = new Date().toISOString().split('T')[0];
    const { data, error } = await window.supabase
        .from('pedidos')
        .select('total, metodo_pago')
        .eq('estado', 'pagado')
        .gte('created_at', hoy);

    if (!error && data) {
        const totalEfectivo = data.filter(p => p.metodo_pago === 'efectivo').reduce((acc, p) => acc + (p.total || 0), 0);
        const totalTarjeta = data.filter(p => p.metodo_pago === 'tarjeta').reduce((acc, p) => acc + (p.total || 0), 0);
        const totalGral = totalEfectivo + totalTarjeta;

        const elEfectivo = document.getElementById('total-efectivo');
        const elTarjeta = document.getElementById('total-tarjeta');
        const elTotal = document.getElementById('ventas-total');

        if (elEfectivo) elEfectivo.innerText = `$${totalEfectivo.toFixed(2)}`;
        if (elTarjeta) elTarjeta.innerText = `$${totalTarjeta.toFixed(2)}`;
        if (elTotal) elTotal.innerText = `$${totalGral.toFixed(2)}`;
    }
}

function renderizarMesas() {
    tablesContainer.innerHTML = '';
    mesas.forEach(mesa => {
        const card = document.createElement('div');
        const isActive = mesa.acumulado > 0;

        card.className = `table-card cursor-pointer bg-white rounded-[2rem] p-8 shadow-sm border-2 transition-all flex flex-col items-center justify-center text-center ${isActive ? 'border-[#84a98c] shadow-[#84a98c]/10' : 'border-gray-50 opacity-40 hover:opacity-100'}`;

        card.innerHTML = `
            <div class="w-20 h-20 rounded-3xl flex items-center justify-center mb-6 ${isActive ? 'bg-[#588157] text-white' : 'bg-gray-100 text-gray-300'}">
                <i class="fas fa-chair text-3xl"></i>
            </div>
            <h3 class="text-xl font-black text-[#3a5a40] uppercase tracking-tighter">Mesa ${mesa.numero}</h3>
            <p class="text-sm font-bold mt-2 ${isActive ? 'text-[#588157]' : 'text-gray-400'}">
                ${isActive ? `$${mesa.acumulado.toFixed(2)}` : 'VACÍA'}
            </p>
            ${isActive ? '<span class="mt-6 bg-[#588157]/10 text-[#588157] text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-[0.2em] border border-[#588157]/20">Activa</span>' : ''}
        `;

        if (isActive) {
            card.onclick = () => verDetalleMesa(mesa);
        }
        tablesContainer.appendChild(card);
    });
}

async function verDetalleMesa(mesa) {
    mesaSeleccionada = mesa;
    modalTitle.innerText = `MESA ${mesa.numero}`;
    cuentaItems.innerHTML = '<div class="flex justify-center p-10"><i class="fas fa-circle-notch animate-spin text-4xl text-[#588157]"></i></div>';

    // Abrir modal
    modalCuenta.classList.remove('invisible', 'opacity-0');
    setTimeout(() => modalPanel.classList.remove('translate-x-full'), 10);

    try {
        const { data, error } = await window.supabase
            .from('pedidos')
            .select(`
                id,
                total,
                pedido_detalle(
                    cantidad,
                    subtotal,
                    productos(nombre)
                )
            `)
            .eq('mesa_id', mesa.id)
            .neq('estado', 'pagado');

        if (error) throw error;

        let total = 0;
        cuentaItems.innerHTML = '';

        data.forEach(pedido => {
            if (pedido.pedido_detalle) {
                pedido.pedido_detalle.forEach(det => {
                    total += (det.subtotal || 0);
                    const itemDiv = document.createElement('div');
                    itemDiv.className = "flex justify-between items-center py-4 border-b border-gray-50 last:border-0";

                    const nombreProd = det.productos ? (Array.isArray(det.productos) ? det.productos[0].nombre : det.productos.nombre) : 'Producto';

                    itemDiv.innerHTML = `
                        <div class="flex items-center gap-4">
                            <span class="bg-[#588157]/10 text-[#588157] text-xs font-black px-3 py-1.5 rounded-xl border border-[#588157]/10">${det.cantidad}x</span>
                            <span class="text-gray-700 font-bold">${nombreProd}</span>
                        </div>
                        <span class="text-[#3a5a40] font-black">$${(det.subtotal || 0).toFixed(2)}</span>
                    `;
                    cuentaItems.appendChild(itemDiv);
                });
            }
        });

        if (modalSubtotal) modalSubtotal.innerText = `$${total.toFixed(2)}`;

        subtotalActual = total;
        aplicarDescuento(0); // Reset a sin descuento

        propinaActual = 0; // Reset propina
        const inputPropina = document.getElementById('input-propina');
        if (inputPropina) inputPropina.value = '';

        // Reset payment selection
        metodoSeleccionado = null;
        actualizarUIBotonesPago();

        if (btnCobrar) {
            btnCobrar.onclick = () => cobrarCuenta(mesa.id, data.map(p => p.id));
        }

    } catch (error) {
        console.error('Error al cargar detalle:', error);
    }
}

function aplicarDescuento(porcentaje) {
    porcentajeActual = porcentaje;
    descuentoActual = subtotalActual * (porcentaje / 100);
    actualizarUITotales();
    actualizarUIBotonesDescuento();
}

function actualizarUITotales() {
    const totalFinal = subtotalActual - descuentoActual + propinaActual;
    const rowDesc = document.getElementById('row-descuento');
    const txtPorc = document.getElementById('txt-porcentaje');
    const lblDesc = document.getElementById('modal-descuento');
    const rowProp = document.getElementById('row-propina');
    const lblProp = document.getElementById('modal-propina');

    if (porcentajeActual > 0) {
        rowDesc.classList.remove('hidden');
        txtPorc.innerText = porcentajeActual;
        lblDesc.innerText = `-$${descuentoActual.toFixed(2)}`;
    } else {
        rowDesc.classList.add('hidden');
    }

    if (propinaActual > 0) {
        rowProp.classList.remove('hidden');
        lblProp.innerText = `$${propinaActual.toFixed(2)}`;
    } else {
        rowProp.classList.add('hidden');
    }

    modalTotal.innerText = `$${totalFinal.toFixed(2)}`;
}

function customPropina(valor) {
    propinaActual = parseFloat(valor) || 0;
    actualizarUITotales();
}

function actualizarUIBotonesDescuento() {
    [0, 5, 10].forEach(p => {
        const btn = document.getElementById(`btn-desc-${p}`);
        if (!btn) return;
        if (p === porcentajeActual) {
            btn.classList.add('border-[#588157]', 'bg-[#588157]/10', 'text-[#588157]');
            btn.classList.remove('border-gray-100', 'bg-gray-50', 'text-gray-400');
        } else {
            btn.classList.remove('border-[#588157]', 'bg-[#588157]/10', 'text-[#588157]');
            btn.classList.add('border-gray-100', 'bg-gray-50', 'text-gray-400');
        }
    });
}

async function cobrarCuenta(mesaId, pedidoIds) {
    if (!metodoSeleccionado) return;
    const totalFinal = modalTotal.innerText;
    if (!confirm(`¿Confirmar pago de ${totalFinal} en ${metodoSeleccionado.toUpperCase()} y liberar mesa?`)) return;

    try {
        // 1. Marcar pedidos como pagados y registrar método y propina
        const { error: errorPedidos } = await window.supabase
            .from('pedidos')
            .update({
                estado: 'pagado',
                metodo_pago: metodoSeleccionado,
                propina: propinaActual
            })
            .in('id', pedidoIds);

        if (errorPedidos) throw errorPedidos;

        // 2. Cerrar mesa
        const { error: errorMesa } = await window.supabase
            .from('mesas')
            .update({ estado: 'cerrada' })
            .eq('id', mesaId);

        if (errorMesa) throw errorMesa;

        showToast('Cuenta saldada y mesa liberada');
        closeModal();
        cargarDatos();
    } catch (error) {
        console.error('Error al cobrar:', error);
        alert('Hubo un error al procesar el pago. Por favor, intenta de nuevo.');
    }
}

function imprimirTicket() {
    // Simulación de ticket virtual
    let itemsText = "";
    const items = cuentaItems.querySelectorAll('.flex.justify-between');
    items.forEach(item => {
        itemsText += item.innerText.replace('\n', ' ') + "\n";
    });

    const printContent = `
XAMAN - TICKET
Mesa: ${mesaSeleccionada.numero}
Fecha: ${new Date().toLocaleString()}
---------------------------
${itemsText}
---------------------------
TOTAL: ${modalTotal.innerText}
---------------------------
¡Gracias por su visita!
    `;
    console.log(printContent);
    alert('Ticket generado en consola (Simulación)');
}

function enviarEmailTicket() {
    let itemsText = "";
    const items = cuentaItems.querySelectorAll('.flex.justify-between');
    items.forEach(item => {
        itemsText += item.innerText.replace('\n', ' ') + "%0D%0A";
    });

    const fecha = new Date().toLocaleString();
    const subject = `Ticket de Consumo - Mesa ${mesaSeleccionada.numero} - ${fecha}`;
    const body = `XAMAN - TICKET%0D%0AMesa: ${mesaSeleccionada.numero}%0D%0AFecha: ${fecha}%0D%0A---------------------------%0D%0A${itemsText}---------------------------%0D%0ATOTAL: ${modalTotal.innerText}%0D%0A---------------------------%0D%0A¡Gracias por su visita!`;

    window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

function seleccionarMetodo(metodo) {
    metodoSeleccionado = metodo;
    actualizarUIBotonesPago();
}

function actualizarUIBotonesPago() {
    const btnEf = document.getElementById('btn-efectivo');
    const btnTj = document.getElementById('btn-tarjeta');
    const btnPay = document.getElementById('btn-cobrar');

    if (!btnEf || !btnTj || !btnPay) return;

    // Reset styles
    [btnEf, btnTj].forEach(btn => {
        btn.classList.remove('border-[#588157]', 'bg-[#588157]/10', 'text-[#588157]');
        btn.classList.add('border-gray-100', 'bg-gray-50', 'text-gray-400');
    });

    // Active style
    if (metodoSeleccionado === 'efectivo') {
        btnEf.classList.add('border-[#588157]', 'bg-[#588157]/10', 'text-[#588157]');
        btnEf.classList.remove('border-gray-100', 'bg-gray-50', 'text-gray-400');
    } else if (metodoSeleccionado === 'tarjeta') {
        btnTj.classList.add('border-[#588157]', 'bg-[#588157]/10', 'text-[#588157]');
        btnTj.classList.remove('border-gray-100', 'bg-gray-50', 'text-gray-400');
    }

    // Enable/Disable pay button
    if (metodoSeleccionado) {
        btnPay.disabled = false;
        btnPay.classList.remove('opacity-50', 'cursor-not-allowed');
        btnPay.classList.add('hover:bg-[#3a5a40]', 'active:scale-95');
    } else {
        btnPay.disabled = true;
        btnPay.classList.add('opacity-50', 'cursor-not-allowed');
        btnPay.classList.remove('hover:bg-[#3a5a40]', 'active:scale-95');
    }
}

function closeModal() {
    modalPanel.classList.add('translate-x-full');
    setTimeout(() => {
        modalCuenta.classList.add('invisible', 'opacity-0');
    }, 300);
}

function suscribirRealtime() {
    window.supabase
        .channel('caja-cambios')
        .on('postgres_changes', { event: '*', table: 'pedidos' }, () => cargarDatos())
        .on('postgres_changes', { event: '*', table: 'mesas' }, () => cargarDatos())
        .subscribe();
}

function showToast(msg) {
    toastMsg.innerText = msg;
    toast.classList.remove('opacity-0', 'translate-y-10');
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-10');
    }, 3000);
}
