// Estado global
let ordersRange = 'today';
let salesChart = null;

document.addEventListener('DOMContentLoaded', () => {
    cargarReportes();
});

function changeRange(range) {
    ordersRange = range;

    // UI Update
    const btnToday = document.getElementById('btn-today');
    const btnWeek = document.getElementById('btn-week');
    const btnAll = document.getElementById('btn-all');

    [btnToday, btnWeek, btnAll].forEach(btn => {
        if (!btn) return;
        btn.classList.remove('bg-[#588157]', 'text-white');
        btn.classList.add('bg-white', 'text-gray-400');
    });

    const activeBtn = document.getElementById(`btn-${range}`);
    if (activeBtn) {
        activeBtn.classList.add('bg-[#588157]', 'text-white');
        activeBtn.classList.remove('bg-white', 'text-gray-400');
    }

    cargarReportes();
}

async function cargarReportes() {
    try {
        let query = window.supabase
            .from('pedidos')
            .select(`
                *,
                mesas(nombre, numero),
                pedido_detalle(
                    cantidad,
                    productos(nombre)
                )
            `)
            .order('created_at', { ascending: false });

        if (ordersRange === 'today') {
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            query = query.gte('created_at', hoy.toISOString());
        } else if (ordersRange === 'week') {
            // Obtener el lunes de la semana actual
            const hoy = new Date();
            const day = hoy.getDay();
            // Si es domingo (0), queremos el lunes pasado (-6). Si es lunes (1), se queda igual (0).
            const diff = hoy.getDate() - (day === 0 ? 6 : day - 1);
            const lunes = new Date(hoy.setDate(diff));
            lunes.setHours(0, 0, 0, 0);
            query = query.gte('created_at', lunes.toISOString());
        }

        const { data: pedidos, error } = await query;
        if (error) throw error;

        // Si es semanal, filtramos hasta el viernes para el reporte visual
        const pedidosVisibles = ordersRange === 'week' ? pedidos.filter(p => {
            const d = new Date(p.created_at).getDay();
            return d >= 1 && d <= 5;
        }) : pedidos;

        renderizarTiempos(pedidosVisibles);
        renderizarPopularidad(pedidosVisibles);
        renderizarVentasDiarias(pedidos);
        renderizarGraficaVentas(pedidos);
    } catch (error) {
        console.error('Error al cargar reportes:', error);
    }
}

function renderizarVentasDiarias(pedidos) {
    const container = document.getElementById('daily-sales-container');
    if (!container) return;
    container.innerHTML = '';

    const diasNombres = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const ventasPorDia = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    pedidos.forEach(p => {
        const fecha = new Date(p.created_at);
        const dia = fecha.getDay();
        // Sumamos solo si es de Lunes (1) a Viernes (5)
        if (dia >= 1 && dia <= 5) {
            const totalPedido = parseFloat(p.total) || 0;
            ventasPorDia[dia] += totalPedido;
        }
    });

    [1, 2, 3, 4, 5].forEach(dia => {
        const total = ventasPorDia[dia];
        const card = document.createElement('div');
        card.className = "bg-gray-50/50 rounded-2xl p-6 border border-gray-100 flex flex-col items-center text-center";
        card.innerHTML = `
            <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">${diasNombres[dia]}</span>
            <span class="text-xl font-black text-[#3a5a40] tracking-tighter text-lg">$${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
        `;
        container.appendChild(card);
    });
}

function renderizarGraficaVentas(pedidos) {
    const ctx = document.getElementById('salesTrendChart');
    if (!ctx) return;

    const diasNombres = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
    const ventasPorDia = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    pedidos.forEach(p => {
        const fecha = new Date(p.created_at);
        const dia = fecha.getDay();
        if (dia >= 1 && dia <= 5) {
            ventasPorDia[dia] += parseFloat(p.total) || 0;
        }
    });

    const data = [ventasPorDia[1], ventasPorDia[2], ventasPorDia[3], ventasPorDia[4], ventasPorDia[5]];

    if (salesChart) {
        salesChart.destroy();
    }

    salesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: diasNombres,
            datasets: [{
                label: 'Ventas Diarias ($)',
                data: data,
                borderColor: '#588157',
                backgroundColor: 'rgba(88, 129, 87, 0.1)',
                borderWidth: 4,
                pointBackgroundColor: '#3a5a40',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 8,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#3a5a40',
                    titleFont: { size: 12, weight: 'bold' },
                    bodyFont: { size: 14, weight: 'bold' },
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: function (context) {
                            return '$' + context.parsed.y.toLocaleString('es-MX', { minimumFractionDigits: 2 });
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        display: true,
                        color: 'rgba(0,0,0,0.03)'
                    },
                    ticks: {
                        font: { size: 10, weight: 'bold' },
                        color: '#9ca3af',
                        callback: function (value) {
                            return '$' + value;
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: { size: 10, weight: 'bold' },
                        color: '#3a5a40'
                    }
                }
            }
        }
    });
}

function renderizarTiempos(pedidos) {
    const tableBody = document.getElementById('tiempos-table-body');
    const avgLabel = document.getElementById('avg-time');
    tableBody.innerHTML = '';

    const pedidosServidos = pedidos.filter(p => p.finished_at);
    let totalMinutes = 0;

    pedidosServidos.forEach(p => {
        const start = new Date(p.created_at);
        const end = new Date(p.finished_at);
        const diffMs = end - start;
        const diffMins = Math.round(diffMs / 60000);

        totalMinutes += diffMins;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="py-4">
                <span class="text-[#3a5a40]">${p.mesas.nombre || `Mesa ${p.mesas.numero}`}</span>
            </td>
            <td class="py-4">${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
            <td class="py-4">${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
            <td class="py-4 text-right">
                <span class="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg">${diffMins} min</span>
            </td>
        `;
        tableBody.appendChild(tr);
    });

    if (pedidosServidos.length > 0) {
        const avg = Math.round(totalMinutes / pedidosServidos.length);
        avgLabel.innerText = `${avg} min`;
    } else {
        avgLabel.innerText = '-- min';
        tableBody.innerHTML = '<tr><td colspan="4" class="py-10 text-center text-gray-400">Sin datos registrados</td></tr>';
    }
}

function renderizarPopularidad(pedidos) {
    const list = document.getElementById('popularity-list');
    list.innerHTML = '';

    const productStats = {};

    pedidos.forEach(p => {
        p.pedido_detalle.forEach(det => {
            const name = det.productos ? (Array.isArray(det.productos) ? det.productos[0].nombre : det.productos.nombre) : 'Desconocido';
            productStats[name] = (productStats[name] || 0) + (det.cantidad || 0);
        });
    });

    // Convert object to sorted array
    const sorted = Object.entries(productStats)
        .map(([name, qty]) => ({ name, qty }))
        .sort((a, b) => b.qty - a.qty);

    if (sorted.length === 0) {
        list.innerHTML = '<div class="py-20 text-center text-gray-400 font-bold uppercase tracking-widest">Sin ventas registradas</div>';
        return;
    }

    const maxQty = sorted[0].qty;

    sorted.forEach(item => {
        const percentage = Math.round((item.qty / maxQty) * 100);

        let color = 'bg-[#a3b18a]'; // Media
        let label = 'Venta Media';
        let badgeClass = 'bg-gray-100 text-gray-500';

        if (percentage > 80) {
            color = 'bg-[#588157]'; // Top
            label = 'Top Seller';
            badgeClass = 'bg-[#588157]/10 text-[#588157]';
        } else if (percentage < 30) {
            color = 'bg-red-400'; // Low
            label = 'Baja Venta';
            badgeClass = 'bg-red-50 text-red-500';
        }

        const div = document.createElement('div');
        div.className = "space-y-2";
        div.innerHTML = `
            <div class="flex justify-between items-end">
                <span class="font-bold text-[#3a5a40] uppercase tracking-tighter">${item.name}</span>
                <span class="badge-popularity ${badgeClass}">${label} (${item.qty})</span>
            </div>
            <div class="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                <div class="${color} h-full transition-all duration-1000" style="width: ${percentage}%"></div>
            </div>
        `;
        list.appendChild(div);
    });
}
